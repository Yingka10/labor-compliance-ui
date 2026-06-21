// 串流介面:POST /api/ask(Express proxy)→ SSE。proxy 負責注入身分前綴、標註指令、隱藏 token。
// handler 契約:{ onIds, onProgress, onChunk, onDone, onError } → 回傳 { cancel }。
// 無 mock 模式:一律走真 API。

/**
 * @param {{question:string, role:string, scenario?:string}} params
 * @param {import("../types.js").StreamHandlers} handlers
 * @returns {{ cancel: () => void }}
 */
export function askStream(params, handlers = {}) {
  const controller = new AbortController();
  const base = import.meta.env.VITE_API_BASE || "/api";

  (async () => {
    try {
      const resp = await fetch(`${base}/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          question: params.question,
          role: params.role,
          scenario: params.scenario,
        }),
        signal: controller.signal,
      });
      if (!resp.ok || !resp.body) {
        throw new Error(`API 回應異常(${resp.status})`);
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";
      let final = null;

      // 解析逐行 "data: {json}"(api-notes:解析失敗的零碎片段直接忽略)
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          const line = buffer.slice(0, nl).trim();
          buffer = buffer.slice(nl + 1);
          if (!line.startsWith("data:")) continue;
          const json = line.slice(5).trim();
          if (!json) continue;
          let evt;
          try {
            evt = JSON.parse(json);
          } catch {
            continue;
          }
          dispatch(evt, handlers, (f) => (final = f));
        }
      }
      if (final) handlers.onDone && handlers.onDone(final);
      else throw new Error("未取得完整回應");
    } catch (err) {
      if (err.name !== "AbortError") {
        handlers.onError &&
          handlers.onError(
            new Error("無法取得回應,請確認 proxy 已啟動(npm run proxy)且 API 連線正常。")
          );
      }
    }
  })();

  return { cancel: () => controller.abort() };
}

// 把單一 SSE 事件分派到對應 handler(對齊 EAP 的事件 shape)。
function dispatch(evt, handlers, setFinal) {
  if (evt.userMessageId && evt.messageId && !("result" in evt)) {
    handlers.onIds &&
      handlers.onIds({
        userMessageId: evt.userMessageId,
        messageId: evt.messageId,
      });
  } else if (evt.progress) {
    handlers.onProgress && handlers.onProgress(evt.progress);
  } else if (typeof evt.chunk === "string") {
    handlers.onChunk && handlers.onChunk(evt.chunk);
  } else if ("result" in evt) {
    setFinal({
      result: evt.result,
      messageId: evt.messageId,
      cyphers: evt.cyphers || [],
      tokensIn: evt.tokensIn ?? 0,
      tokensOut: evt.tokensOut ?? 0,
    });
  }
}
