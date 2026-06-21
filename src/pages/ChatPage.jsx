import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { askStream } from "../services/askStream.js";
import { useAppState, makeConversation } from "../state/AppState.jsx";
import { scenarios, scenarioById, ROLES } from "../data/scenarios.js";
import { genHexId } from "../lib/ids.js";
import { buildConsultSummary } from "../lib/buildConsultSummary.js";
import ConversationRail from "../features/chat/ConversationRail.jsx";
import ScenarioCards from "../features/chat/ScenarioCards.jsx";
import ExampleChips from "../features/chat/ExampleChips.jsx";
import MessageList from "../features/chat/MessageList.jsx";
import ReasoningDrawer from "../features/chat/ReasoningDrawer.jsx";

export default function ChatPage() {
  const {
    role,
    setRole,
    conversations,
    setConversations,
    activeConvId,
    setActiveConvId,
    setSummaries,
  } = useAppState();
  const { state } = useLocation();
  const navigate = useNavigate();

  const active = conversations.find((c) => c.id === activeConvId) || conversations[0];
  const [scenarioId, setScenarioId] = useState(active?.scenarioId || scenarios[0].id);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [drawer, setDrawer] = useState({ open: false, question: "", cyphers: [] });
  const [caseBanner, setCaseBanner] = useState(null); // 由報告/摘要「繼續諮詢」帶入的上下文

  const streamRef = useRef(null);
  const bufRef = useRef("");
  const flushRef = useRef(null);
  const lastAskRef = useRef(null);

  const messages = active?.messages || [];
  const chips = scenarioById[scenarioId].chips[role] || [];

  useEffect(() => {
    return () => {
      streamRef.current?.cancel();
      if (flushRef.current) clearInterval(flushRef.current);
    };
  }, []);

  // 報告 / 摘要「繼續諮詢」:依 navigate state 的 caseContext 開新對話、設情境、預填續問與上下文 banner。
  useEffect(() => {
    const cc = state?.caseContext;
    if (!cc) return;
    const conv = makeConversation(cc.scenarioId);
    conv.title = `延續${cc.kind === "summary" ? "諮詢" : "案件"}:${cc.title}`;
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
    setScenarioId(cc.scenarioId);
    setCaseBanner(cc);
    setInput(`延續「${cc.title}」,我想進一步釐清:`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  function updateMessage(convId, msgId, patch) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) => (m.id === msgId ? { ...m, ...patch } : m)),
            }
      )
    );
  }

  function ask({ question, responseKey }) {
    if (busy || !question.trim()) return;
    const convId = activeConvId;
    const sid = scenarioId;
    lastAskRef.current = { question, responseKey };
    setBusy(true);

    const userMsg = { id: genHexId(), role: "user", text: question };
    const answerId = genHexId();
    const answerMsg = {
      id: answerId,
      role: "assistant",
      status: "streaming",
      progress: "analysing",
      streamedText: "",
      question,
      scenario: sid,
      final: null,
    };

    setConversations((prev) =>
      prev.map((c) =>
        c.id !== convId
          ? c
          : {
              ...c,
              title: c.title || question,
              scenarioId: c.scenarioId || sid,
              messages: [...c.messages, userMsg, answerMsg],
            }
      )
    );

    bufRef.current = "";
    flushRef.current = setInterval(() => {
      updateMessage(convId, answerId, { streamedText: bufRef.current });
    }, 60);
    const stopFlush = () => {
      if (flushRef.current) {
        clearInterval(flushRef.current);
        flushRef.current = null;
      }
    };

    streamRef.current = askStream(
      { question, role, scenario: sid, responseKey },
      {
        onProgress: (progress) => updateMessage(convId, answerId, { progress }),
        onChunk: (delta) => {
          bufRef.current += delta;
        },
        onDone: (final) => {
          stopFlush();
          updateMessage(convId, answerId, {
            status: "done",
            streamedText: bufRef.current,
            final,
          });
          setBusy(false);
          streamRef.current = null;
        },
        onError: () => {
          stopFlush();
          updateMessage(convId, answerId, { status: "error" });
          setBusy(false);
          streamRef.current = null;
        },
      }
    );
  }

  function onSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    ask({ question: q, responseKey: undefined });
  }

  // 停止生成:取消串流(askStream 對 AbortError 不會走 onError),自行收尾——
  // 停掉 flush、把進行中的回答標為 stopped(可重試)、解除 busy。
  function handleStop() {
    streamRef.current?.cancel();
    if (flushRef.current) {
      clearInterval(flushRef.current);
      flushRef.current = null;
    }
    streamRef.current = null;
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== activeConvId
          ? c
          : {
              ...c,
              messages: c.messages.map((m) =>
                m.role === "assistant" && m.status === "streaming"
                  ? { ...m, status: "stopped" }
                  : m
              ),
            }
      )
    );
    setBusy(false);
  }

  function onRetry(failedMsg) {
    setConversations((prev) =>
      prev.map((c) =>
        c.id !== activeConvId
          ? c
          : { ...c, messages: c.messages.filter((m) => m.id !== failedMsg.id) }
      )
    );
    if (lastAskRef.current) ask(lastAskRef.current);
  }

  function handleNew() {
    const conv = makeConversation(scenarioId);
    setConversations((prev) => [conv, ...prev]);
    setActiveConvId(conv.id);
  }

  function handleSelectConversation(id) {
    setActiveConvId(id);
    const c = conversations.find((x) => x.id === id);
    if (c?.scenarioId) setScenarioId(c.scenarioId);
  }

  // 匯出為諮詢摘要:把當前對話整理成 Markdown 快照,存入摘要清單,跳轉至「諮詢摘要」頁檢視。
  function handleExportSummary() {
    const conv = conversations.find((c) => c.id === activeConvId) || conversations[0];
    const summary = buildConsultSummary(conv, role);
    if (!summary) return;
    setSummaries((prev) => [summary, ...prev]);
    navigate("/summary", { state: { viewSummaryId: summary.id, fromChat: true } });
  }

  const isEmpty = messages.length === 0;

  return (
    <div className="flex h-full overflow-hidden">
      <ConversationRail
        conversations={conversations}
        activeId={activeConvId}
        onSelect={handleSelectConversation}
        onNew={handleNew}
        role={role}
        onRoleChange={setRole}
      />

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden px-6 py-6">
        <div className="flex shrink-0 items-center justify-between">
          <span className="inline-flex items-center gap-2 rounded-full border border-navy-100 bg-white px-3 py-1 text-sm text-navy-700">
            <span className="h-2 w-2 rounded-full bg-brand" />
            對話工作區
          </span>
        </div>

        {caseBanner && (
          <div className="mt-3 flex shrink-0 items-start justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50 px-3.5 py-2.5">
            <div className="min-w-0">
              <div className="text-[11px] font-semibold tracking-wide text-navy-400">
                {caseBanner.kind === "summary" ? "延續諮詢" : "延續案件"} ·{" "}
                {scenarioById[caseBanner.scenarioId]?.title}
              </div>
              <div className="mt-0.5 truncate text-[13px] font-medium text-brand">
                {caseBanner.title}
              </div>
              {caseBanner.summary && (
                <div className="mt-0.5 line-clamp-2 text-[12px] leading-5 text-navy-400">
                  {caseBanner.summary}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setCaseBanner(null)}
              className="shrink-0 rounded p-1 text-navy-300 hover:text-brand"
              title="關閉上下文"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        <div className="mt-5 min-h-0 flex-1 overflow-y-auto pr-2">
          {isEmpty ? (
            <EmptyState
              scenarioId={scenarioId}
              onSelectScenario={setScenarioId}
              chips={chips}
              busy={busy}
              onPick={(chip) => ask({ question: chip.text, responseKey: chip.responseKey })}
            />
          ) : (
            <MessageList
              messages={messages}
              busy={busy}
              onRetry={onRetry}
              onOpenPath={({ question, cyphers }) => setDrawer({ open: true, question, cyphers })}
              onExportSummary={handleExportSummary}
              onFollowup={(question) => ask({ question })}
            />
          )}
        </div>

        <form onSubmit={onSubmit} className="mt-3 shrink-0">
          <div className="flex items-end gap-2 rounded-xl border border-navy-200 bg-white p-2 focus-within:border-brand">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e);
                }
              }}
              rows={1}
              placeholder="輸入勞動法規問題，或請小勞鼠協助釐清情境"
              className="max-h-32 flex-1 resize-none bg-transparent px-2 py-1.5 text-[15px] text-navy-800 outline-none placeholder:text-navy-300"
            />
            {busy ? (
              <button
                type="button"
                onClick={handleStop}
                className="inline-flex items-center gap-1.5 rounded-lg border border-navy-300 bg-white px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:border-brand hover:text-brand"
              >
                <span className="h-3 w-3 rounded-[2px] bg-current" />
                停止
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
              >
                送出
              </button>
            )}
          </div>
        </form>
      </section>

      <ReasoningDrawer
        open={drawer.open}
        question={drawer.question}
        cyphers={drawer.cyphers}
        onClose={() => setDrawer((d) => ({ ...d, open: false }))}
      />
    </div>
  );
}

function EmptyState({ scenarioId, onSelectScenario, chips, busy, onPick }) {
  return (
    <div className="flex h-full flex-col items-center justify-center text-center">
      <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-brand text-white">
        <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
          <path d="M5 6.5h14M5 12h9M5 17.5h12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      </div>
      <h2 className="text-lg font-semibold text-brand">選擇情境開始詢問</h2>
      <p className="mt-1.5 max-w-md text-sm text-navy-400">
        小勞鼠會依照你的身份與情境，整理法規重點、引用依據與 GraphRAG 推理路徑。
      </p>

      <div className="mt-6 flex w-full flex-col items-center">
        <ScenarioCards activeId={scenarioId} onSelect={onSelectScenario} />

        <div className="mt-5 w-full max-w-3xl">
          <div className="mb-2 text-left text-xs font-semibold tracking-wide text-navy-400">
            建議提問
          </div>
          <ExampleChips chips={chips} disabled={busy} onPick={onPick} />
        </div>
      </div>
    </div>
  );
}
