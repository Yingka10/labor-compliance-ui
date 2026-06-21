// 資遣費 / 預告期試算。
//   資遣費(勞退新制,勞退條例 §12):每滿 1 年發 0.5 個月平均工資,未滿 1 年按比例,上限 6 個月。
//   資遣費(勞退舊制,勞基法 §17):每滿 1 年發 1 個月平均工資,未滿 1 年按比例,無上限。
//   預告期(勞基法 §16):年資 <3 月 → 0 日;3 月~未滿 1 年 → 10 日;1~未滿 3 年 → 20 日;≥3 年 → 30 日。
//   未預告時須給「預告工資」= 日薪 × 預告天數;謀職假 = 預告期間每週 2 日。

function toNum(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

// 年資(以年為單位的小數):years + months/12。
export function tenureInYears(values) {
  return toNum(values.tenureYears) + toNum(values.tenureMonths) / 12;
}

// 預告天數(依年資)。
export function noticeDays(years) {
  if (years < 3 / 12) return 0;
  if (years < 1) return 10;
  if (years < 3) return 20;
  return 30;
}

/**
 * 完整資遣試算。
 * @param {Record<string, any>} values dismissal 表單值
 * @returns {{
 *   years:number, monthsOfSeverance:number, avgWage:number, dailyWage:number,
 *   severancePay:number, capped:boolean,
 *   noticeDays:number, noticed:boolean, noticeWageDue:number, jobSeekingLeaveDays:number
 * }}
 */
export function calcSeverance(values = {}) {
  const years = tenureInYears(values);
  const avgWage = toNum(values.avgWage);
  const dailyWage = avgWage / 30;

  // 退休金制度決定資遣費基數:舊制 1 月/年且無上限;新制 0.5 月/年、上限 6 月(預設新制)。
  const isOldSystem = values.pensionSystem === "勞退舊制";
  const rate = isOldSystem ? 1 : 0.5;
  const rawMonths = rate * years;
  const capped = !isOldSystem && rawMonths > 6;
  const monthsOfSeverance = isOldSystem ? rawMonths : Math.min(6, rawMonths);
  const severancePay = Math.round(avgWage * monthsOfSeverance);

  const days = noticeDays(years);
  const noticed = values.advanceNotice === "是";
  // 未預告 → 給足預告工資;已預告 → 0。
  const noticeWageDue = noticed ? 0 : Math.round(dailyWage * days);
  // 謀職假:預告期間每週 2 日(以 7 日為一週估算)。
  const jobSeekingLeaveDays = Math.round((days / 7) * 2);

  return {
    years,
    isOldSystem,
    rate,
    monthsOfSeverance,
    avgWage,
    dailyWage: Math.round(dailyWage),
    severancePay,
    capped,
    noticeDays: days,
    noticed,
    noticeWageDue,
    jobSeekingLeaveDays,
  };
}

// 千分位格式化(顯示金額用)。
export function fmtMoney(n) {
  return `${Math.round(toNum(n)).toLocaleString("en-US")} 元`;
}
