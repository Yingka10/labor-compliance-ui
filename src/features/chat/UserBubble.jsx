// 使用者提問氣泡(靠右,深藍)。
export default function UserBubble({ text }) {
  return (
    <div className="flex justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-[15px] leading-7 text-white">
        {text}
      </div>
    </div>
  );
}
