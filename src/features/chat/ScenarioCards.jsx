// 三情境卡 — 放在空狀態中央(對話開始後隱藏)。點選載入該情境的範例問題。
import { scenarios } from "../../data/scenarios.js";

const ICONS = {
  helmet: (
    <path
      d="M4 13a8 8 0 0 1 16 0v3H4v-3Zm8-8v3M5 11l-1.5-1M19 11l1.5-1"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  scale: (
    <path
      d="M12 4v16M7 20h10M5 7h14M5 7 3 13h4L5 7Zm14 0-2 6h4l-2-6ZM7 4h10"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
  radar: (
    <path
      d="M12 12 18 6M12 3a9 9 0 1 0 9 9M12 7.5a4.5 4.5 0 1 0 4.5 4.5"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  ),
};

export default function ScenarioCards({ activeId, onSelect }) {
  return (
    <div className="grid w-full max-w-3xl grid-cols-1 gap-3 sm:grid-cols-3">
      {scenarios.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onSelect(s.id)}
            className={[
              "rounded-xl border p-4 text-left transition-colors",
              active
                ? "border-brand bg-navy-50"
                : "border-navy-100 bg-white hover:border-navy-200",
            ].join(" ")}
          >
            <span
              className={[
                "flex h-10 w-10 items-center justify-center rounded-lg",
                active ? "bg-brand text-white" : "bg-navy-50 text-brand",
              ].join(" ")}
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none">
                {ICONS[s.icon]}
              </svg>
            </span>
            <div className="mt-3 text-sm font-semibold text-brand">{s.title}</div>
            <div className="text-[11px] text-navy-400">{s.subtitle}</div>
            <p className="mt-1.5 text-[12px] leading-5 text-navy-400">{s.desc}</p>
          </button>
        );
      })}
    </div>
  );
}
