// 側欄頂端共用區塊:品牌 + 主導覽(智能問答 / 案件調查)。
// 取代原本橫跨頂部的 NavBar — 導覽改置於全高側欄內。
import { NavLink } from "react-router-dom";

const TABS = [
  {
    to: "/chat",
    label: "智能問答",
    icon: (
      <path
        d="M5 6.5h14M5 11h9M5 15.5h12M4 4.5h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H9l-4 3v-3H4a1 1 0 0 1-1-1v-10a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: "/investigate",
    label: "案件調查",
    icon: (
      <path
        d="M9 5h6v1.5H9V5Zm0 0H7.5A1.5 1.5 0 0 0 6 6.5v13A1.5 1.5 0 0 0 7.5 21h9a1.5 1.5 0 0 0 1.5-1.5v-13A1.5 1.5 0 0 0 16.5 5H15M9 12l1.6 1.6L14 10"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    to: "/summary",
    label: "諮詢摘要",
    icon: (
      <path
        d="M7 3.5h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-16a1 1 0 0 1 1-1Zm7 0V8h4M9 12h6M9 15.5h6M9 8.5h2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
];

export default function SidebarNav() {
  return (
    <div className="px-3 pt-4">
      {/* 品牌 */}
      <div className="flex items-center gap-3 px-1">
        <LogoMark />
        <div className="leading-tight">
          <div className="text-[17px] font-bold tracking-tight text-brand">
            小勞鼠
          </div>
          <div className="text-[11px] tracking-wide text-navy-400">
            勞動合規風險助手
          </div>
        </div>
      </div>

      {/* 主導覽 */}
      <nav className="mt-4 space-y-1">
        {TABS.map((t) => (
          <NavLink
            key={t.to}
            to={t.to}
            className={({ isActive }) =>
              [
                "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-navy-50 text-brand ring-1 ring-inset ring-navy-100"
                  : "text-navy-400 hover:bg-navy-50/60 hover:text-brand",
              ].join(" ")
            }
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" aria-hidden>
              {t.icon}
            </svg>
            {t.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

function LogoMark() {
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-soft to-brand text-white shadow-sm ring-1 ring-inset ring-white/15">
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" aria-hidden>
        <path
          d="M4 13a8 8 0 0 1 16 0v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-4Z"
          stroke="currentColor"
          strokeWidth="1.6"
        />
        <path d="M9 13h.01M15 13h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path
          d="M12 16c-1 0-1.5.6-1.5.6M7 7l-1.5-2M17 7l1.5-2"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}
