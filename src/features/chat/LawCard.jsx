// 法條卡片:法條編號 + 連到全國法規資料庫官方原文(不再用手寫摘要)。
// 資料來自 extractLaws(三層合併);有 pcode 才附官方連結,否則僅顯示條號。
export default function LawCard({ law }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-navy-100 bg-white px-4 py-3">
      <span className="flex h-6 shrink-0 items-center rounded bg-emerald-50 px-2 text-xs font-semibold text-emerald-700">
        法條
      </span>
      <span className="flex-1 text-sm font-semibold text-brand">{law.display}</span>
      {law.url ? (
        <a
          href={law.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 rounded-md border border-navy-200 px-2.5 py-1 text-[12px] font-medium text-navy-700 hover:border-brand hover:text-brand"
        >
          查看官方條文
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" aria-hidden>
            <path
              d="M14 5h5v5M19 5l-8 8M11 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-navy-300">以主管機關公告為準</span>
      )}
    </div>
  );
}
