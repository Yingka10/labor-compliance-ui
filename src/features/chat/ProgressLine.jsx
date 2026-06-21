// 串流等待時的狀態列。把 API 的英文 progress 對成中文(api-notes §實測串流協議)。
import TypingIndicator from "./TypingIndicator.jsx";

const LABELS = {
  analysing: "分析問題中",
  searching: "檢索知識庫中",
  keepAlive: "檢索知識庫中",
  "generating answer": "生成回答中",
};

export default function ProgressLine({ progress }) {
  const label = LABELS[progress] || "處理中";
  return (
    <div className="flex items-center gap-2 text-sm text-navy-400">
      <TypingIndicator />
      <span>{label}…</span>
    </div>
  );
}
