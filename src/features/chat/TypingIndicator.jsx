// 打字中動畫(三個點)。
export default function TypingIndicator() {
  return (
    <span className="inline-flex items-center gap-1" aria-label="處理中">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="typing-dot inline-block h-1.5 w-1.5 rounded-full bg-navy-400"
          style={{ animationDelay: `${i * 0.16}s` }}
        />
      ))}
    </span>
  );
}
