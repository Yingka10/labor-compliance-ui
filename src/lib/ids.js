// 產生與真 API 一致的 24 碼 hex id(probe 中 messageId / userMessageId 皆為 24 碼 hex)。
export function genHexId() {
  let s = "";
  for (let i = 0; i < 24; i++) {
    s += Math.floor(Math.random() * 16).toString(16);
  }
  return s;
}
