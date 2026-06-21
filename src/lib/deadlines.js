// 規則引擎:依錨點日期 + 偏移,推算各法定義務的具體到期日與狀態。
// 純前端日期運算,無外部依賴;今日基準採 new Date()。
import { obligations } from "../data/obligations.js";

const DAY_MS = 24 * 60 * 60 * 1000;

// 解析表單的 date 字串(YYYY-MM-DD)為當日 00:00 的 Date;無效回 null。
function parseAnchor(value) {
  if (!value) return null;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function addOffset(base, offset) {
  const d = new Date(base.getTime());
  if (offset?.hours) d.setHours(d.getHours() + offset.hours);
  if (offset?.days) d.setDate(d.getDate() + offset.days);
  return d;
}

// 同一天(以日為單位)的天數差:dueDate - now,向上以日計。
function daysUntil(due, now) {
  return Math.ceil((due.getTime() - now.getTime()) / DAY_MS);
}

/**
 * 計算某情境的法定義務時間軸。
 * @param {string} scenarioId
 * @param {Record<string, any>} values 表單值(含錨點 date 欄位)
 * @param {Record<string, boolean>} completed 已勾選完成的義務
 * @param {Date} [now] 今日基準(預設 new Date())
 * @returns {Array<{id,label,lawRef,desc,dueDate:Date|null,daysLeft:number|null,status:string,hasAnchor:boolean}>}
 *   status: "done" | "overdue" | "urgent" | "upcoming" | "unknown"
 */
export function computeTimeline(scenarioId, values = {}, completed = {}, now = new Date()) {
  const items = obligations[scenarioId] || [];
  return items.map((o) => {
    const anchor = parseAnchor(values[o.anchor]);
    if (!anchor) {
      return {
        id: o.id,
        label: o.label,
        lawRef: o.lawRef,
        kind: o.kind,
        desc: o.desc,
        offset: o.offset,
        dueDate: null,
        daysLeft: null,
        hasAnchor: false,
        status: completed[o.id] ? "done" : "unknown",
      };
    }
    const dueDate = addOffset(anchor, o.offset);
    const daysLeft = daysUntil(dueDate, now);
    let status;
    if (completed[o.id]) status = "done";
    else if (dueDate.getTime() < now.getTime()) status = "overdue";
    else if (daysLeft <= (o.urgentWithinDays ?? 3)) status = "urgent";
    else status = "upcoming";
    return {
      id: o.id,
      label: o.label,
      lawRef: o.lawRef,
      kind: o.kind,
      desc: o.desc,
      offset: o.offset,
      dueDate,
      daysLeft,
      hasAnchor: true,
      status,
    };
  });
}

// 格式化到期日為 YYYY-MM-DD(8 小時類的偏移仍以日顯示,另附時間)。
export function formatDue(due, offset) {
  if (!due) return "未設定錨點日期";
  const ymd = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}-${String(
    due.getDate()
  ).padStart(2, "0")}`;
  if (offset?.hours) {
    const hh = String(due.getHours()).padStart(2, "0");
    const mm = String(due.getMinutes()).padStart(2, "0");
    return `${ymd} ${hh}:${mm}`;
  }
  return ymd;
}
