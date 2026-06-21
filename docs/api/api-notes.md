# EAP API 筆記與待驗證清單

> 狀態(2026-06):Express proxy(server/index.js)已完成,智能問答與案件調查報告皆已串接真實 API。
> 串流協議如下方「實測確認」所載;前端解析在 src/services/askStream.js。MOCK 模式已移除。
> 以下「待驗證事項」多為當初開工前的清單,部分已不再適用,保留作為背景紀錄。

## 已知(來自官方 sample code)
- Base URL: https://cloud.geminidata.com/api/portal/api10
- Headers:
  - Authorization: Bearer {PROJECT_TOKEN}
  - x-application-tenant: {PROJECT_ID}
- 對話流程:
  1. GET  /assistant/chat/list           → 取得對話列表
  2. POST /assistant/chat/create (json={}) → 建新對話,回傳 insertedId
  3. POST /assistant/chat/{chatID}        → body: { "q": "問題", "streaming": true }
- 回應格式(SSE):
  - 逐行 "data: {json}"
  - 每個 chunk 的 "result" 欄位持續累積,最後一個 chunk 含完整答案
  - 解析失敗的零碎片段直接忽略
- 注意:API 偏慢,一定要 streaming,否則會 504

## Proxy 設計(Express)
- 原因:瀏覽器直接打 cloud.geminidata.com 會遇到 CORS;token 也不該進前端 bundle
- 路由:
  - POST /api/ask        { question, role, scenario } → 注入身分前綴 → 轉發 EAP 並以 SSE 回傳前端
  - POST /api/investigate { scenario, fields } → 套 prompt 模板 → 轉發 EAP
  - GET  /api/graph/...   (待驗證 EAP graph endpoint 後決定)
- token 與 project_id 放 .env(EAP_TOKEN, EAP_PROJECT_ID)

## ✅ Swagger 分析結論(2026/06/12)
- ★ `GET /chat/{chat_id}/{message_id}/validation` — validation 端點 portal 路徑未打通(2026/06/12),改採 prompt 標註法取得引用來源;若之後從平台 DevTools 抄到真實路徑,再升級成 API 取得。
- `GET /chat/document/{knowledge_id}` — 取得引用文件原文(文件清單點擊展開用)
- `GET /chat/question/list`、`/chat/question/categories` — 平台內建問題庫,
  範例問題 chips 可按 category 對應三情境從平台拉取
- `POST /chat/{chat_id}/{message_id}/chartgen` — 對回答生成圖表(法規風險雷達統計用)
- `GET /chat/{chat_id}/messages` — 對話歷史與 message_id
- `GET /import/vector/knowledge` — 知識庫文件總列表(檔名/標題/摘要/標籤)
- ⚠ 路徑前綴注意:swagger 寫 /api/v1/chat/...,實際走 portal gateway 是
  {BASE}/assistant/chat/...(sample code 已證實 chat 系列如此),其餘端點要實測
- 跑 probe_api.py 一次驗完,輸出放 docs/api/probe_output/

## ✅ 實測確認的串流協議(2026/06/12 probe 結果,以此為準)
POST {BASE}/assistant/chat/{chatID} body {q, streaming:true} 的 SSE 事件依序為:
1. {userMessageId, messageId}        ← 第一個事件就拿到 messageId,先存起來
2. {progress: "analysing"}           ← 顯示「分析問題中」
3. {progress: "searching"}           ← 顯示「檢索知識庫中」
4. {progress: "keepAlive"} × N       ← 心跳,維持等待動畫即可
5. {progress: "generating answer"}   ← 顯示「生成回答中」
6. {chunk: "字"} × N                 ← ⚠ 逐字「增量」(delta),前端自行 append 渲染
7. 最終物件 {result, messageId, cyphers, tokensIn, tokensOut}
   ← result 為完整 Markdown,用它取代串流累積的文字

## ✅ cyphers 結構(圖譜頁的資料來源,免另外打 graph API)
cyphers: [{ id, title(查詢意圖描述), cypher(實際執行的 Cypher 全文), data(查詢結果列), error }]
已知 graph schema(從 Cypher 解析):
  (工作情境)-[對應產業]->(產業)
  (工作情境)-[對應事故]->(事故類型)
  (裁罰案例)-[對應事故]->(事故類型)
  (裁罰案例)-[違反法條]->(法規條文)
data 列欄位:事故類型名稱、事故類型描述關鍵字、裁罰案例ID、處分日期、
            處分金額_元、違規企業、違反法條、法規名稱、法規條號

## 前端應用方式
- 知識圖譜頁:依 schema 畫路徑骨架,節點掛 data 實例;加「查看 Cypher」展開
  (語法高亮顯示原始查詢)——證明 graph 真的被查詢,直接回應評審質疑
- 法規風險雷達:前端對 data 做 group by 法規條號/金額,出 Top N 長條圖
- 法條卡片:data 的 法規名稱+條號,加上 result 文字 regex 偵測;
  條文全文用前端內建靜態 JSON(常用勞動法條對照表)
- 處分金額_元 = 0 時顯示「未揭露」,不要顯示 0 元
- ⚠ 已知資料層問題:裁罰案例未連結產業節點,跨產業案例會被撈回
  (已回報資料組員處理;前端勿宣稱「依產業過濾」直到關聯補上)

## ⚠️ 待驗證事項(開工前要做)

### A. 把 Swagger 規格檔抓下來
1. 開 https://cloud.geminidata.com/api/docs/#/
2. Swagger UI 頁面最上方通常會顯示規格檔網址(xxx.json),直接點開另存;
   找不到的話開瀏覽器 DevTools → Network → 重新整理 → 篩選 .json,
   找到那支 openapi/swagger json,右鍵 Save。
3. 存成 docs/api/swagger.json 放進本資料夾 → Claude Code 就能精準串接

### B. 確認圖譜相關 endpoint
- token 權限含 graph:read / graph:explore / graph:export,平台應有對應 API
- 在 Swagger 裡搜尋 "graph",確認:
  - 能否查詢節點/邊(取子圖)?
  - 能否拿到某次問答實際走的圖譜路徑?
- 三種方案,按理想程度排:
  1. 對話 API 回應裡就帶 graph 路徑/引用 → 直接渲染(見 C)
  2. 只有 graph 查詢 API → 問答後用答案中的關鍵實體去查子圖,前端高亮
  3. 都拿不到 → 知識圖譜頁用 MOCK 路徑(資料照真實 schema 造),demo 影片照樣成立

### C. 印出一次完整的 API 回應(很重要)
sample code 只取 result,但 chunk 裡可能還有引用來源、文件頁碼、graph 資訊。
把解析迴圈改成印出整個 parsed dict:

    parsed = json.loads(json_str)
    print(json.dumps(parsed, ensure_ascii=False, indent=2))

跑一次真實問題,把完整輸出存成 docs/api/sample_response.json 放進資料夾。
法條卡片、文件清單、圖譜路徑能不能吃真資料,全看這個檔案裡有什麼欄位。

### D. 確認對話的 session 策略
- demo 用:每個身分(資方/勞工)各維護一個 chatID?還是每次提問開新 chat?
- 建議先測:同一 chat 連續提問會不會被前文干擾;會的話 demo 改為每題新 chat
