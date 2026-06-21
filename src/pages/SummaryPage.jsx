// 諮詢摘要(第三頁,與智能問答 / 案件調查同層)。
// 版面比照案件調查:左欄=已存摘要列表;右欄=選中摘要內容 + 繼續諮詢 / 下載(Markdown/PDF)。
// 摘要由智能問答「匯出為諮詢摘要」產生,存在 AppState.summaries(session)。
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppState } from "../state/AppState.jsx";
import { scenarioById } from "../data/scenarios.js";
import SidebarNav from "../components/SidebarNav.jsx";
import MarkdownView from "../features/chat/MarkdownView.jsx";

export default function SummaryPage() {
  const { summaries } = useAppState();
  const { state } = useLocation();
  const navigate = useNavigate();

  const [selectedId, setSelectedId] = useState(
    () => state?.viewSummaryId || summaries[0]?.id || null
  );
  // 剛由智能問答匯出的那筆摘要 id;返回橫條只在檢視這筆時顯示。
  const [justExportedId, setJustExportedId] = useState(
    () => (state?.fromChat ? state?.viewSummaryId : null) || null
  );

  // 由智能問答匯出後帶入要檢視的摘要。
  useEffect(() => {
    if (state?.viewSummaryId) setSelectedId(state.viewSummaryId);
    if (state?.fromChat && state?.viewSummaryId) setJustExportedId(state.viewSummaryId);
  }, [state]);

  const selected =
    summaries.find((s) => s.id === selectedId) || summaries[0] || null;

  function continueFromSummary(summary) {
    navigate("/chat", {
      state: {
        caseContext: {
          kind: "summary",
          summaryId: summary.id,
          scenarioId: summary.scenarioId,
          title: summary.title,
          summary: summary.plainSummary,
        },
      },
    });
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左欄:已存摘要列表 */}
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-navy-100 bg-white">
        <SidebarNav />
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-semibold tracking-wide text-navy-400">已存摘要</span>
            {summaries.length > 0 && (
              <span className="rounded-full bg-navy-50 px-1.5 text-[11px] text-navy-400">
                {summaries.length}
              </span>
            )}
          </div>

          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {summaries.length === 0 && (
              <p className="px-1 py-2 text-[12px] leading-5 text-navy-300">
                尚無諮詢摘要。在智能問答的回答下方點「匯出為諮詢摘要」即可存檔於此。
              </p>
            )}
            {summaries.map((s) => {
              const active = s.id === selected?.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  className={[
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    active ? "border-brand bg-navy-50" : "border-navy-100 bg-white hover:border-navy-200",
                  ].join(" ")}
                >
                  <div className="truncate text-[13px] font-medium leading-5 text-brand">{s.title}</div>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[11px] text-navy-400">
                    <span className="rounded bg-navy-50 px-1.5 py-0.5">
                      {scenarioById[s.scenarioId]?.title || "諮詢"}
                    </span>
                    <span>{s.turnCount} 輪</span>
                    {s.lawCount > 0 && <span>法條 {s.lawCount}</span>}
                    <span>{s.date}</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* 右欄:選中摘要內容 */}
      <section className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        {selected && justExportedId && selected.id === justExportedId && (
          <ReturnToChatBar onBack={() => navigate("/chat")} note='摘要已存檔於「諮詢摘要」' />
        )}
        {selected ? (
          <SummaryDetail summary={selected} onContinue={() => continueFromSummary(selected)} />
        ) : (
          <EmptyHint />
        )}
      </section>
    </div>
  );
}

function SummaryDetail({ summary, onContinue }) {
  function printPdf() {
    const cleanup = () => {
      document.body.classList.remove("printing-summary");
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    document.body.classList.add("printing-summary");
    window.print();
    setTimeout(cleanup, 1000);
  }

  // 下載 Word:重用畫面已渲染的摘要 HTML(含官方法條超連結),包成 Word 可開的 .doc。
  // 不加套件;勾選框 <input> 換成 ☐/☑ 字元,避免 Word 不認表單元素。
  function downloadWord() {
    const el = document.getElementById("print-area");
    if (!el) return;
    const body = el.innerHTML
      .replace(/<input[^>]*\bchecked\b[^>]*>/gi, "☑ ")
      .replace(/<input[^>]*type=["']?checkbox["']?[^>]*>/gi, "☐ ");
    const doc = `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"><title>${summary.title}</title><style>
      body{font-family:"Noto Sans TC","Microsoft JhengHei",sans-serif;font-size:12pt;line-height:1.7;color:#1f2937}
      h1{font-size:18pt;color:#1e3a5f;margin:0 0 8pt}
      h2{font-size:14pt;color:#1e3a5f;border-bottom:1px solid #c4d2e3;padding-bottom:3pt;margin:14pt 0 6pt}
      h3{font-size:12pt;color:#243f5e;margin:10pt 0 4pt}
      table{border-collapse:collapse;width:100%;margin:8pt 0}
      th,td{border:1px solid #9bb3cf;padding:4pt 8pt;text-align:left}
      th{background:#f2f5f9;color:#1e3a5f}
      a{color:#1e3a5f}
      blockquote{border-left:3px solid #c4d2e3;margin:6pt 0;padding:2pt 10pt;color:#3a5a85}
    </style></head><body>${body}</body></html>`;
    const blob = new Blob(["﻿", doc], { type: "application/msword;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${summary.title || "consult-summary"}.doc`.replace(/[\\/:*?"<>|]/g, "_");
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 no-print">
        <div className="min-w-0">
          <div className="text-xs text-navy-400">
            {scenarioById[summary.scenarioId]?.title} · {summary.date} · {summary.turnCount} 輪問答
          </div>
          <h1 className="mt-1 text-xl font-bold text-brand">{summary.title}</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={downloadWord}
            className="rounded-lg border border-navy-200 px-3.5 py-2 text-sm font-medium text-navy-700 hover:border-navy-300 hover:text-brand"
          >
            下載 Word
          </button>
          <button
            type="button"
            onClick={printPdf}
            className="rounded-lg border border-navy-200 px-3.5 py-2 text-sm font-medium text-navy-700 hover:border-navy-300 hover:text-brand"
          >
            下載 PDF(列印)
          </button>
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
              <path
                d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            就此諮詢摘要繼續諮詢
          </button>
        </div>
      </div>

      <article className="mt-4 rounded-xl border border-navy-100 bg-white p-6">
        <div id="print-area">
          <MarkdownView>{summary.markdown}</MarkdownView>
        </div>
      </article>
    </div>
  );
}

// 返回橫條:回到剛才匯出來源的那段對話(原對話一直保留,activeConvId 未變)。
function ReturnToChatBar({ onBack, note }) {
  return (
    <div className="no-print sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50 px-4 py-2.5">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:opacity-80"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
          <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        返回剛才的對話
      </button>
      <span className="shrink-0 text-[12px] text-navy-400">{note}</span>
    </div>
  );
}

function EmptyHint() {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
          <path
            d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Zm7 0V8h4M9 12h6M9 15.5h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-brand">尚無諮詢摘要</h2>
      <p className="mt-1.5 max-w-md text-sm text-navy-400">
        在智能問答的回答下方點「匯出為諮詢摘要」,即可把問答、AI 回答、引用法條與裁罰案例存成一份摘要,於此檢視、下載或繼續諮詢。
      </p>
    </div>
  );
}
