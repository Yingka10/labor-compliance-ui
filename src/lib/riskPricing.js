// 風險定價:從 API 回傳的 cyphers data 聚合「件數 / 罰鍰中位數 / 最高額 / 代表案例」。
// 純前端聚合,只吃真實資料;無 cyphers 時不顯示(由呼叫端處理),不造假。
import { lawArticleUrl } from "./extractLaws.js";

function median(nums) {
  if (!nums.length) return 0;
  const s = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

// 對裁罰案例列做聚合(件數 / 中位數 / 最高額 / 代表案例 / 涵蓋之事故類型)。
function aggregateRows(rows = []) {
  const ids = new Set();
  const amounts = [];
  const types = new Set();
  for (const r of rows) {
    const id = r["裁罰案例_案例ID"];
    if (id) ids.add(id);
    const amt = Number(r["裁罰案例_處分金額_元"]);
    if (Number.isFinite(amt) && amt > 0) amounts.push(amt);
    const t = r["事故類型_名稱"];
    if (t) types.add(t);
  }

  // 代表案例:依金額由高到低、去重案例ID,取前 3。
  const seen = new Set();
  const top = [];
  for (const r of [...rows].sort(
    (a, b) => Number(b["裁罰案例_處分金額_元"]) - Number(a["裁罰案例_處分金額_元"])
  )) {
    const id = r["裁罰案例_案例ID"];
    if (!id || seen.has(id)) continue;
    seen.add(id);
    top.push({
      company: r["裁罰案例_違規企業"] || "(未具名)",
      date: r["裁罰案例_處分日期"] || "",
      amount: Number(r["裁罰案例_處分金額_元"]) || 0,
      law: r["裁罰案例_違反法條"] || "",
    });
    if (top.length >= 3) break;
  }

  return {
    count: ids.size,
    median: median(amounts),
    max: amounts.length ? Math.max(...amounts) : 0,
    top,
    accidentTypes: [...types],
  };
}

/**
 * 聚合 API 回傳的 cyphers(僅吃該次查詢結果列,非全量圖譜)。
 * @param {import("../types.js").Cypher[]} cyphers
 * @returns {{ count:number, median:number, max:number, top:Array, accidentTypes:string[] }}
 */
export function aggregateCyphers(cyphers = []) {
  return aggregateRows((cyphers || []).flatMap((c) => c.data || []));
}

// ── v6 資訊服務業統計節點(預先聚合)支援 ──────────────────────────────
// v6 新增 4 條 IT 統計 Data Flow(資訊服務業違規分類/違反法條/違規態樣/年度統計),
// 回傳的是「已聚合」節點:每列帶 違反法條|違規分類|違規態樣 + 件數 + 金額總和/平均,
// 沒有逐案的「裁罰案例_案例ID」。欄位名慣例為 {Category}_{屬性}(如「資訊服務業違反法條統計_件數」),
// 但實際前綴以 live 雷達查詢回傳為準;故以「後綴」比對,容忍前綴差異,不硬編完整欄名。
function pickBySuffix(row, suffixes) {
  for (const sfx of suffixes) {
    for (const k of Object.keys(row)) {
      if (k === sfx || k.endsWith(`_${sfx}`)) return row[k];
    }
  }
  return undefined;
}

function toNum(v) {
  const n = Number(String(v ?? "").replace(/[,，\s]/g, ""));
  return Number.isFinite(n) ? n : NaN;
}

// 從統計型列直接取高風險項目,件數即用節點的「件數」,免去重 caseID。
// 標籤優先取「違反法條」(法條層級);若該表是分類/態樣彙總(如工時 vs 投保對比),
// 退而取「違規分類」或「違規態樣」當標籤。任一含「件數」即視為統計型列。
function highRiskLawsFromStats(rows) {
  const out = [];
  for (const r of rows) {
    const count = toNum(pickBySuffix(r, ["件數"]));
    if (!Number.isFinite(count)) continue;
    const label = pickBySuffix(r, ["違反法條", "違規分類", "違規態樣"]);
    if (label == null || label === "") continue;
    out.push({
      law: String(label),
      article: "",
      display: String(label), // 交由 linkifyLawText 處理連結(法名+條號者連單條,分類則純文字)
      url: null,
      caseCount: count,
    });
  }
  return out.sort((a, b) => b.caseCount - a.caseCount);
}

// 高風險法條盤點(雷達情境用):依 cyphers 聚合各法規條文被裁罰的案例數,取 Top N。
// 回傳 [{ law, article, display, url, caseCount }]。
export function aggregateHighRiskLaws(cyphers = [], limit = 5) {
  const rows = (cyphers || []).flatMap((c) => c.data || []);
  // v6 統計節點優先:若回傳列為「違反法條 + 件數」的預聚合統計,直接採用件數(免 caseID 去重)。
  const statLaws = highRiskLawsFromStats(rows);
  if (statLaws.length) return statLaws.slice(0, limit);
  // 舊路徑:逐案列,靠去重「裁罰案例_案例ID」算件數。
  const map = new Map(); // key 法規|條號 → { law, num, sub, article, caseIds:Set }
  for (const r of rows) {
    const law = r["法規條文_法規"];
    const numRaw = r["法規條文_條號"];
    if (!law || !numRaw) continue;
    const m = String(numRaw).match(/(\d+)\s*條(?:之\s*(\d+))?/) || String(numRaw).match(/(\d+)(?:-(\d+))?/);
    const num = m ? m[1] : null;
    const sub = m ? m[2] : null;
    const article = sub ? `第${num}條之${sub}` : num ? `第${num}條` : String(numRaw);
    const key = `${law}|${article}`;
    if (!map.has(key)) map.set(key, { law, num, sub, article, caseIds: new Set() });
    const id = r["裁罰案例_案例ID"];
    if (id) map.get(key).caseIds.add(id);
  }
  return [...map.values()]
    .map((v) => ({
      law: v.law,
      article: v.article,
      display: `${v.law}${v.article}`,
      url: lawArticleUrl(v.law, v.num, v.sub),
      caseCount: v.caseIds.size,
    }))
    .sort((a, b) => b.caseCount - a.caseCount)
    .slice(0, limit);
}

export function fmtAmount(n) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-US");
}
