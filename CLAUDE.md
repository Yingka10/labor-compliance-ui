# 小勞鼠 — 勞動合規風險助手(決賽 Demo 前端)

## 專案目標
為 2026 精誠集團 AI 創新競賽決賽,打造勞動合規風險助手的 Web 前端。
後端是 Gemini Data EAP 平台(Hybrid RAG:VectorRAG + GraphRAG + 統合 Agent),
本專案負責前端介面 + 一個輕量 Express proxy。

適用範圍:demo 聚焦資訊服務業(IT)的勞動合規與職災風險,資料、情境與 prompt 以資訊服務業為主軸;底層圖譜與規則引擎不綁死單一產業、未來可擴充,但 demo 不再強調「產業無關」。
目標使用者:企業 HR、PM、管理層,以及勞工端(身分切換)。

## 目前狀態(2026-06,以此為準)
- **智能問答**與**案件調查報告**皆已串接真實 EAP API(經 Express proxy)。
- **無 MOCK 模式**:整個 mock 子系統已移除,一律走真 API;無假資料、無離線退路(demo 以預錄影片呈現)。
- 法條卡片改連**全國法規資料庫官方原文**(不再用手寫摘要)。
- 規則引擎(義務時間軸、資遣試算)天數已對照法條校正,並區分「法定期限 / 建議時程」。

## 技術選型
- 前端:React + Vite + Tailwind CSS;路由 react-router-dom
- Proxy:Node.js Express(轉發 EAP API、處理 CORS、隱藏 token、注入身分前綴與標註指令、透傳 SSE)
- Markdown 渲染:react-markdown + remark-gfm
- Mermaid 圖表:mermaid(回答含 ```mermaid 區塊渲染成圖)
- 跨頁狀態:React Context(src/state/AppState.jsx,session only)
- 不使用 localStorage

## 設計規範(重要,評審明確要求)
- 一律淺色底。白底 + 深藍主色(#1e3a5f 系)+ 少量輔助色。禁止深色/黑色主題。
- 正式、企業感(to-B 產品,使用者是 HR 與管理層)
- 介面語言:繁體中文;字體清晰、對比足夠(會投影在大螢幕)
- **UI 不放 emoji**(過於 AI 感);答案文字內的標註錨點 📄/⚖️ 例外。

## 頁面結構(Nav 三項,各頁自有左欄)
1. **智能問答**(/chat)— 左欄:對話紀錄(ConversationRail)。聊天介面 + 範例問題 chips + 身分切換 + 法條卡片/參考來源/推理路徑三 tab。
2. **案件調查**(/investigate)— 左欄:歷史報告。三步引導式表單(選情境 → 填參數 → 生成報告)→ 結構化四區塊報告。
3. **諮詢摘要**(/summary,SummaryPage)— 版面比照案件調查:左欄=已存摘要列表,右欄=選中摘要內容 + 「繼續諮詢」與「下載 Word / 下載 PDF(列印)」(面向 HR/勞工,不提供開發者格式 Markdown)。摘要存於 AppState.summaries(session)。
   - **依身分分流**(特色):同一段問答,資方匯出**「合規處理摘要」**(應辦事項+依據法條+裁罰風險+應留存文件,像可歸檔/簽核的盡職調查紀錄)、勞工匯出**「權益主張摘要」**(可主張權益+救濟管道找哪個窗口+請求權時效+需備證據,像帶去勞工局的行動指南)。一句話:同一個法規大腦,資方看怎麼合規、勞工看怎麼維權。
   - 「下一步」做成可勾選清單(內部以 `- [ ]` 產生,匯出 Word/PDF 後仍是可打勾的檢查表);內容複用 obligations / claims / documents / actionGuide(src/lib/buildConsultSummary.js),法條引用以官方原文連結輸出(連結在 Word / PDF 內仍可點)。
   - 與案件報告分工:報告=留在系統的互動底稿(精確到期日/資遣費金額/風險燈號);摘要=離開系統的可攜文件(質化的該做什麼+依據+窗口+時效)。

跨頁共享狀態(AppState,session,無 localStorage):role、conversations/activeConvId(對話)、summaries(摘要)、reports(報告)。

## 案件調查報告(四區塊,依身分分流)
報告的「生成報告」會把問卷參數打包成結構化 prompt,送往與問答相同的 ask API。
- **案件摘要**:渲染 API 回傳的 result 研判段落(逐字串流;失敗退回本地 buildSummary 並標「離線研判」+ 重試)。
- **區塊二依情境×身分分流**:
  - 資方 · 職災/資遣:**法定義務時間軸** —— 規則引擎(src/lib/deadlines.js + data/obligations.js)依錨點日期推算各義務期限,逾期紅色、緊急倒數、可勾選;標示「法定期限 vs 建議時程」。
  - 資方 · 法規雷達:**風險盤點 · 高風險法條**(RiskInventoryBlock)—— 雷達無具體事故日,不套用時間軸;改以 src/lib/riskPricing.js 的 `aggregateHighRiskLaws()` 依 cyphers 聚合各法條被裁罰案例數,取 Top N,連官方原文。
  - 勞工:**權益主張清單** —— 給付項目 / 救濟管道 / 請求權時效(data/claims.js)。
- **風險定價**:聚合 API 回傳 cyphers 的裁罰案例(件數 / 罰鍰中位數 / 最高額 / 代表案例);**無真 cyphers 時不顯示數字、誠實標示**(不造假)。
- **應備文件清單**:依情境×身分(data/documents.js),可勾選;每項標「法定 / 建議」—— 法定者(置備、發給或勞工得請求取得)附法條並連官方原文,建議者為佐證、非每案必備。
- 資遣情境內嵌**資遣費 / 預告期試算**(src/lib/severance.js):支援勞退新制(0.5 月/年、上限 6 月)與舊制(1 月/年、無上限);預告期 10/20/30 日。
- 行動清單(時間軸 + 文件)完成度連動風險燈號(完成全部降一級、有逾期升回)。

## 三頁串接
- 問答回答下方為**固定出口按鈕**(所有情境、所有問題皆顯示,意圖由使用者選擇、系統不猜測):
  - 「立案調查並生成報告」:解析對話預填表單多欄位,跳 /investigate 落在填參數步驟。
  - 「匯出為諮詢摘要」:`buildConsultSummary()` 把當前對話的問答 / AI 回答 / 引用法條(連官方原文)/ cyphers 裁罰案例整理成 Markdown 快照,存入 AppState.summaries,跳 /summary 檢視。
- 報告 →「就此案件繼續諮詢」/ 摘要 →「繼續諮詢」:皆走 `navigate("/chat",{state:{caseContext}})` 同一機制,帶上下文回到問答開新對話。
- 諮詢摘要頁可「下載 Word」(重用畫面已渲染的摘要 HTML 包成 Word 可開的 .doc,含官方法條超連結,無第三方套件)或「下載 PDF(瀏覽器列印樣式,index.css 的 body.printing-summary 只顯示 #print-area)」。面向 HR/勞工,不提供 Markdown。

## 法律內容的真實性與校正(重要)
- **法條卡片**:條號來自即時 API(cyphers + 本文 regex + 標註段),全文連到全國法規資料庫官方原文。pcode 對照表在 src/lib/extractLaws.js(LawSingle?pcode=&flno= 深連結),已逐一對官網查證、涵蓋本系統可能引用的勞動法規共 26 部:勞動基準法及施行細則、勞工請假規則、勞工退休金條例及施行細則、最低工資法、性別平等工作法及施行細則、職業安全衛生法及施行細則、職業災害勞工保護法、就業服務法及施行細則、中高齡者及高齡者就業促進法、就業保險法、勞工保險條例及施行細則、勞工職業災害保險及保護法、勞資爭議處理法、大量解僱勞工保護法、工會法及施行細則、團體協約法、勞動事件法、民法、中華民國刑法。另有簡稱 / 舊名對照(勞基法、職安法、災保法、性別工作平等法 等)。**三層合併以 cyphers(圖譜)為準**:本文 regex 抓到的法條需經 cyphers 或標註段佐證才採用(濾掉反例/順口提及),且只保留這 26 部白名單內的法規(清掉「辦法/方法第N條」假法條與非勞動法噪音、避免每次抓的不一樣);表外法規不顯示。
- **法條連結涵蓋範圍**:不只聊天卡片 —— 報告「法定義務時間軸」的法條徽章與「權益主張清單」的時效引用,皆透過 extractLaws.js 的 `linkifyLawText()` 掃描字串(支援簡稱如「職安法 §37」「勞退條例 §12」)轉成官方原文連結;有條號連單條、僅法名連整部法規。
- **時間軸天數**:已對照條文校正(職安法 §37 八小時通報、就服法 §33 資遣 10 日前通報、勞退條例 §12 資遣費 30 日內、勞基法施行細則 §9 工資即結清等),無單一法定天數者標「建議時程」。
- **時效(claims.js)**:職災補償 2 年(勞基法 §61)、工資 5 年(民法 §126);資遣費時效實務見解分歧(勞動部 15 年 / 部分法院 5 年),如實標示,不假裝確定。
- **應備文件(documents.js)**:已對全國法規資料庫查證並逐項分級。法定項附驗證法條(勞基法 §16 預告、§19 服務證明、§23 工資清冊、§30 出勤紀錄、§32 加班同意、§70 工作規則;職安法 §37 職災通報/調查、§20 健檢;就服法 §33 資遣通報;就保法 §11),建議項明確標示為「非法定特定文件、不一定每案都需要」,不再隱含全部都是法定義務。
- documents.js / claims.js / obligations.js 為依法整理之操作清單,UI 均標「僅供參考,以主管機關公告為準」;正式上線前建議再經法務複核。

## EAP API 串接重點
詳見 docs/api/api-notes.md。
- Base URL:https://cloud.geminidata.com/api/portal/api10
- 認證 headers:Authorization: Bearer {token} + x-application-tenant: {project_id}(由 proxy 持有,放 .env,不進前端 bundle)
- 對話流程:POST /assistant/chat/create → insertedId → POST /assistant/chat/{chatID} body { q, streaming:true }
- 回應為 SSE:事件序列 {userMessageId,messageId} → {progress} → {chunk}(逐字增量) → 最終 {result, messageId, cyphers, ...};proxy 原樣透傳,前端 src/services/askStream.js 解析逐字渲染。

## 身分切換的實作方式
- 前端只傳 role 參數;proxy 層在 q 前注入身分前綴:
  - 勞工:「【提問者身分:勞工,請以勞工權益視角回答,說明勞工可採取的行動與救濟管道】」
  - 資方/HR:「【提問者身分:企業 HR,請以雇主合規視角回答,說明法定義務、風險與應備文件】」

## 引用來源的取得方式(validation API 未打通,採 prompt 標註法)
- proxy 在每個問題後附加指令:回答最後以「---」分隔,用「📄 參考來源:」列出引用文件、用「⚖️ 相關法條:」列出法規與條號。
- 前端解析 result 標註段 → 文件清單 chips;法條卡片三層合併(cyphers + 本文 regex + 標註段)後連官方原文。

## 啟動方式
- 開發(同時起前端 + proxy):`npm run dev:all`
- 或分開:`npm run dev`(Vite,/api 代理到 proxy)與 `npm run proxy`(Express,讀 .env)
- 環境變數見 .env.example(VITE_API_BASE、EAP_API_BASE、EAP_PROJECT_ID、EAP_TOKEN、PROXY_PORT)

## 三個核心情境(內容見 docs/scenarios.md)
1. 應急導航:職災處置(HR/PM/EHS)
2. 精準止損:資遣爭議(HR/法務)
3. 法規風險雷達(管理層/HR)
