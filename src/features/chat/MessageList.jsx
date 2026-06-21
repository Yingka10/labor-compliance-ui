import { useEffect, useRef } from "react";
import UserBubble from "./UserBubble.jsx";
import AnswerBubble from "./AnswerBubble.jsx";

export default function MessageList({ messages, busy, onRetry, onOpenPath, onExportSummary, onFollowup }) {
  const endRef = useRef(null);

  // 新內容時捲到底(串流逐字時也持續貼底)
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages]);

  return (
    <div className="space-y-5">
      {messages.map((m) =>
        m.role === "user" ? (
          <UserBubble key={m.id} text={m.text} />
        ) : (
          <AnswerBubble
            key={m.id}
            message={m}
            busy={busy}
            onRetry={() => onRetry(m)}
            onOpenPath={onOpenPath}
            onExportSummary={onExportSummary}
            onFollowup={onFollowup}
          />
        )
      )}
      <div ref={endRef} />
    </div>
  );
}
