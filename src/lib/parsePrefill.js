// 對話 → 表單參數解析(best-effort)。從智能問答的提問文字抽取可預填的欄位值,
// 讓「立案調查並生成報告」CTA 能多帶幾個欄位,而非只塞一段描述。
// 解析不到的欄位留空,由使用者在表單補齊。

const DATE_RE = /(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})/;

function pad(n) {
  return String(n).padStart(2, "0");
}

function findDate(text) {
  const m = text.match(DATE_RE);
  if (!m) return undefined;
  return `${m[1]}-${pad(m[2])}-${pad(m[3])}`;
}

function parseOccupational(text) {
  const v = {};
  if (/駐點|客戶機房|客戶端|現場/.test(text)) v.location = "客戶端駐點";
  else if (/通勤/.test(text)) v.location = "通勤途中";
  else if (/居家|遠距|在家/.test(text)) v.location = "居家辦公";
  else if (/公司內|廠內|辦公室/.test(text)) v.location = "公司內";

  if (/死亡|身故|猝死/.test(text)) v.severity = "死亡";
  else if (/失能|殘廢/.test(text)) v.severity = "失能";
  else if (/住院|送醫|骨折|重傷/.test(text)) v.severity = "需住院";
  else if (/輕傷|擦傷|挫傷/.test(text)) v.severity = "輕傷";

  if (/派遣/.test(text)) v.employment = "派遣";
  else if (/承攬|外包/.test(text)) v.employment = "承攬外包";
  else if (/正職|正式員工/.test(text)) v.employment = "正職";

  if (/已通報|有通報/.test(text)) v.reported = "是";
  else if (/未通報|沒通報|還沒通報|尚未通報|不算職災/.test(text)) v.reported = "否";

  const d = findDate(text);
  if (d) v.accidentDate = d;
  return v;
}

const REASON_BY_KEYWORD = [
  [/第5款|不能勝任/, "第5款 對所擔任工作確不能勝任"],
  [/第1款|歇業|轉讓/, "第1款 歇業或轉讓"],
  [/第2款|虧損|業務緊縮/, "第2款 虧損或業務緊縮"],
  [/第3款|不可抗力/, "第3款 不可抗力暫停工作一個月以上"],
  [/第4款|業務性質變更/, "第4款 業務性質變更且無適當工作可安置"],
];

function parseDismissal(text) {
  const v = {};
  for (const [re, val] of REASON_BY_KEYWORD) {
    if (re.test(text)) {
      v.reason = val;
      break;
    }
  }

  const tenure = text.match(/年資\s*(\d+)\s*年(?:\s*(\d+)\s*個?月)?/) ||
    text.match(/(\d+)\s*年\s*(\d+)\s*個?月/);
  if (tenure) {
    v.tenureYears = tenure[1];
    if (tenure[2]) v.tenureMonths = tenure[2];
  }

  if (/有\s*PIP|績效改善|改善計畫|已改善/.test(text)) v.pip = "是";
  else if (/沒給.*改善|未給.*改善|沒有.*改善機會|無\s*PIP/.test(text)) v.pip = "否";

  if (/已預告|有預告/.test(text)) v.advanceNotice = "是";
  else if (/未預告|沒預告|沒有預告/.test(text)) v.advanceNotice = "否";

  const wage = text.match(/(?:月薪|月平均工資|工資)\s*[約為:]?\s*([\d,]{4,})/);
  if (wage) v.avgWage = wage[1].replace(/,/g, "");

  const d = findDate(text);
  if (d) v.noticeDate = d;
  return v;
}

/**
 * 解析提問文字為部分表單值。
 * @param {string} scenarioId
 * @param {string} question
 * @returns {Record<string, string>}
 */
export function parsePrefill(scenarioId, question) {
  const text = question || "";
  if (scenarioId === "occupational") return parseOccupational(text);
  if (scenarioId === "dismissal") return parseDismissal(text);
  return {};
}
