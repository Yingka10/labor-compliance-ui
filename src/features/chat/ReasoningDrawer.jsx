// 知識圖譜推理路徑抽屜(右側滑入)。取代原獨立的知識圖譜頁。
// 路徑視角:線性步驟條(節點 + 計數 + 可展開案例)。
// 技術視角:顯示原始 Cypher 全文(直接回應評審「graph 真的有被查詢」的質疑)。
import { useEffect, useState } from "react";
import { buildReasoningPath, formatAmount } from "../../lib/reasoningPath.js";

export default function ReasoningDrawer({ open, onClose, question, cyphers }) {
  const [tech, setTech] = useState(false);

  // Esc 關閉
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const path = buildReasoningPath(cyphers);

  return (
    <div className="fixed inset-0 z-40">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-navy-900/30"
        onClick={onClose}
        aria-hidden
      />
      {/* panel */}
      <aside className="absolute right-0 top-0 flex h-full w-[480px] max-w-[92vw] flex-col bg-white shadow-2xl">
        <header className="flex items-start justify-between border-b border-navy-100 px-5 py-4">
          <div className="pr-4">
            <div className="text-xs font-semibold tracking-wide text-navy-400">
              GraphRAG 推理路徑
            </div>
            <h2 className="mt-1 text-[15px] font-semibold leading-6 text-brand">
              {question}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md p-1 text-navy-400 hover:bg-navy-50 hover:text-brand"
            aria-label="關閉"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
              <path
                d="m6 6 12 12M18 6 6 18"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </header>

        {/* 視角切換 */}
        <div className="flex items-center gap-1 border-b border-navy-100 px-5 py-2.5">
          <ViewToggle tech={tech} onChange={setTech} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!path ? (
            <p className="text-sm text-navy-400">此回答無圖譜查詢結果。</p>
          ) : tech ? (
            <TechView cyphers={cyphers} />
          ) : (
            <StepBar steps={path.steps} />
          )}
        </div>
      </aside>
    </div>
  );
}

function ViewToggle({ tech, onChange }) {
  const opts = [
    { id: false, label: "路徑視角" },
    { id: true, label: "技術視角" },
  ];
  return (
    <div className="inline-flex rounded-lg border border-navy-100 bg-navy-50 p-0.5">
      {opts.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          onClick={() => onChange(o.id)}
          className={[
            "rounded-md px-3 py-1 text-[13px] font-medium transition-colors",
            tech === o.id ? "bg-white text-brand shadow-sm" : "text-navy-400",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const NODE_COLORS = {
  intent: "bg-navy-100 text-navy-700",
  nodes: "bg-emerald-50 text-emerald-700",
  cases: "bg-rose-50 text-rose-700",
};

function StepBar({ steps }) {
  return (
    <ol className="relative space-y-4">
      {steps.map((step, i) => (
        <li key={step.type} className="relative pl-8">
          {/* 連接線 */}
          {i < steps.length - 1 && (
            <span className="absolute left-[11px] top-7 h-[calc(100%+0.25rem)] w-px bg-navy-100" />
          )}
          {/* 節點點 */}
          <span
            className={`absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
              NODE_COLORS[step.type] || "bg-navy-100 text-navy-700"
            }`}
          >
            {i + 1}
          </span>
          <StepBody step={step} />
        </li>
      ))}
    </ol>
  );
}

function StepBody({ step }) {
  return (
    <div className="rounded-lg border border-navy-100 bg-white p-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-brand">{step.node}</span>
        {typeof step.count === "number" && (
          <span className="rounded-full bg-navy-50 px-2 py-0.5 text-xs font-medium text-navy-500">
            {step.count} {step.unit || "項"}
          </span>
        )}
      </div>

      {step.type === "intent" && (
        <p className="mt-1.5 text-[13px] leading-6 text-navy-400">{step.label}</p>
      )}

      {step.items && (
        <ul className="mt-2 space-y-1.5">
          {step.items.slice(0, 8).map((it) => (
            <li
              key={it.name}
              className="flex items-center justify-between gap-3 text-[13px]"
            >
              <span className="truncate text-navy-700">{it.name}</span>
              <span className="shrink-0 text-navy-400">{it.count} {step.itemUnit || "項"}</span>
            </li>
          ))}
        </ul>
      )}

      {step.type === "cases" && <CaseList cases={step.cases} />}
    </div>
  );
}

function CaseList({ cases }) {
  const [open, setOpen] = useState(false);
  const shown = open ? cases.slice(0, 30) : cases.slice(0, 3);
  return (
    <div className="mt-2">
      <ul className="space-y-1.5">
        {shown.map((c) => (
          <li
            key={c.id}
            className="rounded-md border border-navy-100 bg-navy-50/60 px-2.5 py-2 text-[12px]"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate font-medium text-navy-700">
                {c.company}
              </span>
              <span className="shrink-0 text-navy-400">{c.date}</span>
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-2 text-navy-400">
              <span className="truncate">{c.law}</span>
              <span className="shrink-0">{formatAmount(c.amount)}</span>
            </div>
          </li>
        ))}
      </ul>
      {cases.length > 3 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="mt-2 text-[12px] font-medium text-brand-soft hover:text-brand"
        >
          {open ? "收合案例" : `展開全部 ${cases.length} 件案例`}
        </button>
      )}
    </div>
  );
}

function TechView({ cyphers }) {
  return (
    <div className="space-y-4">
      <p className="text-[13px] leading-6 text-navy-400">
        以下為本次回答實際對知識圖譜執行的 Cypher 查詢。
      </p>
      {(cyphers || []).map((cy) => (
        <div key={cy.id}>
          <div className="text-[13px] font-semibold text-brand">{cy.title}</div>
          <pre className="mt-1.5 overflow-x-auto rounded-lg bg-navy-900 p-3 text-[11px] leading-relaxed text-navy-100">
            {cy.cypher}
          </pre>
          <div className="mt-1 text-[12px] text-navy-400">
            回傳 {cy.data?.length || 0} 列
          </div>
        </div>
      ))}
    </div>
  );
}
