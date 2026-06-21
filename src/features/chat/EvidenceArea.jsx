// 證據區:每則回答下方的三個 tab(相關法條 / 參考來源 / 推理路徑)。
//  - 相關法條:法條卡片(三層合併 → 靜態對照表展開)
//  - 參考來源:文件清單 chips(標註段解析)
//  - 推理路徑:點擊開右側抽屜(ReasoningDrawer);無 graph 結果則不顯示此 tab
// 只有有資料的 tab 才出現;全無資料則整個證據區隱藏。
import { useMemo, useState } from "react";
import LawCard from "./LawCard.jsx";
import SourceChips from "./SourceChips.jsx";

export default function EvidenceArea({ laws, documents, hasPath, caseCount, onOpenPath }) {
  const tabs = useMemo(() => {
    const t = [];
    if (laws.length) t.push({ id: "laws", label: `相關法條`, count: laws.length });
    if (documents.length)
      t.push({ id: "docs", label: `參考來源`, count: documents.length });
    if (hasPath) t.push({ id: "path", label: `推理路徑`, count: null });
    return t;
  }, [laws.length, documents.length, hasPath]);

  const [active, setActive] = useState(tabs[0]?.id);

  if (!tabs.length) return null;
  const current = tabs.some((t) => t.id === active) ? active : tabs[0].id;

  const selectTab = (id) => {
    setActive(id);
    if (id === "path") onOpenPath();
  };

  return (
    <section className="mt-4 rounded-xl border border-navy-100 bg-navy-50/40">
      {/* tab 列 */}
      <div className="flex items-center gap-1 border-b border-navy-100 px-2 pt-2">
        {tabs.map((t) => {
          const on = t.id === current;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => selectTab(t.id)}
              className={[
                "relative flex items-center gap-1.5 rounded-t-md px-3 py-2 text-[13px] font-medium transition-colors",
                on ? "bg-white text-brand" : "text-navy-400 hover:text-brand",
              ].join(" ")}
            >
              {t.label}
              {t.count != null && (
                <span
                  className={[
                    "rounded-full px-1.5 text-[11px]",
                    on ? "bg-navy-50 text-navy-500" : "bg-navy-100 text-navy-400",
                  ].join(" ")}
                >
                  {t.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* panel */}
      <div className="p-3">
        {current === "laws" && (
          <div className="space-y-2">
            {laws.map((law) => (
              <LawCard key={law.display} law={law} />
            ))}
          </div>
        )}
        {current === "docs" && <SourceChips documents={documents} />}
        {current === "path" && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-navy-100 bg-white px-3 py-2.5">
            <span className="text-[13px] text-navy-700">
              已實際查詢知識圖譜的節點與關係
              {caseCount > 0 ? `,含 ${caseCount} 件裁罰案例` : ""}。
            </span>
            <button
              type="button"
              onClick={onOpenPath}
              className="shrink-0 rounded-md border border-brand px-2.5 py-1 text-[13px] font-medium text-brand hover:bg-navy-50"
            >
              開啟推理路徑
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
