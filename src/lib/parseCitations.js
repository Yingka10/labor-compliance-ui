// 解析 result 尾部的 prompt 標註段(CLAUDE.md §引用來源的取得方式)。
// proxy 會要求模型在回答最後以「---」分隔後,依序列出:
//   📄 參考來源:  → 文件名稱清單(渲染成文件清單 chips)
//   ⚖️ 相關法條:  → 法規與條號清單(法條卡片第三層來源)
//   🔎 延伸問題:  → 依本次回答動態產生的追問(渲染成延伸問題 chips,非前端寫死)
// 若沒有標註段,documents / lawRefs / followups 回空陣列、body = 原文。

const SOURCE_HEAD = /📄\s*參考來源\s*[:：]/;
const LAW_HEAD = /⚖️\s*相關法條\s*[:：]/;
const FOLLOWUP_HEAD = /🔎\s*延伸問題\s*[:：]/;
const ALL_HEADS = [SOURCE_HEAD, LAW_HEAD, FOLLOWUP_HEAD];

/**
 * @param {string} result
 * @returns {{ body:string, documents:string[], lawRefs:string[], followups:string[] }}
 */
export function parseCitations(result) {
  const text = result || "";
  // 標註段在最後一個「以 --- 起頭、其後出現任一標註標頭」的分隔線之後。
  const sepIdx = findCitationSeparator(text);
  if (sepIdx === -1) {
    return { body: text.trimEnd(), documents: [], lawRefs: [], followups: [] };
  }

  const body = text.slice(0, sepIdx).trimEnd();
  const tail = text.slice(sepIdx);

  // 每段抓到「下一個標頭」為止;傳入其餘兩個標頭當結束點,不假設固定順序。
  return {
    body,
    documents: extractBullets(tail, SOURCE_HEAD, [LAW_HEAD, FOLLOWUP_HEAD]),
    lawRefs: extractBullets(tail, LAW_HEAD, [SOURCE_HEAD, FOLLOWUP_HEAD]),
    followups: extractBullets(tail, FOLLOWUP_HEAD, [SOURCE_HEAD, LAW_HEAD]),
  };
}

// 標註區的起點 = 「第一個標頭(📄/⚖️/🔎)之前、最近的一條水平分隔線」。
// 不能用「最後一條有標頭在後的 ---」——因為回答本文常以 --- 分隔 ①②③④⑤ 段,
// 各標註段之間也可能有 ---,那樣會誤判、把 📄/⚖️ 留在 body 渲染(與卡片重複)。
function findCitationSeparator(text) {
  // 1) 找最早出現的標頭位置
  let headPos = -1;
  for (const h of ALL_HEADS) {
    const m = text.match(h);
    if (m && (headPos === -1 || m.index < headPos)) headPos = m.index;
  }
  if (headPos === -1) return -1;
  // 2) 取「標頭之前」最後一條水平分隔線當切點;標頭前沒有分隔線就切在標頭本身。
  const lines = text.split("\n");
  let offset = 0;
  let sep = -1;
  for (const line of lines) {
    if (offset >= headPos) break;
    if (/^\s*([-*_])\1{2,}\s*$/.test(line)) sep = offset;
    offset += line.length + 1;
  }
  return sep !== -1 ? sep : headPos;
}

// 取 startHead 之後、到「最早出現的 endHead(可多個)或結尾」之間的條列項目。
function extractBullets(segment, startHead, endHeads = []) {
  const startMatch = segment.match(startHead);
  if (!startMatch) return [];
  let chunk = segment.slice(startMatch.index + startMatch[0].length);
  let end = chunk.length;
  for (const eh of endHeads) {
    const em = chunk.match(eh);
    if (em && em.index < end) end = em.index;
  }
  chunk = chunk.slice(0, end);
  return chunk
    .split("\n")
    // 先把整行就是水平分隔線(---/***/___)的丟掉,避免被當成條列項殘留出 "--"。
    .map((l) => (/^\s*([-*_])\1{2,}\s*$/.test(l) ? "" : l))
    // 去掉行首的條列符號或編號(- * • · / 1. 1) 1、)。
    .map((l) => l.replace(/^\s*(?:[-*•·]|\d+[.)、])\s*/, "").trim())
    .filter((l) => l.length > 0 && !/^[-*_]{2,}$/.test(l));
}
