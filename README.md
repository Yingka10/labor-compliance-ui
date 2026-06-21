# 小勞鼠 — 勞動合規風險助手(前端)

2026 精誠集團 AI 創新競賽決賽 Demo 的 Web 前端。後端是 Gemini Data EAP 平台
(Hybrid RAG:VectorRAG + GraphRAG + 統合 Agent),本專案負責**前端介面**加一個
**輕量 Express proxy**(轉發 EAP API、隱藏 token、注入身分前綴與標註指令、透傳 SSE)。

適用範圍聚焦資訊服務業(IT)的勞動合規與職災風險。目標使用者:企業 HR、PM、管理層,
以及勞工端(可在介面切換身分)。

---

## 快速上手(交接者請先看這段)

```bash
# 1. 安裝套件
npm install

# 2. 設定環境變數:複製範本後填入後端金鑰
cp .env.example .env
#   編輯 .env,填 EAP_PROJECT_ID 與 EAP_TOKEN(向後端 / 組長索取)

# 3. 同時啟動前端 + proxy
npm run dev:all
```

啟動後預設前端在 Vite(通常 http://localhost:5173),proxy 在 `PROXY_PORT`(預設 8787)。
Vite 會把 `/api` 代理到 proxy,前端不直接碰 EAP token。

> 注意:`.env` 內含後端金鑰,**已被 `.gitignore` 排除,不會進版控**。請勿提交真實 token。

### npm scripts

| 指令 | 作用 |
|---|---|
| `npm run dev:all` | 同時起前端(Vite)+ proxy(Express),開發首選 |
| `npm run dev` | 只起 Vite 前端(`/api` 仍代理到 proxy,需另開 proxy) |
| `npm run proxy` | 只起 Express proxy,讀 `.env` |
| `npm run build` | 打包前端到 `dist/` |
| `npm run preview` | 預覽打包後的前端 |

---

## 環境變數(`.env`)

| 變數 | 說明 |
|---|---|
| `VITE_API_BASE` | 前端打 proxy 的基底路徑,預設 `/api`(會進前端 bundle) |
| `EAP_API_BASE` | EAP API base,預設 `https://cloud.geminidata.com/api/portal/api10` |
| `EAP_PROJECT_ID` | EAP 專案 ID(proxy 用,**不進前端 bundle**) |
| `EAP_TOKEN` | EAP 專案 token(proxy 用,**不進前端 bundle**) |
| `PROXY_PORT` | Express proxy 埠號,預設 `8787` |

只有 `VITE_` 開頭的變數會被打進前端;後端金鑰一律由 proxy 持有。

---

## 技術選型

- 前端:React 18 + Vite 6 + Tailwind CSS 4;路由 `react-router-dom` 6
- Proxy:Node.js Express 4
- Markdown 渲染:`react-markdown` + `remark-gfm`
- 圖表:`mermaid`(回答含 ` ```mermaid ` 區塊會渲染成圖)
- 跨頁狀態:React Context(`src/state/AppState.jsx`,**session only,不使用 localStorage**)

**無 MOCK 模式**:整個 mock 子系統已移除,一律走真 API,無假資料、無離線退路
(正式 demo 以預錄影片呈現)。

---

## 頁面結構(Nav 三項,各頁自有左欄)

| 路由 | 名稱 | 內容 |
|---|---|---|
| `/chat` | 智能問答 | 聊天介面 + 範例問題 + 身分切換 + 法條卡片 / 參考來源 / 推理路徑三 tab |
| `/investigate` | 案件調查 | 三步引導式表單(選情境 → 填參數 → 生成報告)→ 結構化四區塊報告 |
| `/summary` | 諮詢摘要 | 左欄已存摘要列表,右欄摘要內容 + 繼續諮詢 + 下載 Word / PDF |

跨頁共享狀態(`AppState`,session):`role`(身分)、`conversations` / `activeConvId`、
`summaries`、`reports`。

### 依身分分流(產品特色)

同一段問答,**資方**匯出「合規處理摘要」(應辦事項 + 依據法條 + 裁罰風險 + 應留存文件),
**勞工**匯出「權益主張摘要」(可主張權益 + 救濟管道 + 請求權時效 + 需備證據)。
一句話:同一個法規大腦,資方看怎麼合規、勞工看怎麼維權。

---

## 目錄導覽

```
labor-compliance-ui/
├─ server/index.js          Express proxy(EAP API、SSE 透傳、身分前綴注入)
├─ src/
│  ├─ App.jsx               路由
│  ├─ pages/                ChatPage / InvestigatePage / SummaryPage
│  ├─ components/           Layout、SidebarNav 等
│  ├─ state/AppState.jsx    跨頁 Context(session)
│  ├─ services/askStream.js 解析 EAP SSE、逐字渲染
│  ├─ lib/                  規則引擎與工具(見下)
│  └─ data/                 情境 / 義務 / 文件 / 主張等靜態清單
├─ docs/                    API 筆記、情境、簡報文案、UI spec
├─ .env.example            環境變數範本
└─ CLAUDE.md               完整設計與法律校正說明(深入交接看這份)
```

`src/lib/` 重點:`deadlines.js`(義務時間軸天數)、`severance.js`(資遣費 / 預告期試算)、
`riskPricing.js`(高風險法條聚合)、`extractLaws.js`(法條條號 → 全國法規資料庫官方原文連結)、
`buildConsultSummary.js`(問答匯出諮詢摘要)。

---

## EAP API 串接重點(詳見 `docs/api/api-notes.md`)

- 認證 headers:`Authorization: Bearer {token}` + `x-application-tenant: {project_id}`(由 proxy 持有)
- 對話流程:`POST /assistant/chat/create` → 取 `insertedId` → `POST /assistant/chat/{chatID}`
  body `{ q, streaming:true }`
- 回應為 SSE,事件序列:`{userMessageId,messageId}` → `{progress}` → `{chunk}`(逐字增量)
  → 最終 `{result, messageId, cyphers, ...}`;proxy 原樣透傳,前端 `askStream.js` 解析。
- 身分切換:前端只傳 `role`,proxy 在 `q` 前注入身分前綴(勞工 / 企業 HR 視角)。
- 引用來源:validation API 未打通,改採 prompt 標註法 —— proxy 要求回答末尾以 `---` 分隔,
  列出「參考來源」與「相關法條」,前端解析成 chips 與法條卡片。

---

## 設計規範(評審明確要求,改 UI 前必讀)

- 一律**淺色底**:白底 + 深藍主色(`#1e3a5f` 系)+ 少量輔助色。禁止深色 / 黑色主題。
- 正式、企業感(to-B,使用者是 HR 與管理層)。
- 介面語言:繁體中文;字體清晰、對比足夠(會投影大螢幕)。
- **UI 不放 emoji**(過於 AI 感);僅答案文字內的標註錨點為例外。

---

## 法律內容的真實性

法條、時效、應備文件、義務天數皆已對照全國法規資料庫官方原文逐項校正,並區分
「法定 vs 建議」。詳細校正依據與白名單(26 部勞動法規)見 `CLAUDE.md` 的
「法律內容的真實性與校正」段。UI 均標「僅供參考,以主管機關公告為準」;正式上線前建議經法務複核。

---

## 備註

- `AI-Ready-Data/` 是另一個獨立的 GitHub repo(`weihong931021/AI-Ready-Data`),
  已在 `.gitignore` 排除,不屬於本 repo;需要時請各自 clone。
- 深入的架構、法律校正與情境設計請讀 `CLAUDE.md` 與 `docs/`。
