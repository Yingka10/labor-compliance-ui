// AI 回答氣泡。組裝:
//   - Markdown 渲染(表格/清單/mermaid)+ 右上「複製」鈕(原始 Markdown,含標註段)
//   - 證據區 EvidenceArea(相關法條 / 參考來源 / 推理路徑三 tab)
//   - 固定出口按鈕(所有情境、所有問題皆顯示,意圖由使用者選擇):
//       「匯出諮詢摘要」→ 將當前對話整理成摘要;「立案調查並生成報告」→ 跳轉並預填表單
//   - 串流逐字 + 等待狀態列;錯誤時顯示重試
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import MarkdownView from "./MarkdownView.jsx";
import ProgressLine from "./ProgressLine.jsx";
import EvidenceArea from "./EvidenceArea.jsx";
import { parseCitations } from "../../lib/parseCitations.js";
import { extractLaws } from "../../lib/extractLaws.js";
import { parsePrefill } from "../../lib/parsePrefill.js";

export default function AnswerBubble({ message, busy, onRetry, onOpenPath, onExportSummary, onFollowup }) {
  const { status } = message;
  return (
    <div className="flex justify-start">
      <div className="relative w-full max-w-[88%] rounded-2xl rounded-tl-sm border border-navy-100 bg-white px-5 py-4 shadow-sm">
        {status === "streaming" && <Streaming message={message} />}
        {status === "done" && (
          <Done
            message={message}
            busy={busy}
            onOpenPath={onOpenPath}
            onExportSummary={onExportSummary}
            onFollowup={onFollowup}
          />
        )}
        {status === "stopped" && <Stopped message={message} onRetry={onRetry} />}
        {status === "error" && <Errored onRetry={onRetry} />}
      </div>
    </div>
  );
}

function Streaming({ message }) {
  const { streamedText, progress } = message;
  if (!streamedText) return <ProgressLine progress={progress} />;
  return (
    <div>
      <MarkdownView>{streamedText}</MarkdownView>
      <span className="stream-caret text-navy-400">▍</span>
    </div>
  );
}

function Done({ message, busy, onOpenPath, onExportSummary, onFollowup }) {
  const navigate = useNavigate();
  const final = message.final;

  const parsed = useMemo(() => parseCitations(final.result), [final.result]);
  // 延伸問題:由本次回答動態解析(🔎 延伸問題 標註段),非前端寫死。
  const followups = parsed.followups || [];
  const laws = useMemo(
    () => extractLaws(final.cyphers, parsed.body, parsed.lawRefs),
    [final.cyphers, parsed.body, parsed.lawRefs]
  );
  const caseCount = useMemo(
    () =>
      (final.cyphers || []).reduce((n, c) => {
        const ids = new Set((c.data || []).map((r) => r["裁罰案例_案例ID"]));
        ids.delete(undefined);
        return n + ids.size;
      }, 0),
    [final.cyphers]
  );
  const hasPath = (final.cyphers || []).some((c) => (c.data || []).length > 0);

  return (
    <div>
      <CopyButton text={final.result} />

      <MarkdownView>{parsed.body}</MarkdownView>

      <EvidenceArea
        laws={laws}
        documents={parsed.documents}
        hasPath={hasPath}
        caseCount={caseCount}
        onOpenPath={() =>
          onOpenPath({ question: message.question, cyphers: final.cyphers })
        }
      />

      {/* 延伸問題:情境化追問,點了直接送出(走同一 ask、含並行搶答)。 */}
      {followups.length > 0 && onFollowup && (
        <div className="mt-4">
          <div className="mb-1.5 text-[12px] font-medium text-navy-400">延伸問題</div>
          <div className="flex flex-wrap gap-2">
            {followups.map((q, i) => (
              <button
                key={i}
                type="button"
                disabled={busy}
                onClick={() => onFollowup(q)}
                className="rounded-full border border-navy-200 bg-white px-3 py-1.5 text-[13px] text-navy-700 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 固定出口按鈕:所有情境皆顯示,意圖由使用者選擇,系統不猜測。 */}
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onExportSummary?.()}
          className="inline-flex items-center gap-2 rounded-lg border border-brand px-3.5 py-2 text-sm font-medium text-brand transition-colors hover:bg-navy-50"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M12 3v12m0 0l-4-4m4 4l4-4M5 17v2a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          匯出為諮詢摘要
        </button>
        <button
          type="button"
          onClick={() =>
            navigate("/investigate", {
              state: {
                scenarioId: message.scenario,
                question: message.question,
                prefill: parsePrefill(message.scenario, message.question),
                fromChat: true,
              },
            })
          }
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
            <path
              d="M9 5h7a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V7M9 5V3.5h6V5M9 5h6M9.5 12.5l1.8 1.8 3.5-3.6"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          立案調查並生成報告
        </button>
      </div>
    </div>
  );
}

function Stopped({ message, onRetry }) {
  const partial = message.streamedText;
  return (
    <div>
      {partial && <MarkdownView>{partial}</MarkdownView>}
      <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50/60 px-3 py-2">
        <span className="text-[13px] text-navy-500">已停止生成</span>
        <button
          type="button"
          onClick={onRetry}
          className="shrink-0 rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-navy-50"
        >
          重新生成
        </button>
      </div>
    </div>
  );
}

function Errored({ onRetry }) {
  return (
    <div className="flex items-start gap-3">
      <div className="flex-1 text-sm text-navy-700">
        回答載入失敗,可能是 API 逾時或尚未串接。
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-md border border-brand px-3 py-1.5 text-sm font-medium text-brand hover:bg-navy-50"
      >
        重試
      </button>
    </div>
  );
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={copy}
      className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-md border border-navy-100 bg-white px-2 py-1 text-xs text-navy-400 hover:text-brand"
      title="複製原始 Markdown"
    >
      {copied ? (
        "已複製"
      ) : (
        <>
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none">
            <rect
              x="9"
              y="9"
              width="11"
              height="11"
              rx="2"
              stroke="currentColor"
              strokeWidth="1.6"
            />
            <path
              d="M5 15V5a2 2 0 0 1 2-2h10"
              stroke="currentColor"
              strokeWidth="1.6"
            />
          </svg>
          複製
        </>
      )}
    </button>
  );
}
