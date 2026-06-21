// 身分切換:資方 / HR ⇄ 勞工。切換時範例 chips 與對話區 badge 跟著換,答案不變
// (身分前綴在 proxy 層注入)。全寬分段控制(segmented control),含角色圖示。
import { ROLES } from "../../data/scenarios.js";

const ORDER = ["employer", "worker"];

const ICONS = {
  employer: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <rect x="3" y="7.5" width="18" height="12.5" rx="2" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M8 7.5V6A1.5 1.5 0 0 1 9.5 4.5h5A1.5 1.5 0 0 1 16 6v1.5M3 12h18"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  ),
  worker: (
    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" aria-hidden>
      <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5.5 19.5a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  ),
};

export default function IdentityToggle({ role, onChange }) {
  return (
    <div className="grid grid-cols-2 gap-1 rounded-xl bg-navy-50 p-1">
      {ORDER.map((r) => {
        const active = role === r;
        return (
          <button
            key={r}
            type="button"
            onClick={() => onChange(r)}
            aria-pressed={active}
            className={[
              "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-all",
              active
                ? "bg-brand text-white shadow-sm"
                : "text-navy-400 hover:bg-white hover:text-brand",
            ].join(" ")}
          >
            {ICONS[r]}
            {ROLES[r].label}
          </button>
        );
      })}
    </div>
  );
}
