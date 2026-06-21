// 資料 shape 的型別說明(JSDoc),唯一依據 = docs/api/probe_output 的真實 SSE 回應。
// mock 與真 API 都必須符合這些 typedef。

/**
 * cyphers[].data 的單列。後兩欄(法規條文_法規 / 法規條文_條號)可能為 null。
 * @typedef {Object} CypherDataRow
 * @property {string} 事故類型_名稱
 * @property {string} 事故類型_描述關鍵字
 * @property {string} 事故類型_法律分類
 * @property {string} 裁罰案例_案例ID
 * @property {string} 裁罰案例_處分日期
 * @property {number} 裁罰案例_處分金額_元   // 0 表示未揭露,前端顯示「未揭露」
 * @property {string} 裁罰案例_違規企業
 * @property {string} 裁罰案例_違反法條
 * @property {string|null} 法規條文_法規
 * @property {string|null} 法規條文_條號
 */

/**
 * @typedef {Object} Cypher
 * @property {number} id
 * @property {string} title    // 查詢意圖描述
 * @property {string} cypher   // 實際執行的 Cypher 全文
 * @property {CypherDataRow[]} data
 * @property {string|null} error
 */

/**
 * 串流最終物件(SSE 最後一個事件)。
 * @typedef {Object} FinalResult
 * @property {string} result   // 完整 Markdown(mock 含 prompt 標註段)
 * @property {string} messageId
 * @property {Cypher[]} cyphers
 * @property {number} tokensIn
 * @property {number} tokensOut
 */

/**
 * askStream 的事件 handlers。
 * @typedef {Object} StreamHandlers
 * @property {(ids:{userMessageId:string, messageId:string}) => void} [onIds]
 * @property {(progress:'analysing'|'searching'|'keepAlive'|'generating answer') => void} [onProgress]
 * @property {(delta:string) => void} [onChunk]   // 逐字「增量」
 * @property {(final:FinalResult) => void} [onDone]
 * @property {(err:Error) => void} [onError]
 */

export {};
