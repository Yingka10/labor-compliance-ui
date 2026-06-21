// 案件調查表單欄位設定(docs/scenarios.md)。骨架版:欄位齊全、可預填,報告輸出先做精簡版。
// type: text | date | number | select | radio | multi | textarea

export const investigateForms = {
  occupational: {
    title: "職災處置",
    fields: [
      { key: "accidentDate", label: "事故日期", type: "date" },
      {
        key: "location",
        label: "事故地點類型",
        type: "select",
        options: ["公司內", "客戶端駐點", "居家辦公", "通勤途中"],
      },
      {
        key: "severity",
        label: "傷害程度",
        type: "select",
        options: ["輕傷", "需住院", "失能", "死亡"],
      },
      {
        key: "employment",
        label: "受僱型態",
        type: "select",
        options: ["正職", "派遣", "承攬外包"],
      },
      {
        key: "reported",
        label: "是否已通報勞檢機構",
        type: "radio",
        options: ["是", "否"],
      },
      {
        key: "description",
        label: "事故經過簡述",
        type: "textarea",
        prefillTarget: true,
      },
    ],
  },
  dismissal: {
    title: "資遣爭議",
    fields: [
      {
        key: "reason",
        label: "資遣事由(勞基法第11條)",
        type: "select",
        options: [
          "第1款 歇業或轉讓",
          "第2款 虧損或業務緊縮",
          "第3款 不可抗力暫停工作一個月以上",
          "第4款 業務性質變更且無適當工作可安置",
          "第5款 對所擔任工作確不能勝任",
        ],
      },
      { key: "tenureYears", label: "員工年資(年)", type: "number" },
      { key: "tenureMonths", label: "員工年資(月)", type: "number" },
      {
        key: "pensionSystem",
        label: "適用退休金制度(影響資遣費計算)",
        type: "radio",
        options: ["勞退新制", "勞退舊制"],
      },
      {
        key: "pip",
        label: "是否有績效改善紀錄 PIP",
        type: "radio",
        options: ["是", "否"],
      },
      {
        key: "advanceNotice",
        label: "是否已預告",
        type: "radio",
        options: ["是", "否"],
      },
      { key: "noticeDate", label: "預定資遣生效日(時間軸錨點)", type: "date" },
      { key: "avgWage", label: "月平均工資(元)", type: "number" },
      {
        key: "note",
        label: "爭議說明",
        type: "textarea",
        prefillTarget: true,
      },
    ],
  },
  radar: {
    title: "法規雷達",
    fields: [
      {
        // 產業別決定報告打中哪張裁罰統計表:選「資訊服務業」會命中 v6 IT 三表
        // (資訊服務業違規分類/違反法條/違規態樣統計),回工時 vs 投保對比真實件數。
        key: "industry",
        label: "產業別",
        type: "select",
        options: [
          "資訊服務業",
          "製造業",
          "營造業",
          "批發及零售業",
          "住宿及餐飲業",
          "醫療保健及社會工作服務業",
          "運輸及倉儲業",
          "其他",
        ],
      },
      {
        key: "companySize",
        label: "公司規模",
        type: "select",
        options: ["30 人以下", "30-99 人", "100-499 人", "500 人以上"],
      },
      {
        key: "workSystem",
        label: "工時制度",
        type: "select",
        options: ["標準工時", "變形工時", "責任制核備"],
      },
      {
        key: "focus",
        label: "關注面向",
        type: "multi",
        options: ["工時", "加班費", "職災", "資遣", "性平"],
      },
      {
        key: "note",
        label: "補充說明",
        type: "textarea",
        prefillTarget: true,
      },
    ],
  },
};

// 依填入欄位產出精簡風險等級(骨架版啟發式;完整評估留待下一階段)。
export function assessRisk(scenarioId, values) {
  if (scenarioId === "occupational") {
    if (["死亡", "失能"].includes(values.severity)) return "高";
    if (values.severity === "需住院" || values.reported === "否") return "中";
    return "低";
  }
  if (scenarioId === "dismissal") {
    if (values.reason?.startsWith("第5款") && values.pip === "否") return "高";
    if (values.advanceNotice === "否") return "中";
    return "低";
  }
  return "中";
}
