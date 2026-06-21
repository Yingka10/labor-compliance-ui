// 諮詢摘要產生器 —— 依身分分流成兩種「可帶著走去用」的文件:
//   資方 / HR → 「合規處理摘要」:該做什麼 + 依據哪條法 + 風險多大 + 留哪些文件,
//               讀起來像可歸檔 / 簽核的合規研判紀錄(盡職調查證明)。
//   勞工     → 「權益主張摘要」:有哪些權利 + 找哪個機關 + 時效多久 + 備什麼證據,
//               像一份帶去勞工局 / 申訴時可照著走的行動指南。
// 下一步一律做成可勾選清單(Markdown `- [ ]`),勾選能力跟著匯出的 PDF / Markdown 走。
// 內容複用既有結構化資產:obligations(法定義務)、claims(權益 / 時效)、documents(文件)、
//   actionGuide(救濟窗口);法條引用以官方原文連結輸出(匯出的文件也點得開)。
import { parseCitations } from "./parseCitations.js";
import { extractLaws, linkifyLawText } from "./extractLaws.js";
import { aggregateCyphers, fmtAmount } from "./riskPricing.js";
import { scenarioById, ROLES } from "../data/scenarios.js";
import { obligations } from "../data/obligations.js";
import { claims } from "../data/claims.js";
import { documents } from "../data/documents.js";
import { workerRemedies } from "../data/actionGuide.js";

// 把含法條引用的字串轉成 Markdown 連結(匯出的 PDF / MD 仍可點到官方原文)。
function mdLinkify(text) {
  return linkifyLawText(text)
    .map((s) => (typeof s === "string" ? s : `[${s.text}](${s.url})`))
    .join("");
}

function answeredTurns(conversation) {
  return (conversation?.messages || []).filter(
    (m) => m.role === "assistant" && m.status === "done" && m.final
  );
}

/**
 * 由對話產生身分分流的諮詢摘要。
 * @param {object} conversation { id, title, scenarioId, messages }
 * @param {string} role employer | worker
 * @returns {null | {id,title,docType,scenarioId,role,date,turnCount,lawCount,caseCount,markdown,plainSummary,laws,pricing}}
 */
export function buildConsultSummary(conversation, role) {
  const turns = answeredTurns(conversation);
  if (!turns.length) return null;

  const scenarioId = conversation.scenarioId;
  const scenarioTitle = scenarioById[scenarioId]?.title || "勞動法規諮詢";
  const roleLabel = ROLES[role]?.label || (role === "worker" ? "勞工" : "企業 / HR");
  const date = new Date().toISOString().slice(0, 10);
  const baseTitle = conversation.title || turns[0].question || `${scenarioTitle}諮詢`;
  const id = `SUM-${Date.now().toString().slice(-6)}`;
  const isWorker = role === "worker";
  const docType = isWorker ? "權益主張摘要" : "合規處理摘要";

  // 逐輪解析本文,彙整法條與裁罰案例(cyphers)。
  const allCyphers = [];
  const lawSeen = new Set();
  const laws = [];
  const qaBlocks = [];

  turns.forEach((t, i) => {
    const parsed = parseCitations(t.final.result);
    for (const l of extractLaws(t.final.cyphers, parsed.body, parsed.lawRefs)) {
      if (lawSeen.has(l.display)) continue;
      lawSeen.add(l.display);
      laws.push(l);
    }
    if (t.final.cyphers?.length) allCyphers.push(...t.final.cyphers);
    qaBlocks.push(
      [`### 問題 ${i + 1}`, `> ${(t.question || "").trim() || "(未記錄提問)"}`, "", parsed.body.trim() || "(無回答內容)"].join("\n")
    );
  });

  const pricing = allCyphers.length ? aggregateCyphers(allCyphers) : null;

  const ctx = { id, baseTitle, scenarioId, scenarioTitle, roleLabel, date, turnCount: turns.length, qaBlocks, laws, pricing };
  const markdown = isWorker ? workerMarkdown(ctx) : employerMarkdown(ctx);

  const plainSummary = [
    `${scenarioTitle}・${roleLabel}・${turns.length} 輪問答`,
    laws.length ? `引用法條:${laws.map((l) => l.display).join("、")}` : "",
    pricing?.count ? `同類裁罰案例 ${pricing.count} 件` : "",
  ]
    .filter(Boolean)
    .join(";");

  return {
    id,
    title: `${docType}:${baseTitle}`,
    docType,
    scenarioId,
    role,
    date,
    turnCount: turns.length,
    lawCount: laws.length,
    caseCount: pricing?.count || 0,
    markdown,
    plainSummary,
    laws,
    pricing,
  };
}

// 共用:抬頭。
function pushHeader(lines, ctx, note) {
  lines.push(`- 摘要編號:${ctx.id}`);
  lines.push(`- 情境:${ctx.scenarioTitle}`);
  lines.push(`- 身分:${ctx.roleLabel}`);
  lines.push(`- 日期:${ctx.date}`);
  lines.push(`- 問答輪數:${ctx.turnCount}`);
  lines.push("");
  lines.push(`> ${note}`);
  lines.push("");
}

// 共用:引用法條(連官方原文)。
function pushLaws(lines, laws) {
  if (!laws.length) return;
  lines.push("## 引用法條");
  lines.push("");
  for (const l of laws) lines.push(l.url ? `- [${l.display}](${l.url})` : `- ${l.display}`);
  lines.push("");
}

// 共用:裁罰案例(風險 / 求償參考)。
function pushPricing(lines, pricing, heading) {
  if (!pricing || pricing.count === 0) return;
  lines.push(`## ${heading}`);
  lines.push("");
  lines.push(
    `- 同類裁罰案例:${pricing.count} 件;罰鍰中位數 ${fmtAmount(pricing.median)} 元;最高 ${fmtAmount(pricing.max)} 元`
  );
  if (pricing.accidentTypes?.length) lines.push(`- 涵蓋事故類型:${pricing.accidentTypes.join("、")}`);
  if (pricing.top?.length) {
    lines.push("");
    lines.push("| 代表案例 | 處分日期 | 違反法條 | 處分金額 |");
    lines.push("| --- | --- | --- | --- |");
    for (const c of pricing.top) lines.push(`| ${c.company} | ${c.date || "—"} | ${c.law || "—"} | ${fmtAmount(c.amount)} 元 |`);
  }
  lines.push("（取自本次查詢之同類裁罰案例聚合,非全量圖譜;未依產業精準篩選。）");
  lines.push("");
}

// 資方 / HR:合規處理摘要。
function employerMarkdown(ctx) {
  const lines = [];
  lines.push(`# 合規處理摘要:${ctx.baseTitle}`);
  lines.push("");
  pushHeader(lines, ctx, `本摘要為依「${ctx.scenarioTitle}」之合規處理研判紀錄,供內部合規檔案留存與簽核參考。`);

  lines.push("## 案件研判");
  lines.push("");
  lines.push(ctx.qaBlocks.join("\n\n"));
  lines.push("");

  lines.push("## 應辦事項(合規檢查清單)");
  lines.push("");
  const obs = obligations[ctx.scenarioId] || [];
  if (obs.length) {
    for (const o of obs) {
      const ref = o.lawRef && o.lawRef !== "—" ? ` —— ${mdLinkify(o.lawRef)}` : "";
      lines.push(`- [ ] **${o.label}**${ref}(${o.kind})`);
      if (o.desc) lines.push(`  - ${o.desc}`);
    }
  } else {
    lines.push("- [ ] 本情境無固定事件期限;請依下方裁罰風險與應留存文件建置內控制度。");
  }
  lines.push("");

  pushPricing(lines, ctx.pricing, "裁罰風險");

  lines.push("## 應留存文件");
  lines.push("");
  const docs = documents[ctx.scenarioId]?.employer || [];
  for (const d of docs) {
    const ref = d.lawRef ? ` —— ${mdLinkify(d.lawRef)}` : "";
    lines.push(`- [ ] ${d.label}(${d.kind})${ref}`);
  }
  lines.push("");

  pushLaws(lines, ctx.laws);

  lines.push("---");
  lines.push("本摘要由小勞鼠依本次對話內容整理,「法定」項依現行法條,「建議」項為實務合規建議;僅供參考,實際以主管機關公告及官方法規原文為準,正式處理建議經法務複核。");
  return lines.join("\n");
}

// 勞工:權益主張摘要(行動指南)。
function workerMarkdown(ctx) {
  const lines = [];
  lines.push(`# 權益主張摘要:${ctx.baseTitle}`);
  lines.push("");
  pushHeader(lines, ctx, `本摘要整理你在「${ctx.scenarioTitle}」可主張的權益與行動管道,供申訴、調解或申請給付時參考。`);

  lines.push("## 諮詢重點");
  lines.push("");
  lines.push(ctx.qaBlocks.join("\n\n"));
  lines.push("");

  const c = claims[ctx.scenarioId];
  if (c?.payments?.length) {
    lines.push("## 可主張權益 / 給付項目");
    lines.push("");
    for (const p of c.payments) lines.push(`- [ ] ${p}`);
    lines.push("");
  }

  const remedies = workerRemedies[ctx.scenarioId] || [];
  if (remedies.length) {
    lines.push("## 救濟管道(找哪個窗口)");
    lines.push("");
    for (const r of remedies) {
      lines.push(`- [ ] ${r.action} → **${r.authority}**${r.note ? `(${r.note})` : ""}`);
    }
    lines.push("");
  }

  if (c?.limitations?.length) {
    lines.push("## 請求權時效(務必留意)");
    lines.push("");
    for (const lim of c.limitations) lines.push(`- ${mdLinkify(lim)}`);
    lines.push("");
  }

  lines.push("## 需準備證據");
  lines.push("");
  const docs = documents[ctx.scenarioId]?.worker || [];
  for (const d of docs) {
    const ref = d.lawRef ? ` —— ${mdLinkify(d.lawRef)}` : "";
    lines.push(`- [ ] ${d.label}(${d.kind})${ref}`);
  }
  lines.push("");

  pushPricing(lines, ctx.pricing, "同業裁罰參考(求償依據)");
  pushLaws(lines, ctx.laws);

  lines.push("---");
  lines.push("本摘要由小勞鼠依本次對話內容整理,時效與權益依現行法條;僅供參考,個案結果以主管機關 / 法院見解為準。如需協助,可撥打勞動部 1955 勞工諮詢申訴專線(免付費)。");
  return lines.join("\n");
}
