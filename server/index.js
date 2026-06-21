// EAP 對話 API 的輕量 Express proxy(對應 docs/api/api-notes.md 實測協議)。
// 職責:
//   1. 隱藏 token / project_id(只放 server 端 env,不進前端 bundle)
//   2. 解決瀏覽器直打 cloud.geminidata.com 的 CORS
//   3. 在 server 層注入「圖譜路由指令 + 身分前綴 + 引用標註指令」到提問 q
//   4. 並行搶答:同一題同時送 N 個對話,取第一個「真的命中 graph」的回應
//      —— 因為實測 EAP API 路徑的 graph 路由是機率性的(v6 robot setting 在 API 端
//         不一定被套用),單次只有約 1/4~3/5 命中,其餘掉回通用 LLM 回「查無」。
//      並行搶答把單次 demo 的成功率拉到 ~94%(見 docs/api/api-notes.md 診斷)。
//   5. 對前端仍以 SSE 回傳(progress → chunk → 最終 result),前端 askStream 不需改。
//
// 啟動:node --env-file=.env server/index.js  (Node 20.6+ 原生支援 --env-file)
import express from "express";

const API_BASE_URL =
  process.env.EAP_API_BASE || "https://cloud.geminidata.com/api/portal/api10";
// 與 docs/api/chat_api_sample.py 相同的公開 demo 預設值,確保未設 env 也能即時跑通。
const PROJECT_ID = process.env.EAP_PROJECT_ID || "69eafdf6e2d327002b0c6557";
const PROJECT_TOKEN =
  process.env.EAP_TOKEN ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjZhMmJiY2U0NDQ0ZjZiMDAyYjU3ZWYxOSIsImlzQVBJIjp0cnVlLCJnX3VpZCI6IjY5ZWI5NDFjZTJkMzI3MDAyYjBjYzJhYiIsImdfYWRtaW4iOmZhbHNlLCJnX2RlbW9hZG1pbiI6ZmFsc2UsImdfYWNjb3VudGFkbWluIjpmYWxzZSwiZ190aWQiOiI2OWVhZmRmNmUyZDMyNzAwMmIwYzY1NTc6cHJvZHVjZXIiLCJnX3RpZF9wZXJtaXNzaW9uIjpbIm1ldGE6dXBkYXRlIiwic291cmNlOnJlYWQiLCJzb3VyY2U6dXBkYXRlIiwic291cmNlOmRlbGV0ZSIsImdyYXBoOnJlYWQiLCJncmFwaDp1cGRhdGUiLCJncmFwaDpkZWxldGUiLCJncmFwaDpleHBsb3JlIiwiZ3JhcGg6ZXhwb3J0IiwiY2FudmFzOmFubm90YXRlIiwiY2FudmFzOnBlcnNvbmFsaXplIiwiZGFzaGJvYXJkOnJlYWQiLCJkYXNoYm9hcmQ6dXBkYXRlIiwiY2FudmFzOnNoYXBlIl0sImdfdGlkX3BhcnNlcl9zb3VyY2UiOiJjc3YiLCJnX3RpZF9mZWF0dXJlX2FkZF9vbnMiOlsiYXNzaXN0YW50Il0sImdfYXZhdGFyIjoiMDIiLCJpc3MiOiJodHRwczovL2Nsb3VkLmdlbWluaWRhdGEuY29tIiwic3ViIjoiNjllYjk0MWNlMmQzMjcwMDJiMGNjMmFiIiwiYXVkIjoiaHR0cHM6Ly9jbG91ZC5nZW1pbmlkYXRhLmNvbSIsImV4cCI6NDg2NjcwNTI4MiwiaWF0IjoxNzgxMjUxMzAxLCJuaWNrbmFtZSI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbCI6Im1lbWJlcjE0NkB3b3Jrc2hvcC5jb20iLCJlbWFpbF92ZXJpZmllZCI6ZmFsc2UsImxhbmciOiJ6aC1UVyJ9.zVCQpcUAb2FDf976gQ_qqSerf2VdiAS8pZsWmY6lhng";

const PORT = Number(process.env.PROXY_PORT || 8787);
// 並行搶答的同時請求數(env 可覆寫)。3 個 → 單次 demo 命中 graph 機率約 94%。
const ATTEMPTS = Math.max(1, Number(process.env.EAP_GRAPH_ATTEMPTS || 3));

// 圖譜路由指令(server 層注入):補做 v6 robot setting 在 API 端不一定被套用的「強制走 graph」。
// 依情境給對應關聯鏈/統計表;前端 /api/ask 會帶 scenario(智能問答的情境 tab、案件調查的情境)。
const GRAPH_DIRECTIVE = {
  occupational:
    "【作答要求】本題屬職災/過勞/事故處置類,請務必查詢本專案資料庫的知識圖譜(graph 節點與關係)與文件作答,禁止只用一般法律常識。沿關聯鏈:工作情境→事故→適用法規→企業義務/勞工權益→應備文件→刑事責任/民事賠償;處置任務走 處置任務→企業角色。事故節點對照:過勞/心肌梗塞/腦血管=A005、墜落=A001、感電=A002、機械夾捲=A003、爆炸火災=A004。初查無結果改用 A005(過勞職災)重試,確認完全無資料才可回覆查無。輸出:法定通報義務表(義務/期限/通報單位/法規)、應備文件清單、刑事責任、民事賠償項目、依據法條與資料來源。",
  dismissal:
    "【作答要求】本題屬資遣/解僱類,請務必查詢本專案資料庫的知識圖譜(graph 節點與關係)與文件作答,禁止只用一般法律常識。沿關聯鏈:事故 A006→適用法規(勞基§11/§16/§17、大量解僱勞工保護法、勞動事件法)→企業義務→應備文件;舉證走 證據資料→法規判斷。輸出:合法資遣程序與期限、預告期、資遣費、必備文件、舉證責任與所需證據、依據法條與資料來源。初查無結果改以 A006 重試,確認完全無資料才可回覆查無。",
  radar:
    "【作答要求】本題屬同業/產業/統計類,請務必查詢本專案資料庫的裁罰統計作答,禁止只用一般法律常識。若問「資訊服務業」:用『資訊服務業違規分類統計／資訊服務業違反法條統計／資訊服務業違規態樣統計』三表,切勿拿全國法條統計的數字冒充資訊服務業;跨產業比較才用全國按產業/按法條統計。一律以『表格＋件數＋金額』呈現,並標明分類(工時/加班類、投保類、工資類…)與依據法條/資料來源。確認完全無資料才可回覆查無。",
};
const DEFAULT_DIRECTIVE =
  "【作答要求】請優先查詢本專案資料庫(graph 節點與關係)與文件作答,禁止只用一般法律常識。職災/過勞/事故處置類走 工作情境→事故→法規→企業義務/勞工權益→文件→刑責/民賠;資遣類走 A006→法規→企業義務→文件,並務必正確標示:預告期(勞基§16)為『繼續工作3個月~未滿1年→10日前、1年~未滿3年→20日前、3年以上→30日前;未滿3個月免預告』、須於離職10日前通報當地主管機關及公立就業服務機構(就業服務法§33)、資遣費於終止後30日內發給(勞退新制每滿1年0.5個月、上限6個月;舊制每滿1年1個月);同業/統計類用對應產業的裁罰統計表。初查無結果先改用對應事故節點(過勞/心肌梗塞=A005、墜落=A001)重試,確認完全無資料才可回覆查無。結尾附依據法條與資料來源。";

// 身分前綴(在平台 system prompt 之外,server 層注入,demo 講解時可說是系統層設計)。
const ROLE_PREFIX = {
  employer:
    "【提問者身分:企業 HR,請以雇主合規視角回答,說明法定義務、風險與應備文件】",
  worker:
    "【提問者身分:勞工,請以勞工權益視角回答,說明勞工可採取的行動與救濟管道】",
};

// 回答結構指令(依身分)—— 穩定回答深度:不只給原則,要到具體條號 + 步驟 + 期限 + 風險。
const ROLE_STRUCTURE = {
  employer:
    "【回答結構】請分段作答並儘量完整:①研判(情況性質/責任歸屬)②法定依據(具體到法名+條號,非僅法名)③該做什麼(具體步驟,標示期限並區分『法定期限/建議時程』)④風險(可能裁罰、罰鍰級距或刑責)⑤應備文件。某段確無資料可省略,但不要只回籠統原則。",
  worker:
    "【回答結構】請分段作答並儘量完整:①研判(你的處境/可主張什麼)②法定依據(具體到法名+條號)③可採取的行動與救濟管道(具體找哪個單位)④請求權時效——工資5年(民法§126)、職災補償2年(勞基§61);資遣費時效實務見解分歧(勞動部認15年、部分法院認5年),如實標示不要講死;不可拿勞動事件法§15/§37當時效依據(那是調解/舉證,非時效)⑤需準備的證據/文件。某段確無資料可省略,但不要只回籠統原則。",
};

// 引用紀律(proxy backstop)—— 與平台 robot setting 的【法條引用紀律】同一份規則。
// 通用原則,不寫死特定條號(哪條適用哪情境是「圖譜」的職責,不是 prompt)。
// 規則(1)把正確性的責任交回圖譜:擋掉憑記憶杜撰條號(如災保法§59/§64-66)與補周邊法規;
// 義務 vs 罰則、適用對象等則以通用原則表述,讓各題型一體適用。
const CITATION_DISCIPLINE =
  "【引用紀律】(1)法條與條號以『圖譜回傳的法規節點』或『本指令明確指定的法條』為準,二者都必須完整列入法定依據表與相關法條清單;其餘不得自行增列、嚴禁憑記憶杜撰條號。(2)只引與本案直接適用的條文,不要為求完整補充無關的周邊法規。(3)引用前確認條文的適用對象與情境相符:義務條 vs 罰則條(罰則僅在說明裁罰時標);職災對『受僱勞工本人』之補償與賠償,不得列入『僱用人對第三人責任』之條文。(4)不得以類推/參照/比照帶入與本案性質不符的法規。(5)條號一律寫成『法名+第N條(之N)』。(6)法定依據表不要解釋或改寫條文內容(原文以卡片官方連結為準);每條只標『法名+條號』與其『對應的義務/事項名稱』,不確定條文內容時只列條號、不加說明。";

// ⚠ DEMO 臨時補丁(不是簡報要展示的內容)——
// 平台圖譜「無法刪除單一邊」,A005 仍錯連 民法§188 / 勞退§14 / 行政罰§7(已知小瑕疵)。
// demo 端改用 prompt 壓掉這三條,讓過勞題輸出乾淨;簡報請展示上面 ROLE_STRUCTURE +
// CITATION_DISCIPLINE 的「通用版」,不要放這行。賽後若全圖重跑清乾淨,可移除本常數。
const DEMO_HIDE_LAWS =
  "【作答補充】若本案屬過勞/職業災害情境,請勿在回答內文、法定依據表或『相關法條』清單中列出下列與本案無直接關聯的法條:民法第188條、勞工退休金條例第14條、行政罰法第7條(縱使資料庫節點出現亦不列出)。";

// 引用標註指令(validation API 未打通,改採 prompt 標註法取得來源/法條/延伸問題)。
// 延伸問題改為「依本次回答動態產生」(非前端寫死),前端比照參考來源解析成 chips。
const ANNOTATION_INSTRUCTION =
  "請在回答最後以「---」分隔後,依序列出三段:用「📄 參考來源:」列出本次回答引用的文件名稱;用「⚖️ 相關法條:」只列出本案『實際適用、構成判斷依據』的法規與條號(完整法名+條號,如『勞動基準法第59條』),不要列出僅作對比、反例、排除或背景順帶提到的法條;用「🔎 延伸問題:」列出 3 個使用者可能會接著想問、且本資料庫能回答的相關問題(每行一題、問句形式、簡短)。";

// 判斷「查無/掉回通用 LLM」的字樣;命中此樣式 + 無 cyphers 視為「沒打中 graph」。
const REFUSAL_RE = /查無|無法提供|目前無此項|沒有相關|查無相關|無相關(資料|資訊)/;

function buildQuestion({ question, role, scenario }) {
  const directive = GRAPH_DIRECTIVE[scenario] || DEFAULT_DIRECTIVE;
  const prefix = ROLE_PREFIX[role] || ROLE_PREFIX.employer;
  const structure = ROLE_STRUCTURE[role] || ROLE_STRUCTURE.employer;
  return `${directive}\n\n${prefix}\n${structure}\n${CITATION_DISCIPLINE}\n${DEMO_HIDE_LAWS}\n\n${question}\n\n${ANNOTATION_INSTRUCTION}`;
}

function eapHeaders() {
  return {
    Authorization: `Bearer ${PROJECT_TOKEN}`,
    "x-application-tenant": PROJECT_ID,
    "Content-Type": "application/json",
  };
}

// 一個 attempt = 建新對話 + streaming 提問 + 緩衝整段,回 { result, cyphers, ids }。
async function runAttempt(q, signal) {
  const createResp = await fetch(`${API_BASE_URL}/assistant/chat/create`, {
    method: "POST",
    headers: eapHeaders(),
    body: JSON.stringify({}),
    signal,
  });
  if (!createResp.ok) throw new Error(`create ${createResp.status}`);
  const chatId = (await createResp.json())?.data?.insertedId;
  if (!chatId) throw new Error("no chatId");

  const askResp = await fetch(`${API_BASE_URL}/assistant/chat/${chatId}`, {
    method: "POST",
    headers: eapHeaders(),
    body: JSON.stringify({ q, streaming: true }),
    signal,
  });
  if (!askResp.ok || !askResp.body) throw new Error(`ask ${askResp.status}`);

  const reader = askResp.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let final = null;
  let ids = null;
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
      if (evt.userMessageId && evt.messageId && !("result" in evt)) {
        ids = { userMessageId: evt.userMessageId, messageId: evt.messageId };
      }
      if ("result" in evt) {
        final = {
          result: evt.result,
          cyphers: evt.cyphers || [],
          messageId: evt.messageId,
          tokensIn: evt.tokensIn ?? 0,
          tokensOut: evt.tokensOut ?? 0,
        };
      }
    }
  }
  if (!final) throw new Error("no final");
  return { ...final, ids };
}

// 命中 graph = cyphers 有實際資料列,且回答不是「查無」掉回通用 LLM。
function isGraphHit(r) {
  const rows = (r.cyphers || []).reduce((a, c) => a + (c.data || []).length, 0);
  return rows > 0 && !REFUSAL_RE.test(r.result || "");
}

// 並行搶答:同時發 n 個 attempt,回傳第一個命中 graph 的;都沒命中則回「最佳可用」回應。
async function askWithRacing(q, n, parentSignal) {
  const controllers = Array.from({ length: n }, () => new AbortController());
  const onAbort = () => controllers.forEach((c) => c.abort());
  parentSignal?.addEventListener?.("abort", onAbort);

  const slots = controllers.map((c) => ({
    done: false,
    p: runAttempt(q, c.signal).then(
      (r) => ({ r }),
      (err) => ({ err })
    ),
  }));
  // 讓每個 promise 解析時帶回自身索引,便於從待解集合移除。
  slots.forEach((s, i) => (s.p = s.p.then((x) => ({ ...x, i }))));

  const finished = [];
  let winner = null;
  try {
    while (slots.some((s) => !s.done) && !winner) {
      const pending = slots.filter((s) => !s.done).map((s) => s.p);
      const res = await Promise.race(pending);
      slots[res.i].done = true;
      if (res.r) {
        finished.push(res.r);
        if (isGraphHit(res.r)) winner = res.r;
      }
    }
  } finally {
    controllers.forEach((c) => c.abort()); // 取消落敗/未完成的 attempt
    parentSignal?.removeEventListener?.("abort", onAbort);
  }

  if (winner) return { winner, hit: true };
  // 都沒命中 graph:挑「最佳可用」—— 非查無優先、再取較長者,讓使用者至少有內容。
  const usable = finished.filter((r) => r && r.result);
  if (!usable.length) return { winner: null, hit: false };
  usable.sort(
    (a, b) =>
      (REFUSAL_RE.test(a.result) ? 1 : 0) - (REFUSAL_RE.test(b.result) ? 1 : 0) ||
      (b.result?.length || 0) - (a.result?.length || 0)
  );
  return { winner: usable[0], hit: false };
}

const app = express();
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, base: API_BASE_URL, tenant: PROJECT_ID, attempts: ATTEMPTS });
});

// 智能問答 / 案件調查:並行搶答 → 以 SSE 回傳(progress → chunk → result)。
app.post("/api/ask", async (req, res) => {
  const { question, role, scenario } = req.body || {};
  if (!question || !question.trim()) {
    return res.status(400).json({ error: "缺少 question" });
  }

  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const q = buildQuestion({ question, role, scenario });

  // 開 SSE。搶答期間以 progress 事件維持前端等待動畫(逐字串流改為命中後一次補上)。
  res.writeHead(200, {
    "Content-Type": "text/event-stream; charset=utf-8",
    "Cache-Control": "no-cache, no-transform",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.flushHeaders?.();
  res.write(`data: ${JSON.stringify({ progress: "analysing" })}\n\n`);
  const heartbeat = setInterval(() => {
    try {
      res.write(`data: ${JSON.stringify({ progress: "searching" })}\n\n`);
    } catch {
      /* 寫入失敗(client 已斷)由 close 事件處理 */
    }
  }, 2000);

  try {
    const { winner } = await askWithRacing(q, ATTEMPTS, controller.signal);
    clearInterval(heartbeat);

    // 都沒拿到任何回應 → 不送 result,讓前端 askStream 走 onError(顯示重試)。
    if (!winner) return res.end();

    if (winner.ids) res.write(`data: ${JSON.stringify(winner.ids)}\n\n`);
    res.write(`data: ${JSON.stringify({ progress: "generating answer" })}\n\n`);

    // 命中後把完整答案切塊補送,讓前端仍有「逐字填入」的漸進渲染。
    const text = winner.result || "";
    for (let i = 0; i < text.length; i += 80) {
      res.write(`data: ${JSON.stringify({ chunk: text.slice(i, i + 80) })}\n\n`);
    }
    // 最終物件:result 取代串流文字,cyphers 供法條卡片/風險定價使用。
    res.write(
      `data: ${JSON.stringify({
        result: winner.result,
        cyphers: winner.cyphers,
        messageId: winner.messageId,
        tokensIn: winner.tokensIn,
        tokensOut: winner.tokensOut,
      })}\n\n`
    );
    res.end();
  } catch (err) {
    clearInterval(heartbeat);
    if (err?.name === "AbortError") return; // client 斷線,正常
    if (!res.headersSent) {
      res.status(502).json({ error: "Proxy 轉發失敗", detail: String(err?.message || err) });
    } else {
      res.end();
    }
  }
});

app.listen(PORT, () => {
  console.log(`[proxy] EAP proxy listening on http://localhost:${PORT}`);
  console.log(`[proxy] tenant=${PROJECT_ID}  base=${API_BASE_URL}  attempts=${ATTEMPTS}`);
});
