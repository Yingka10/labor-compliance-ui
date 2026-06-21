// 把案件調查問卷參數打包成結構化 prompt,送往與智能問答相同的 ask API。
// 身分前綴(資方/勞工)由 proxy 依 role 注入,引用標註指令亦由 proxy 附加;此處只組參數 + 研判指示。
import { investigateForms } from "../data/investigateForms.js";

const OPENER = {
  occupational: "我正在處理一件職業災害案件,案件參數如下:",
  dismissal: "我正在處理一件資遣爭議案件,案件參數如下:",
  radar: "我想盤點公司的勞動合規風險,情境參數如下:",
};

const INSTRUCTION = {
  occupational:
    "請依上述參數,沿資料庫關聯鏈(工作情境→事故→適用法規→企業義務/勞工權益→需備文件→刑事/民事責任)研判:職業災害類型認定與依據法條(過勞/心肌梗塞對應 A005、墜落對應 A001)、雇主法定義務與通報期限(含通報單位)、應備文件清單、罰則與民刑事賠償項目,並標出依據法條與資料來源節點。",
  dismissal:
    "請依上述參數研判:資遣程序合法性、預告期與資遣費計算、應備舉證資料、調解與訴訟風險,並列舉類似資遣裁罰或敗訴案例。",
  radar:
    "請依上述產業別,只根據資料庫的裁罰統計研判同業合規風險:列出同業最常被裁罰的違規類型與件數對比(若為資訊服務業,請用資訊服務業裁罰統計、呈現工時/加班類 vs 投保類的件數與金額對比)、高風險法條排名、內控缺口與改善建議、應備內控文件。一律以「表格＋件數＋金額」呈現,並標出依據法條與資料來源。",
};

/**
 * 依情境與問卷值組出結構化提問(僅納入已填欄位)。
 * @param {string} scenarioId
 * @param {Record<string, any>} values
 * @returns {string}
 */
export function buildReportPrompt(scenarioId, values = {}) {
  const form = investigateForms[scenarioId];
  const lines = [];
  for (const f of form?.fields || []) {
    const v = values[f.key];
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    lines.push(`- ${f.label}:${Array.isArray(v) ? v.join("、") : v}`);
  }
  const opener = OPENER[scenarioId] || "案件參數如下:";
  const instruction =
    INSTRUCTION[scenarioId] || "請依上述參數研判本案的法律性質、義務或權益、風險與應備文件。";
  return `${opener}\n${lines.join("\n")}\n\n${instruction}`;
}
