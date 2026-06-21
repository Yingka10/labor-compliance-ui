// 把 cyphers 查詢結果整理成「推理路徑」步驟,給知識圖譜抽屜的步驟條使用。
// 改為 schema 無關:不再寫死「事故→裁罰案例→違反法條」,而是直接從回傳列的欄位前綴
// (Category_屬性)動態歸納「本次命中的圖譜節點類型 + 各類數量」。這樣職災/資遣/雷達各種
// 查詢都能真實反映 graph 走訪結果(避免舊版對職災問句三格全 0 項的假象)。
// 若回傳含裁罰案例,額外保留可展開的案例清單(雷達/同業情境用)。

// 取欄位所屬的節點 Category(欄名慣例:「Category_屬性」,如 法規條文_條號)。
function categoryOf(key) {
  const i = key.indexOf("_");
  return i > 0 ? key.slice(0, i) : key;
}

// 每個 Category 用哪一欄當「節點識別/名稱」來計 distinct:優先這些後綴,否則取第一欄。
const LABEL_SUFFIX_PREF = [
  "案例ID", "ID", "名稱", "法規", "條號", "罪名", "項目",
  "違規分類", "違反法條", "違規態樣", "年度", "名", "標題",
];

function distinctCaseCount(rows) {
  return new Set(rows.map((r) => r["裁罰案例_案例ID"]).filter(Boolean)).size;
}

/**
 * @param {import("../types.js").Cypher[]} cyphers
 * @returns {{ title:string, steps:Array<object>, totalCases:number, nodeCount:number }|null}
 */
export function buildReasoningPath(cyphers = []) {
  const withData = (cyphers || []).filter((c) => (c.data || []).length > 0);
  if (!withData.length) return null;
  const cy = withData[0];
  // 跨所有有結果的查詢彙整節點/案例,完整反映本次的 graph 走訪(技術視角另列各查詢明細)。
  const rows = withData.flatMap((c) => c.data);

  // 1) 依欄位前綴歸納命中的節點類型,並計每類 distinct 數量。
  const colsByCat = new Map(); // category → Set(欄名)
  for (const r of rows) {
    for (const k of Object.keys(r)) {
      const cat = categoryOf(k);
      if (!colsByCat.has(cat)) colsByCat.set(cat, new Set());
      colsByCat.get(cat).add(k);
    }
  }
  const nodeItems = [];
  for (const [cat, colSet] of colsByCat) {
    const cols = [...colSet];
    let labelKey = null;
    for (const suf of LABEL_SUFFIX_PREF) {
      const hit = cols.find((c) => c.endsWith(suf));
      if (hit) { labelKey = hit; break; }
    }
    if (!labelKey) labelKey = cols[0];
    const vals = new Set();
    for (const r of rows) {
      const v = r[labelKey];
      if (v != null && v !== "") vals.add(v);
    }
    if (vals.size > 0) nodeItems.push({ name: cat, count: vals.size });
  }
  nodeItems.sort((a, b) => b.count - a.count);

  // 2) 裁罰案例(若有):distinct by 案例ID,供展開檢視。
  const caseMap = new Map();
  for (const r of rows) {
    const id = r["裁罰案例_案例ID"];
    if (!id || caseMap.has(id)) continue;
    caseMap.set(id, {
      id,
      company: r["裁罰案例_違規企業"] || "未揭露",
      date: r["裁罰案例_處分日期"] || "",
      amount: r["裁罰案例_處分金額_元"],
      law: r["裁罰案例_違反法條"] || "",
    });
  }
  const cases = [...caseMap.values()];

  const intentLabel =
    withData.length > 1 ? `${cy.title}(共 ${withData.length} 個圖譜查詢)` : cy.title;
  const steps = [
    { type: "intent", node: "查詢意圖", label: intentLabel },
    {
      type: "nodes",
      node: "命中圖譜節點",
      count: nodeItems.length,
      unit: "類",
      itemUnit: "項",
      items: nodeItems,
    },
  ];
  if (cases.length) {
    steps.push({ type: "cases", node: "裁罰案例", count: cases.length, unit: "件", cases });
  }

  return { title: cy.title, steps, totalCases: cases.length, nodeCount: nodeItems.length };
}

// 金額顯示:0 → 未揭露(api-notes §前端應用方式)
export function formatAmount(amount) {
  if (amount === 0 || amount == null) return "未揭露";
  return `${Number(amount).toLocaleString("zh-TW")} 元`;
}
