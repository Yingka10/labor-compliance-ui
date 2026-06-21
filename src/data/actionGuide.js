// 勞工版諮詢摘要的「救濟管道」—— 把「找哪個窗口、怎麼找」攤開(勞工最大痛點:不知道找誰)。
// 僅列真實、公開的官方管道(勞動部 1955 專線、地方勞工局、勞保局、勞檢機構、法院),不杜撰。
// 「時效」另由 claims.js 的 limitations 呈現(已對法條查證),此處聚焦窗口與作法。

export const workerRemedies = {
  occupational: [
    { action: "向雇主請求職業災害補償", authority: "雇主" },
    { action: "申請勞資爭議調解", authority: "事業單位所在地縣市政府勞工局 / 處" },
    { action: "申請職災保險給付", authority: "勞動部勞工保險局", note: "備妥診斷證明與投保資料" },
    { action: "申訴 / 檢舉違法(可具名或匿名)", authority: "地方勞動檢查機構、勞動部職業安全衛生署" },
    { action: "撥打勞工諮詢申訴專線", authority: "勞動部 1955 專線(免付費)" },
  ],
  dismissal: [
    { action: "申請勞資爭議調解", authority: "縣市政府勞工局 / 處" },
    { action: "請求雇主開立非自願離職證明", authority: "雇主", note: "請領失業給付必備" },
    { action: "申請失業給付", authority: "勞動部勞工保險局", note: "需非自願離職證明" },
    { action: "申訴資遣程序瑕疵", authority: "地方勞動檢查機構" },
    { action: "提起確認僱傭關係存在之訴", authority: "法院(勞動事件法,可先聲請勞動調解)", note: "宜儘速主張,避免被視為默示同意終止" },
    { action: "撥打勞工諮詢申訴專線", authority: "勞動部 1955 專線(免付費)" },
  ],
  radar: [
    { action: "檢舉違法(可具名或匿名)", authority: "地方勞動檢查機構、勞動部職業安全衛生署" },
    { action: "申請勞資爭議調解", authority: "縣市政府勞工局 / 處" },
    { action: "撥打勞工諮詢申訴專線", authority: "勞動部 1955 專線(免付費)" },
  ],
};
