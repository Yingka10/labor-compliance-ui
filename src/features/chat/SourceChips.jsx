// 文件清單:解析回答尾部「參考來源」標註段渲染成 chips,僅顯示名稱不可點開原文
// (validation API 未通)。若無標註段則整塊隱藏(由父層判斷 documents.length)。
// 標註段常列出圖譜節點 ID(DOC001…),透過 prettifyDocRef 還原成中文名稱後去重顯示。
import { prettifyDocRef } from "../../data/docNodes.js";

export default function SourceChips({ documents }) {
  const items = [...new Set((documents || []).map(prettifyDocRef).filter(Boolean))];
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((doc, i) => (
        <span
          key={i}
          className="inline-flex items-center gap-1.5 rounded-md border border-navy-100 bg-navy-50 px-2.5 py-1 text-[13px] text-navy-700"
          title="引用文件(僅顯示名稱)"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-navy-400" fill="none">
            <path
              d="M7 3.5h7L18.5 8v12.5h-11V3.5Z"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M14 3.5V8h4.5" stroke="currentColor" strokeWidth="1.5" />
          </svg>
          {doc}
        </span>
      ))}
    </div>
  );
}
