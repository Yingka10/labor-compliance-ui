// 圖譜文件節點 ID → 友善名稱對照(取自已驗證的 05_文件.csv;比照 extractLaws.js 的 pcode 表,
// 屬「真實節點的顯示標籤查詢」,非假資料)。
// 回答的「📄 參考來源」標註段常直接列出節點 ID(DOC001…),此表把它還原成中文名稱顯示。
const DOC_NAMES = {
  DOC001: "診斷證明書",
  DOC002: "職業傷病給付申請書",
  DOC003: "工資清冊",
  DOC004: "失能診斷書",
  DOC005: "死亡證明書",
  DOC006: "遺屬證明文件",
  DOC007: "上下班事故陳述書",
  DOC008: "職業病職歷報告書",
  DOC009: "重大職災通報書",
  DOC010: "出勤紀錄",
};

const DOC_ID_RE = /DOC\s*0*(\d{1,3})/gi;

/**
 * 把參考來源字串中的文件節點 ID 還原成友善名稱:
 *   - "DOC001"            → "診斷證明書"
 *   - "DOC001 診斷證明書"  → "診斷證明書"(去掉重複編號)
 *   - "出勤紀錄"           → 原樣
 *   - 未知 ID(如 DOC099)  → 原樣保留
 * @param {string} raw
 * @returns {string}
 */
export function prettifyDocRef(raw) {
  const s = String(raw || "").trim();
  if (!s) return s;
  // 整段就是一個已知 ID(可後接名稱) → 直接回名稱。
  const whole = s.match(/^DOC\s*0*(\d{1,3})\b\s*[:：、\-]?\s*(.*)$/i);
  if (whole) {
    const id = "DOC" + String(whole[1]).padStart(3, "0");
    if (DOC_NAMES[id]) return DOC_NAMES[id];
  }
  // 字串中夾帶已知 ID → 就地替換成名稱(去掉編號)。
  return s.replace(DOC_ID_RE, (m, n) => {
    const id = "DOC" + String(n).padStart(3, "0");
    return DOC_NAMES[id] || m;
  });
}

export { DOC_NAMES };

// 把 AI 偶爾吐進「回答本文」的圖譜節點代碼清掉/還原，避免使用者看到 DOC001、A005 之類內部 ID。
// 節點代碼皆為零補三碼：事故 A、義務 D、罰則 P、法規 L、文件 DOC、刑責 CR、民賠 CV。
const NODE_CODE = String.raw`(?:DOC|CR|CV|[ADPL])\d{3}`;
// 純代碼的括號整組：(DOC009)、（DOC001/DOC003）、（DOC001~DOC008）、（事故ID：A005）
const PAREN_CODES_RE = new RegExp(
  `[（(]\\s*(?:[^（）()]{0,6}?[:：]\\s*)?${NODE_CODE}(?:\\s*[~～/／、，,\\s]+${NODE_CODE})*\\s*[）)]`,
  "g"
);
const INLINE_CODE_RE = new RegExp(`\\b${NODE_CODE}\\b`, "g");

/**
 * 清洗回答本文裡的節點代碼：
 *   - 整組純代碼的括號 → 移除（"職災通報表(DOC009)" → "職災通報表"）
 *   - 行內 DOC 代碼 → 還原成中文名；其餘代碼（A/D/P/L/CR/CV）→ 移除
 *   - 收尾清掉空括號與多餘分隔/空白
 * 只動代碼樣式，不碰一般法名條號（如「勞動基準法第59條」）。
 */
export function sanitizeNodeCodes(text) {
  let s = String(text ?? "");
  s = s.replace(PAREN_CODES_RE, "");
  s = s.replace(INLINE_CODE_RE, (m) => {
    const name = prettifyDocRef(m);
    return name === m ? "" : name; // DOC→中文名；非 DOC 代碼還原不出名稱 → 刪掉
  });
  s = s.replace(/[（(]\s*[）)]/g, ""); // 變空的括號
  s = s.replace(/(?:[、，/／]\s*){2,}/g, "、"); // 連續分隔
  s = s.replace(/[ \t]{2,}/g, " ").replace(/\s+([，。、）)])/g, "$1");
  return s;
}
