// 三大情境(docs/scenarios.md)。每情境含 employer / worker 兩套範例問題 chips。
// chip.text 為範例提問;送出後一律走真 API。身分切換僅換 chips;role 前綴在 proxy 層注入。
// 各情境首選 chip 採用 AI-Ready-Data v6「決賽衝刺_交接說明」已實測通過的 soft query
// (不需講「依資料庫」即會觸發 v6 robot setting 路由到 graph,確保 demo 命中真實資料)。

export const ROLES = {
  employer: { id: "employer", label: "資方 / HR", badge: "資方 / HR 視角" },
  worker: { id: "worker", label: "勞工", badge: "勞工權益視角" },
};

export const scenarios = [
  {
    id: "occupational",
    title: "職災處置",
    subtitle: "應急導航",
    desc: "判斷職災類型、責任邊界、法定義務與罰則風險。",
    icon: "helmet",
    chips: {
      employer: [
        {
          text: "我們一名工程師連續多日加班後夜間值班時心肌梗塞送醫。HR 依法要完成哪些通報與處置(含期限與通報單位)?要準備哪些文件?公司可能涉及哪些刑責與民事賠償項目?",
        },
        {
          text: "工程師到客戶機房支援維修,搬伺服器時扭傷腰送醫。算職業災害嗎?雇主責任如何認定?",
        },
        {
          text: "過往有無類似的駐點工程師職災裁罰案例?",
        },
      ],
      worker: [
        {
          text: "我因公司長期加班導致心肌梗塞。我可以請領哪些職災給付?要向哪個單位申請?需要準備什麼證據?",
        },
        {
          text: "我在客戶端駐點受傷,公司說不算職災,我可以怎麼辦?",
        },
        {
          text: "職災醫療期間公司可以要求我請病假或扣薪嗎?",
        },
      ],
    },
  },
  {
    id: "dismissal",
    title: "資遣爭議",
    subtitle: "精準止損",
    desc: "檢查資遣程序、通知期限、舉證資料與訴訟風險。",
    icon: "scale",
    chips: {
      employer: [
        {
          text: "我們要資遣一名工程師。合法資遣的程序步驟、預告期、必備文件有哪些?若勞工申訴,公司需要準備哪些舉證資料?",
        },
        {
          text: "資遣通知期與謀職假怎麼計算?年資 3 年 2 個月的員工要給幾天?",
        },
        {
          text: "同業有沒有因資遣程序瑕疵被裁罰或敗訴的案例?",
        },
      ],
      worker: [
        {
          text: "我被資遣,公司沒給資遣費也沒預告。我有哪些權益、可向哪個單位申訴、要準備什麼證據?",
        },
        {
          text: "公司用「不能勝任工作」資遣我,但沒給過改善機會,合法嗎?",
        },
        {
          text: "被資遣時我可以要求哪些費用?年資 3 年 2 個月怎麼算資遣費?",
        },
      ],
    },
  },
  {
    id: "radar",
    title: "法規雷達",
    subtitle: "風險掃描",
    desc: "依產業與規模查詢同業裁罰趨勢與內控缺口。",
    icon: "radar",
    chips: {
      employer: [
        {
          text: "我們是資訊服務業,員工常常加班。請列出同業最常被裁罰的違規類型與件數對比。",
        },
        {
          text: "資訊服務業因工時/加班/延長工時被裁罰的件數,與投保類違規對比如何?",
        },
        {
          text: "以 50 人規模的公司,勞檢最常查的項目與該準備的內控文件?",
        },
      ],
      worker: [
        {
          text: "資訊服務業這個產業最常踩哪些違規地雷?依同業裁罰統計告訴我。",
        },
        {
          text: "如果公司常態性要求加班又不給加班費,我可以怎麼檢舉?",
        },
      ],
    },
  },
];

export const scenarioById = Object.fromEntries(scenarios.map((s) => [s.id, s]));
