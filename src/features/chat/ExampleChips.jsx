// 範例問題 chips:對話區上方,點擊直接送出。內容依目前情境 + 身分而換。
export default function ExampleChips({ chips, onPick, disabled }) {
  if (!chips?.length) return null;
  return (
    <div className="flex flex-wrap gap-2">
      {chips.map((chip, i) => (
        <button
          key={i}
          type="button"
          disabled={disabled}
          onClick={() => onPick(chip)}
          className="rounded-full border border-navy-200 bg-white px-3.5 py-1.5 text-[13px] text-navy-700 transition-colors hover:border-brand hover:text-brand disabled:cursor-not-allowed disabled:opacity-50"
        >
          {chip.text}
        </button>
      ))}
    </div>
  );
}
