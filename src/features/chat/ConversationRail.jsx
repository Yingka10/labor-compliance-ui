// 智能問答頁左欄:品牌導覽 + 提問身分 + 新對話 + 對話紀錄列表。
import SidebarNav from "../../components/SidebarNav.jsx";
import IdentityToggle from "./IdentityToggle.jsx";

export default function ConversationRail({
  conversations,
  activeId,
  onSelect,
  onNew,
  role,
  onRoleChange,
}) {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-navy-100 bg-white">
      <SidebarNav />

      <div className="flex min-h-0 flex-1 flex-col px-4 pb-4 pt-3">
        <div className="mb-1.5 px-1 text-[11px] font-medium text-navy-400">提問身分</div>
        <IdentityToggle role={role} onChange={onRoleChange} />

        <button
          type="button"
          onClick={onNew}
          className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-brand py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          </svg>
          新對話
        </button>

        <div className="mt-5 px-1 text-xs font-semibold tracking-wide text-navy-400">對話紀錄</div>

        <div className="mt-2 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
          {conversations.length === 0 && (
            <p className="px-1 py-2 text-[12px] leading-5 text-navy-300">目前還沒有對話紀錄。</p>
          )}
          {conversations.map((c) => {
            const active = c.id === activeId;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => onSelect(c.id)}
                className={[
                  "w-full rounded-lg px-3 py-2.5 text-left transition-colors",
                  active
                    ? "bg-navy-50 ring-1 ring-inset ring-navy-100"
                    : "hover:bg-navy-50/60",
                ].join(" ")}
              >
                <div
                  className={[
                    "truncate text-[13px]",
                    active ? "font-medium text-brand" : "text-navy-700",
                  ].join(" ")}
                >
                  {c.title || "新對話"}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
  );
}
