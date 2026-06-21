// 案件調查。左欄:歷史報告列表(風險燈號隨行動清單完成度更新)。
// 主區:三步表單 → 結構化四區塊報告(依身分分流)。
//   資方:案件摘要 / 法定義務時間軸(規則引擎算期限,可勾選)/ 風險定價(cyphers 聚合)/ 應備文件清單
//   勞工:案件摘要 / 權益主張清單(給付・救濟・時效)/ 風險定價 / 應備佐證文件
//   資遣情境:區塊二內嵌資遣費 + 預告期試算器。
// 可由智能問答「立案調查並生成報告」CTA 帶 state 預填多欄位;報告可「就此案件繼續諮詢」回對話。
import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { scenarios, scenarioById, ROLES } from "../data/scenarios.js";
import { investigateForms, assessRisk } from "../data/investigateForms.js";
import { documents } from "../data/documents.js";
import { claims } from "../data/claims.js";
import { useAppState } from "../state/AppState.jsx";
import { computeTimeline, formatDue } from "../lib/deadlines.js";
import { calcSeverance, fmtMoney } from "../lib/severance.js";
import { aggregateCyphers, aggregateHighRiskLaws, fmtAmount } from "../lib/riskPricing.js";
import { linkifyLawText } from "../lib/extractLaws.js";
import { recomputeRisk } from "../lib/recomputeRisk.js";
import { buildReportPrompt } from "../lib/reportPrompt.js";
import { parseCitations } from "../lib/parseCitations.js";
import { askStream } from "../services/askStream.js";
import MarkdownView from "../features/chat/MarkdownView.jsx";
import ProgressLine from "../features/chat/ProgressLine.jsx";
import SidebarNav from "../components/SidebarNav.jsx";

const RISK_BADGE = {
  高: "bg-rose-50 text-rose-700 border-rose-200",
  中: "bg-amber-50 text-amber-700 border-amber-200",
  低: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

// 報告的行動清單(可勾選項),用於計算完成度與燈號重算訊號。
function collectChecklist(report) {
  const items = [];
  if (report.role === "employer") {
    const timeline = computeTimeline(report.scenarioId, report.values, report.completed || {});
    for (const t of timeline) {
      items.push({ id: t.id, overdue: t.status === "overdue" });
    }
  }
  const docList = documents[report.scenarioId]?.[report.role] || [];
  docList.forEach((_, i) => items.push({ id: `doc:${i}`, overdue: false }));
  return items;
}

function computeDisplayRisk(report) {
  const items = collectChecklist(report);
  const completed = report.completed || {};
  const allDone = items.length > 0 && items.every((i) => completed[i.id]);
  const hasOverdueIncomplete = items.some((i) => i.overdue && !completed[i.id]);
  return recomputeRisk(report.baseRisk || report.riskLevel, { allDone, hasOverdueIncomplete });
}

export default function InvestigatePage() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const { role, setRole, reports, setReports } = useAppState();

  const [mode, setMode] = useState("form"); // form | report
  const [viewingId, setViewingId] = useState(null); // 檢視中的歷史報告 id
  const [cameFromChat, setCameFromChat] = useState(false); // 由智能問答 CTA 帶入 → 顯示返回橫條
  const [step, setStep] = useState(1);
  const [scenarioId, setScenarioId] = useState(null);
  const [values, setValues] = useState({});
  const [draft, setDraft] = useState(null); // 生成但未存的報告
  // 報告生成的串流狀態(與報告物件分離,避免逐字更新覆寫勾選狀態)。
  const [gen, setGen] = useState({ status: "idle", progress: "analysing", streamedText: "" });

  const streamRef = useRef(null);
  const bufRef = useRef("");
  const flushRef = useRef(null);

  function stopFlush() {
    if (flushRef.current) {
      clearInterval(flushRef.current);
      flushRef.current = null;
    }
  }
  function stopStream() {
    streamRef.current?.cancel();
    streamRef.current = null;
    stopFlush();
  }

  useEffect(() => () => stopStream(), []); // 卸載時取消串流

  // 從智能問答 CTA 帶入的預填(scenarioId + 解析後多欄位 + 原始 question)。
  useEffect(() => {
    if (!state?.scenarioId) return;
    const sid = state.scenarioId;
    setScenarioId(sid);
    const prefillField = investigateForms[sid]?.fields.find((f) => f.prefillTarget);
    const merged = { ...(state.prefill || {}) };
    if (prefillField && state.question) merged[prefillField.key] = state.question;
    setValues(merged);
    setStep(2);
    setMode("form");
    setViewingId(null);
    setDraft(null);
    setCameFromChat(true);
  }, [state]);

  function setValue(key, val) {
    setValues((v) => ({ ...v, [key]: val }));
  }

  function generate() {
    const baseRisk = assessRisk(scenarioId, values);
    const base = {
      id: `RPT-${Date.now().toString().slice(-6)}`,
      scenarioId,
      role,
      title: buildTitle(scenarioId, values),
      date: new Date().toISOString().slice(0, 10),
      baseRisk,
      completed: {},
      values,
      apiResult: null, // 完整 Markdown 回應
      apiBody: null, // 去標註段後的研判段落(案件摘要渲染用)
      apiCyphers: null, // 風險定價聚合來源
    };
    base.riskLevel = computeDisplayRisk(base);
    setDraft(base);
    setStep(3);
    runGeneration(base);
  }

  // 送結構化 prompt 到 ask API,串流研判段落 + 取回 cyphers。失敗則退回本地研判。
  function runGeneration(report) {
    stopStream();
    setGen({ status: "streaming", progress: "analysing", streamedText: "" });
    bufRef.current = "";
    flushRef.current = setInterval(() => {
      setGen((g) => (g.status === "streaming" ? { ...g, streamedText: bufRef.current } : g));
    }, 60);

    streamRef.current = askStream(
      {
        question: buildReportPrompt(report.scenarioId, report.values),
        role: report.role,
        scenario: report.scenarioId,
      },
      {
        onProgress: (progress) => setGen((g) => ({ ...g, progress })),
        onChunk: (delta) => {
          bufRef.current += delta;
        },
        onDone: (final) => {
          stopFlush();
          const parsed = parseCitations(final.result || "");
          setDraft((d) =>
            d && d.id === report.id
              ? { ...d, apiResult: final.result, apiBody: parsed.body, apiCyphers: final.cyphers || [] }
              : d
          );
          setGen({ status: "done", progress: "generating answer", streamedText: bufRef.current });
          streamRef.current = null;
        },
        onError: () => {
          stopFlush();
          // 退回本地研判:案件摘要用 buildSummary,風險定價用靜態聚合。
          setDraft((d) =>
            d && d.id === report.id
              ? { ...d, apiResult: null, apiBody: buildSummary(report.scenarioId, report.values), apiCyphers: null }
              : d
          );
          setGen({ status: "offline", progress: "", streamedText: "" });
          streamRef.current = null;
        },
      }
    );
  }

  function saveReport() {
    if (!draft) return;
    setReports((r) => [draft, ...r]);
    setViewingId(draft.id);
    setMode("report");
    setDraft(null);
  }

  function resetForm() {
    stopStream();
    setGen({ status: "idle", progress: "analysing", streamedText: "" });
    setStep(1);
    setScenarioId(null);
    setValues({});
    setDraft(null);
    setMode("form");
    setViewingId(null);
    setCameFromChat(false);
  }

  // 勾選行動項 → 更新 completed + 重算燈號,寫回 draft 或 reports。
  function toggleCompleted(report, itemId, value) {
    const completed = { ...(report.completed || {}), [itemId]: value };
    const next = { ...report, completed };
    next.riskLevel = computeDisplayRisk(next);
    if (draft && report.id === draft.id) setDraft(next);
    else setReports((rs) => rs.map((r) => (r.id === report.id ? next : r)));
  }

  function continueConsult(report) {
    navigate("/chat", {
      state: {
        caseContext: {
          reportId: report.id,
          scenarioId: report.scenarioId,
          title: report.title,
          summary: buildSummary(report.scenarioId, report.values),
        },
      },
    });
  }

  const current = mode === "report" ? reports.find((r) => r.id === viewingId) : null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* 左欄:全高側欄(導覽 + 報告身分 + 歷史報告) */}
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-navy-100 bg-white">
        <SidebarNav />
        <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
          <div className="mb-1.5 px-1 text-[11px] font-medium text-navy-400">報告身分</div>
          <RoleToggle role={role} onChange={setRole} />

          <button
            type="button"
            onClick={resetForm}
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
            新增調查
          </button>
          <div className="mt-4 px-1 text-xs font-semibold tracking-wide text-navy-400">歷史報告</div>
          <div className="mt-2 min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            {reports.length === 0 && (
              <p className="px-1 py-2 text-[12px] leading-5 text-navy-300">
                尚無報告,從上方「新增調查」開始建立。
              </p>
            )}
            {reports.map((r) => {
              const active = mode === "report" && viewingId === r.id;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => {
                    setViewingId(r.id);
                    setMode("report");
                    setCameFromChat(false);
                  }}
                  className={[
                    "w-full rounded-lg border p-3 text-left transition-colors",
                    active ? "border-brand bg-navy-50" : "border-navy-100 bg-white hover:border-navy-200",
                  ].join(" ")}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13px] font-medium leading-5 text-brand">{r.title}</span>
                    <RiskBadge level={r.riskLevel} small />
                  </div>
                  <div className="mt-1.5 flex items-center gap-2 text-[11px] text-navy-400">
                    <span className="rounded bg-navy-50 px-1.5 py-0.5">
                      {scenarioById[r.scenarioId]?.title}
                    </span>
                    <span>{r.date}</span>
                    {r.role && <RoleTag role={r.role} />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      {/* 主區 */}
      <section className="min-w-0 flex-1 overflow-y-auto px-6 py-6">
        {cameFromChat && (
          <ReturnToChatBar onBack={() => navigate("/chat")} note="此調查由智能問答帶入" />
        )}
        {mode === "report" && current ? (
          <ReportView
            report={current}
            onBack={resetForm}
            onToggle={(id, v) => toggleCompleted(current, id, v)}
            onContinue={() => continueConsult(current)}
          />
        ) : (
          <FormFlow
            step={step}
            setStep={setStep}
            scenarioId={scenarioId}
            setScenarioId={setScenarioId}
            values={values}
            setValue={setValue}
            onGenerate={generate}
            draft={draft}
            generation={gen}
            onSave={saveReport}
            onReset={resetForm}
            prefillQuestion={state?.question}
            onToggle={(id, v) => draft && toggleCompleted(draft, id, v)}
            onContinue={() => draft && continueConsult(draft)}
            onRetry={() => draft && runGeneration(draft)}
          />
        )}
      </section>
    </div>
  );
}

// 返回橫條:回到剛才帶入此調查的那段對話(原對話一直保留,activeConvId 未變)。
function ReturnToChatBar({ onBack, note }) {
  return (
    <div className="sticky top-0 z-10 mb-4 flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-navy-50 px-4 py-2.5">
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

function FormFlow({
  step,
  setStep,
  scenarioId,
  setScenarioId,
  values,
  setValue,
  onGenerate,
  draft,
  generation,
  onSave,
  onReset,
  prefillQuestion,
  onToggle,
  onContinue,
  onRetry,
}) {
  const streaming = generation?.status === "streaming";
  return (
    <div>
      <Stepper step={step} />

      {step === 1 && (
        <div className="mt-6">
          <h2 className="text-base font-semibold text-brand">選擇情境類型</h2>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {scenarios.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  setScenarioId(s.id);
                  setStep(2);
                }}
                className={[
                  "rounded-xl border p-4 text-left transition-colors",
                  scenarioId === s.id
                    ? "border-brand bg-navy-50"
                    : "border-navy-100 bg-white hover:border-navy-200",
                ].join(" ")}
              >
                <div className="text-sm font-semibold text-brand">{s.title}</div>
                <div className="text-[11px] text-navy-400">{s.subtitle}</div>
                <p className="mt-1.5 text-[12px] leading-5 text-navy-400">{s.desc}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && scenarioId && (
        <FieldForm
          scenarioId={scenarioId}
          values={values}
          setValue={setValue}
          onBack={() => setStep(1)}
          onGenerate={onGenerate}
          prefillQuestion={prefillQuestion}
        />
      )}

      {step === 3 && draft && (
        <div className="mt-6">
          <ReportBody report={draft} onToggle={onToggle} generation={generation} onRetry={onRetry} />
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={onSave}
              disabled={streaming}
              className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {streaming ? "研判中…" : "存為報告"}
            </button>
            <button
              type="button"
              onClick={onContinue}
              className="rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-navy-50"
            >
              就此案件報告繼續諮詢
            </button>
            <button
              type="button"
              onClick={() => setStep(2)}
              className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
            >
              返回修改
            </button>
            <button
              type="button"
              onClick={onReset}
              className="rounded-lg px-4 py-2 text-sm font-medium text-navy-400 hover:text-brand"
            >
              重新填寫
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function FieldForm({ scenarioId, values, setValue, onBack, onGenerate, prefillQuestion }) {
  const form = investigateForms[scenarioId];
  return (
    <div className="mt-6 max-w-2xl">
      <h2 className="text-base font-semibold text-brand">{form.title} · 填寫參數</h2>

      {prefillQuestion && (
        <div className="mt-3 rounded-lg border border-navy-100 bg-navy-50 px-3 py-2 text-[13px] text-navy-700">
          來自智能問答:{prefillQuestion}
        </div>
      )}

      <div className="mt-4 space-y-4">
        {form.fields.map((f) => (
          <Field key={f.key} field={f} value={values[f.key]} onChange={(v) => setValue(f.key, v)} />
        ))}
      </div>

      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-lg border border-navy-200 px-4 py-2 text-sm font-medium text-navy-700 hover:bg-navy-50"
        >
          上一步
        </button>
        <button
          type="button"
          onClick={onGenerate}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          生成報告
        </button>
      </div>
    </div>
  );
}

function Field({ field, value, onChange }) {
  const base =
    "w-full rounded-lg border border-navy-200 bg-white px-3 py-2 text-sm text-navy-800 outline-none focus:border-brand";
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-navy-700">{field.label}</span>

      {field.type === "select" && (
        <select className={base} value={value || ""} onChange={(e) => onChange(e.target.value)}>
          <option value="">請選擇…</option>
          {field.options.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      )}

      {field.type === "radio" && (
        <div className="flex gap-4 pt-1">
          {field.options.map((o) => (
            <label key={o} className="inline-flex items-center gap-1.5 text-sm text-navy-700">
              <input
                type="radio"
                name={field.key}
                checked={value === o}
                onChange={() => onChange(o)}
                className="accent-[#1e3a5f]"
              />
              {o}
            </label>
          ))}
        </div>
      )}

      {field.type === "multi" && (
        <div className="flex flex-wrap gap-3 pt-1">
          {field.options.map((o) => {
            const arr = Array.isArray(value) ? value : [];
            const on = arr.includes(o);
            return (
              <label key={o} className="inline-flex items-center gap-1.5 text-sm text-navy-700">
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => onChange(on ? arr.filter((x) => x !== o) : [...arr, o])}
                  className="accent-[#1e3a5f]"
                />
                {o}
              </label>
            );
          })}
        </div>
      )}

      {field.type === "textarea" && (
        <textarea
          className={`${base} min-h-24 resize-y`}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder="請簡述…"
        />
      )}

      {(field.type === "text" || field.type === "date" || field.type === "number") && (
        <input
          type={field.type}
          className={base}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </label>
  );
}

function Stepper({ step }) {
  const steps = ["選情境", "填參數", "生成報告"];
  return (
    <div className="flex items-center gap-3">
      {steps.map((label, i) => {
        const n = i + 1;
        const done = step > n;
        const on = step === n;
        return (
          <div key={label} className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                  on ? "bg-brand text-white" : done ? "bg-navy-100 text-brand" : "bg-navy-50 text-navy-300",
                ].join(" ")}
              >
                {n}
              </span>
              <span className={on ? "text-sm font-medium text-brand" : "text-sm text-navy-400"}>
                {label}
              </span>
            </div>
            {n < steps.length && <span className="h-px w-8 bg-navy-100" />}
          </div>
        );
      })}
    </div>
  );
}

function ReportView({ report, onBack, onToggle, onContinue }) {
  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-navy-400 hover:text-brand">
        ← 新增調查
      </button>
      <div className="mt-3">
        <ReportBody report={report} onToggle={onToggle} />
        <div className="mt-5">
          <button
            type="button"
            onClick={onContinue}
            className="inline-flex items-center gap-2 rounded-lg border border-brand px-4 py-2 text-sm font-medium text-brand hover:bg-navy-50"
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <path
                d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.38 8.38 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.38 8.38 0 0 1 21 11.5z"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            就此案件報告繼續諮詢
          </button>
        </div>
      </div>
    </div>
  );
}

function ReportBody({ report, onToggle, generation, onRetry }) {
  const isWorker = report.role === "worker";
  const isDismissal = report.scenarioId === "dismissal";
  const isRadar = report.scenarioId === "radar";
  const pricingLoading = generation?.status === "streaming";

  return (
    <article className="rounded-xl border border-navy-100 bg-white p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-xs text-navy-400">
            {scenarioById[report.scenarioId]?.title} · {report.date} · {report.id}
          </div>
          <h1 className="mt-1 text-xl font-bold text-brand">{report.title}</h1>
          <div className="mt-1.5">
            <RoleTag role={report.role} />
          </div>
        </div>
        <RiskBadge level={report.riskLevel} />
      </div>

      {/* 區塊一:案件摘要(AI 研判,串流) */}
      <SummaryBlock report={report} generation={generation} onRetry={onRetry} />

      {/* 區塊二:
          - 勞工:權益主張清單
          - 資方 · 雷達:風險盤點(高風險法條,無具體事故日,不套用時間軸)
          - 資方 · 職災/資遣:法定義務時間軸 */}
      {isWorker ? (
        <ClaimsBlock report={report} />
      ) : isRadar ? (
        <RiskInventoryBlock cyphers={report.apiCyphers} loading={pricingLoading} />
      ) : (
        <TimelineBlock report={report} onToggle={onToggle} />
      )}

      {/* 資遣試算器(兩種身分皆內嵌於區塊二之後) */}
      {isDismissal && <SeveranceCalculator values={report.values} role={report.role} />}

      {/* 區塊三:風險定價(只吃 API 回傳的真實 cyphers;無資料則不顯示數字) */}
      <RiskPricingBlock role={report.role} cyphers={report.apiCyphers} loading={pricingLoading} />

      {/* 區塊四:應備文件清單 */}
      <DocumentsBlock report={report} onToggle={onToggle} />

      {/* 參數明細(輔助,可參) */}
      <ParamDetails report={report} />
    </article>
  );
}

// 案件摘要:串流中逐字渲染 AI 研判;完成後渲染去標註段的本文;離線退回本地摘要 + 重試。
function SummaryBlock({ report, generation, onRetry }) {
  const status = generation?.status;
  const streaming = status === "streaming";
  const offline = status === "offline";
  const fallback = useMemo(
    () => buildSummary(report.scenarioId, report.values),
    [report.scenarioId, report.values]
  );

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-2">
        <SectionTitle>案件摘要 · AI 研判</SectionTitle>
        {offline && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md border border-navy-200 px-2.5 py-1 text-[12px] font-medium text-navy-700 hover:bg-navy-50"
          >
            重試
          </button>
        )}
      </div>

      {streaming ? (
        <div className="mt-2 text-[14px] leading-7 text-navy-700">
          {generation.streamedText ? (
            <>
              <MarkdownView>{generation.streamedText}</MarkdownView>
              <span className="stream-caret text-navy-400">▍</span>
            </>
          ) : (
            <ProgressLine progress={generation.progress} />
          )}
        </div>
      ) : (
        <div className="mt-2 text-[14px] leading-7 text-navy-700">
          {offline && (
            <div className="mb-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] text-amber-700">
              離線研判:未取得 AI 回應,以下為本地規則摘要。
            </div>
          )}
          <MarkdownView>{report.apiBody || fallback}</MarkdownView>
        </div>
      )}
    </section>
  );
}

const STATUS_STYLE = {
  overdue: { wrap: "border-rose-200 bg-rose-50", label: "已逾期", chip: "bg-rose-100 text-rose-700" },
  urgent: { wrap: "border-amber-200 bg-amber-50", label: "緊急", chip: "bg-amber-100 text-amber-700" },
  upcoming: { wrap: "border-navy-100 bg-white", label: "待辦", chip: "bg-navy-50 text-navy-500" },
  done: { wrap: "border-emerald-200 bg-emerald-50", label: "已完成", chip: "bg-emerald-100 text-emerald-700" },
  unknown: { wrap: "border-navy-100 bg-white", label: "待設定", chip: "bg-navy-50 text-navy-400" },
};

function TimelineBlock({ report, onToggle }) {
  const timeline = useMemo(
    () => computeTimeline(report.scenarioId, report.values, report.completed || {}),
    [report.scenarioId, report.values, report.completed]
  );
  if (!timeline.length) return null;

  return (
    <section className="mt-6">
      <SectionTitle>法定義務時間軸</SectionTitle>
      <ol className="mt-3 space-y-2">
        {timeline.map((t) => {
          const s = STATUS_STYLE[t.status] || STATUS_STYLE.upcoming;
          const done = t.status === "done";
          const checked = !!(report.completed || {})[t.id];
          return (
            <li key={t.id} className={`flex items-start gap-3 rounded-lg border px-3.5 py-3 ${s.wrap}`}>
              <input
                type="checkbox"
                checked={checked}
                onChange={(e) => onToggle?.(t.id, e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#1e3a5f]"
                aria-label={`標記完成:${t.label}`}
              />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`text-[14px] font-medium ${done ? "text-navy-400 line-through" : "text-brand"}`}>
                    {t.label}
                  </span>
                  <KindTag kind={t.kind} />
                  <span className="rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-400">
                    <LawRefText text={t.lawRef} />
                  </span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${s.chip}`}>
                    {s.label}
                    {!done && t.status === "urgent" && t.daysLeft != null && ` · 倒數 ${Math.max(0, t.daysLeft)} 天`}
                    {!done && t.status === "overdue" && t.daysLeft != null && ` · 已過 ${Math.abs(t.daysLeft)} 天`}
                  </span>
                </div>
                <div className="mt-1 text-[12px] leading-5 text-navy-500">{t.desc}</div>
                <div className="mt-1 text-[12px] text-navy-400">
                  {t.kind === "法定期限" ? "法定期限" : "建議完成"}:{formatDue(t.dueDate, t.offset)}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
      <p className="mt-2 text-[11px] leading-5 text-navy-400">
        「法定期限」依現行法條推算;「建議時程」為合規操作建議,非法定到期日。期限僅供參考,以主管機關公告為準。
      </p>
    </section>
  );
}

// 把含法條引用的字串渲染成文字 + 官方原文連結(有 pcode 者)。
function LawRefText({ text }) {
  const segs = useMemo(() => linkifyLawText(text), [text]);
  return (
    <>
      {segs.map((s, i) =>
        typeof s === "string" ? (
          <span key={i}>{s}</span>
        ) : (
          <a
            key={i}
            href={s.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-brand underline decoration-dotted underline-offset-2 hover:decoration-solid"
            title="查看全國法規資料庫官方原文"
          >
            {s.text}
          </a>
        )
      )}
    </>
  );
}

function KindTag({ kind }) {
  if (!kind) return null;
  const isStatutory = kind === "法定期限";
  return (
    <span
      className={[
        "rounded px-1.5 py-0.5 text-[11px] font-medium",
        isStatutory ? "bg-brand/10 text-brand" : "bg-navy-50 text-navy-400",
      ].join(" ")}
    >
      {isStatutory ? "法定" : "建議"}
    </span>
  );
}

function ClaimsBlock({ report }) {
  const c = claims[report.scenarioId];
  if (!c) return null;
  const cols = [
    { title: "可主張給付項目", items: c.payments },
    { title: "救濟管道", items: c.remedies },
    { title: "請求權時效", items: c.limitations, linkify: true },
  ];
  return (
    <section className="mt-6">
      <SectionTitle>權益主張清單</SectionTitle>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
        {cols.map((col) => (
          <div key={col.title} className="rounded-lg border border-navy-100 bg-navy-50/40 p-3.5">
            <div className="text-[13px] font-semibold text-brand">{col.title}</div>
            <ul className="mt-2 space-y-1.5">
              {col.items.map((it, i) => (
                <li key={i} className="flex gap-2 text-[12px] leading-5 text-navy-700">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-navy-300" />
                  <span>{col.linkify ? <LawRefText text={it} /> : it}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// 風險盤點(雷達情境取代時間軸):依 cyphers 聚合高風險法條 Top N。
function RiskInventoryBlock({ cyphers, loading }) {
  const laws = useMemo(
    () => (cyphers && cyphers.length ? aggregateHighRiskLaws(cyphers, 6) : []),
    [cyphers]
  );

  if (loading) {
    return (
      <section className="mt-6">
        <SectionTitle>風險盤點 · 同業高風險項目</SectionTitle>
        <div className="mt-3 space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-navy-50" />
          ))}
        </div>
        <p className="mt-2 text-[11px] text-navy-400">正在盤點同類裁罰案例的高風險法條…</p>
      </section>
    );
  }

  return (
    <section className="mt-6">
      <SectionTitle>風險盤點 · 同業高風險項目</SectionTitle>
      {laws.length === 0 ? (
        <p className="mt-2 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-[13px] text-navy-400">
          本次未取得相似裁罰案例資料,無法盤點高風險法條;可參考下方裁罰趨勢與應備內控文件清單。
        </p>
      ) : (
        <ol className="mt-3 space-y-2">
          {laws.map((l, i) => (
            <li
              key={l.display}
              className="flex items-center gap-3 rounded-lg border border-navy-100 bg-white px-3.5 py-2.5"
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-navy-50 text-[12px] font-bold text-brand">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 text-[14px] font-medium text-brand">
                <LawRefText text={l.display} />
              </span>
              <span className="shrink-0 rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                {l.caseCount} 件裁罰
              </span>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] leading-5 text-navy-400">
        高風險法條依本次查詢之同類裁罰案例聚合(取自查詢結果、非全量圖譜);裁罰金額趨勢見下方「風險定價」,建議內控見「應備文件清單」。
      </p>
    </section>
  );
}

function RiskPricingBlock({ role, cyphers, loading }) {
  const isWorker = role === "worker";
  const title = isWorker ? "風險定價(同業違規 / 求償參考)" : "風險定價(裁罰風險估算)";
  const agg = useMemo(
    () => (cyphers && cyphers.length ? aggregateCyphers(cyphers) : null),
    [cyphers]
  );

  if (loading) {
    return (
      <section className="mt-6">
        <SectionTitle>{title}</SectionTitle>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-lg border border-navy-100 bg-navy-50/40 p-3.5 text-center">
              <div className="mx-auto h-2.5 w-16 animate-pulse rounded bg-navy-100" />
              <div className="mx-auto mt-2 h-5 w-20 animate-pulse rounded bg-navy-100" />
            </div>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-navy-400">正在聚合相似裁罰案例…</p>
      </section>
    );
  }

  // 無真實 cyphers → 不顯示數字,誠實標示(不造假)。
  if (!agg || agg.count === 0) {
    return (
      <section className="mt-6">
        <SectionTitle>{title}</SectionTitle>
        <p className="mt-2 rounded-lg border border-dashed border-navy-200 bg-navy-50/40 px-4 py-3 text-[13px] text-navy-400">
          本次未取得相似裁罰案例資料,略過風險定價。
        </p>
      </section>
    );
  }

  const stats = [
    { label: "同類裁罰案例", value: `${agg.count}`, unit: "件" },
    { label: "罰鍰中位數", value: fmtAmount(agg.median), unit: "元" },
    { label: "最高裁罰", value: fmtAmount(agg.max), unit: "元" },
  ];
  // 誠實描述聚合範圍:取自該次查詢結果(非全量圖譜),依回傳之事故類型標示。
  const types = agg.accidentTypes || [];
  const sourceNote =
    types.length === 1
      ? `統計來源:平台收錄之「${types[0]}」同類型裁罰案例聚合(取自本次查詢結果,非全量圖譜統計)。`
      : types.length > 1
      ? `統計來源:平台收錄之同類型裁罰案例聚合,本次查詢涵蓋 ${types.length} 種事故類型(${types.join(
          "、"
        )});取自查詢結果、非全量圖譜統計。`
      : "統計來源:平台收錄之同類型裁罰案例聚合(取自本次查詢結果,非全量圖譜統計)。";
  return (
    <section className="mt-6">
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-3 grid grid-cols-3 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-lg border border-navy-100 bg-white p-3.5 text-center">
            <div className="text-[11px] text-navy-400">{s.label}</div>
            <div className="mt-1 text-lg font-bold text-brand">{s.value}</div>
            <div className="text-[11px] text-navy-400">{s.unit}</div>
          </div>
        ))}
      </div>
      {agg.top.length > 0 && (
        <div className="mt-3 overflow-hidden rounded-lg border border-navy-100">
          <table className="w-full text-left text-[12px]">
            <thead className="bg-navy-50 text-navy-400">
              <tr>
                <th className="px-3 py-2 font-medium">代表案例</th>
                <th className="px-3 py-2 font-medium">處分日期</th>
                <th className="px-3 py-2 font-medium">違反法條</th>
                <th className="px-3 py-2 text-right font-medium">處分金額</th>
              </tr>
            </thead>
            <tbody>
              {agg.top.map((r, i) => (
                <tr key={i} className="border-t border-navy-100 text-navy-700">
                  <td className="px-3 py-2">{r.company}</td>
                  <td className="px-3 py-2 text-navy-400">{r.date}</td>
                  <td className="px-3 py-2 text-navy-400">{r.law}</td>
                  <td className="px-3 py-2 text-right font-medium">{fmtAmount(r.amount)} 元</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-2 text-[11px] leading-5 text-navy-400">
        {sourceNote}未依產業精準篩選,實際以提問與資料範圍為準。
      </p>
    </section>
  );
}

function DocumentsBlock({ report, onToggle }) {
  const docs = documents[report.scenarioId]?.[report.role] || [];
  if (!docs.length) return null;
  const isWorker = report.role === "worker";
  const completed = report.completed || {};
  return (
    <section className="mt-6">
      <SectionTitle>{isWorker ? "應備佐證文件" : "應備文件清單"}</SectionTitle>
      <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {docs.map((d, i) => {
          const key = `doc:${i}`;
          const checked = !!completed[key];
          return (
            <li key={key}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg border border-navy-100 bg-white px-3 py-2.5 hover:border-navy-200">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => onToggle?.(key, e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#1e3a5f]"
                />
                <span className="min-w-0 flex-1">
                  <span className={`text-[13px] ${checked ? "text-navy-400 line-through" : "text-navy-700"}`}>
                    {d.label}
                  </span>
                  <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
                    <KindTag kind={d.kind === "法定" ? "法定期限" : "建議時程"} />
                    {d.lawRef && (
                      <span className="text-[11px] text-navy-400">
                        <LawRefText text={d.lawRef} />
                      </span>
                    )}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[11px] leading-5 text-navy-400">
        「法定」為法律明文要求置備 / 發給,或勞工得依法請求取得之文件;「建議」為主張或舉證時建議準備的佐證,非法定特定文件,不一定每案都需要。實際應備文件以個案與主管機關要求為準。
      </p>
    </section>
  );
}

function SeveranceCalculator({ values, role }) {
  const r = useMemo(() => calcSeverance(values), [values]);
  const isWorker = role === "worker";
  const systemLabel = r.isOldSystem ? "勞退舊制" : "勞退新制";
  const rateLabel = r.isOldSystem ? "1 月/年" : "0.5 月/年";
  const rows = [
    { label: "計算年資", value: `${r.years.toFixed(2)} 年` },
    {
      label: `資遣費月數(${systemLabel} ${rateLabel})`,
      value: `${r.monthsOfSeverance.toFixed(2)} 個月${r.capped ? "(已達 6 月上限)" : ""}`,
    },
    { label: isWorker ? "可請求資遣費" : "應給付資遣費", value: fmtMoney(r.severancePay), strong: true },
    { label: "法定預告期", value: `${r.noticeDays} 日` },
    {
      label: r.noticed ? "預告工資(已預告)" : isWorker ? "可請求預告工資" : "應給付預告工資",
      value: r.noticed ? "—(已完成預告)" : fmtMoney(r.noticeWageDue),
    },
    { label: "謀職假", value: `${r.jobSeekingLeaveDays} 日(預告期間每週 2 日)` },
  ];
  return (
    <section className="mt-4 rounded-lg border border-navy-100 bg-navy-50/40 p-4">
      <div className="text-[13px] font-semibold text-brand">資遣費 / 預告期試算 · {systemLabel}</div>
      <dl className="mt-2 grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-2 text-[13px]">
            <dt className="text-navy-400">{row.label}</dt>
            <dd className={row.strong ? "font-bold text-brand" : "text-navy-700"}>{row.value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-[11px] leading-5 text-navy-400">
        {r.isOldSystem
          ? "勞退舊制(勞基法 §17):每滿 1 年發 1 個月平均工資,無上限。"
          : "勞退新制(勞退條例 §12):每滿 1 年發 0.5 個月平均工資,上限 6 個月。"}
        預告期依年資 10 / 20 / 30 日。試算僅供參考。
      </p>
    </section>
  );
}

function ParamDetails({ report }) {
  const form = investigateForms[report.scenarioId];
  return (
    <details className="mt-6 rounded-lg border border-navy-100 bg-white">
      <summary className="cursor-pointer px-4 py-2.5 text-[13px] font-medium text-navy-500">
        填寫參數明細
      </summary>
      <dl className="grid grid-cols-1 gap-x-6 gap-y-2 px-4 pb-4 sm:grid-cols-2">
        {form.fields.map((f) => {
          const v = report.values[f.key];
          if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
          return (
            <div key={f.key} className="flex gap-2 text-[13px]">
              <dt className="shrink-0 text-navy-400">{f.label}:</dt>
              <dd className="text-navy-700">{Array.isArray(v) ? v.join("、") : v}</dd>
            </div>
          );
        })}
      </dl>
    </details>
  );
}

function SectionTitle({ children }) {
  return <h2 className="text-sm font-semibold tracking-wide text-navy-500">{children}</h2>;
}

function RiskBadge({ level, small }) {
  return (
    <span
      className={[
        "inline-flex shrink-0 items-center gap-1 rounded-full border font-medium",
        small ? "px-2 py-0.5 text-[11px]" : "px-3 py-1 text-sm",
        RISK_BADGE[level] || RISK_BADGE["中"],
      ].join(" ")}
    >
      風險 {level}
    </span>
  );
}

function RoleToggle({ role, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl border border-navy-100 bg-navy-50 p-1">
      {Object.values(ROLES).map((r) => {
        const on = role === r.id;
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => onChange(r.id)}
            className={[
              "rounded-lg px-2 py-1.5 text-[12px] font-medium transition-colors",
              on ? "bg-white text-brand shadow-sm" : "text-navy-400 hover:text-navy-700",
            ].join(" ")}
          >
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

function RoleTag({ role }) {
  const r = ROLES[role];
  if (!r) return null;
  return (
    <span className="inline-flex items-center rounded bg-navy-50 px-1.5 py-0.5 text-[11px] text-navy-500">
      {r.badge}
    </span>
  );
}

function buildTitle(scenarioId, v) {
  if (scenarioId === "occupational") return `${v.location || "事故"}・${v.severity || "職災"}案件`;
  if (scenarioId === "dismissal") return `${v.reason ? v.reason.split(" ")[0] : "資遣"}・資遣調查`;
  return "法規風險掃描";
}

function buildSummary(scenarioId, v) {
  if (scenarioId === "occupational") {
    return `${v.accidentDate || "(未填日期)"},一名「${v.employment || "未填受僱型態"}」員工於「${
      v.location || "未填地點"
    }」發生事故,傷害程度為「${v.severity || "未填"}」;目前${
      v.reported === "是" ? "已" : "尚未"
    }通報勞動檢查機構。${v.description ? "事故經過:" + v.description : ""}`;
  }
  if (scenarioId === "dismissal") {
    return `擬以勞動基準法「${v.reason || "未選事由"}」資遣年資 ${v.tenureYears || 0} 年 ${
      v.tenureMonths || 0
    } 個月之員工;${v.pip === "是" ? "已有" : "無"} PIP 績效改善紀錄,${
      v.advanceNotice === "是" ? "已" : "未"
    }預告,月平均工資 ${v.avgWage || "未填"} 元。${v.note ? "說明:" + v.note : ""}`;
  }
  return `${v.industry ? v.industry + "、" : ""}${v.companySize || "未填規模"}、採「${
    v.workSystem || "未填工時制度"
  }」之公司,關注面向:${
    Array.isArray(v.focus) && v.focus.length ? v.focus.join("、") : "未選"
  }。`;
}
