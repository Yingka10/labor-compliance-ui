// 風險燈號重算:行動清單完成度連動。
//   - 全部行動項(時間軸 + 文件)完成 → 由初判降一級(高→中→低)。
//   - 有「已逾期且未完成」的義務 → 由初判升一級(低→中→高)或維持高。
//   - 其餘 → 維持初判。
const ORDER = ["低", "中", "高"];

/**
 * @param {string} baseRisk 初判風險(assessRisk 結果)
 * @param {{ allDone:boolean, hasOverdueIncomplete:boolean }} signals
 * @returns {string} 重算後風險等級
 */
export function recomputeRisk(baseRisk, { allDone, hasOverdueIncomplete } = {}) {
  let idx = ORDER.indexOf(baseRisk);
  if (idx < 0) idx = 1; // 不在表內視為「中」
  if (hasOverdueIncomplete) idx = Math.min(ORDER.length - 1, idx + 1);
  else if (allDone) idx = Math.max(0, idx - 1);
  return ORDER[idx];
}
