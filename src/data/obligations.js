// 法定義務 / 行動里程碑定義(規則引擎 src/lib/deadlines.js 的輸入)。
// 內容已對照全國法規資料庫條文校正(2026-06):
//   kind="法定期限" 代表有明確法定時限(例:8 小時、10 日前、30 日內);
//   kind="建議時程" 代表法律未訂單一天數,僅為合規操作里程碑(天數為實務建議,非法定到期)。
// 每項:
//   id            唯一鍵(也是 report.completed 的 key)
//   label         義務名稱
//   lawRef        依據法條(顯示用)
//   kind          "法定期限" | "建議時程"
//   anchor        錨點欄位名(對應表單 values 的 date 欄位)
//   offset        相對錨點的偏移:{ hours } 或 { days }(可為負,代表錨點日「之前」)
//   urgentWithinDays  距到期幾天內視為「緊急」(倒數 badge)
//   desc          一句話說明
// 僅 occupational / dismissal 有具體事件日期可做時間軸;radar 走輕量版(無此資料)。

export const obligations = {
  occupational: [
    {
      id: "report8h",
      label: "通報勞動檢查機構",
      lawRef: "職安法 §37 II",
      kind: "法定期限",
      anchor: "accidentDate",
      offset: { hours: 8 },
      urgentWithinDays: 1,
      desc: "發生死亡、罹災 3 人以上、或 1 人以上需住院之職災,應於 8 小時內通報。",
    },
    {
      id: "preserve",
      label: "急救搶救與現場保全",
      lawRef: "職安法 §37 I、IV",
      kind: "建議時程",
      anchor: "accidentDate",
      offset: { days: 1 },
      urgentWithinDays: 1,
      desc: "立即急救搶救;非經勞檢或司法機關許可不得移動或破壞現場,並會同勞工代表調查、分析、製作紀錄。",
    },
    {
      id: "docsPrep",
      label: "職災相關文件備齊",
      lawRef: "勞基法 §59",
      kind: "建議時程",
      anchor: "accidentDate",
      offset: { days: 15 },
      urgentWithinDays: 5,
      desc: "備齊診斷證明、出勤紀錄與補償計算等文件(實務建議時程,非法定期限)。",
    },
    {
      id: "compensation",
      label: "職災補償(醫療 / 工資)",
      lawRef: "勞基法 §59",
      kind: "建議時程",
      anchor: "accidentDate",
      offset: { days: 30 },
      urgentWithinDays: 7,
      desc: "依法給付必要醫療費用,醫療期間原領工資補償按月給付(無單一法定到期日)。",
    },
    {
      id: "insuranceClaim",
      label: "協助申辦職災保險給付",
      lawRef: "災保法",
      kind: "建議時程",
      anchor: "accidentDate",
      offset: { days: 30 },
      urgentWithinDays: 7,
      desc: "協助勞工申請職業災害保險給付(給付請求權時效 5 年,建議儘速辦理)。",
    },
  ],
  dismissal: [
    {
      id: "notifyAuthority",
      label: "資遣通報地方主管機關",
      lawRef: "就服法 §33",
      kind: "法定期限",
      anchor: "noticeDate",
      offset: { days: -10 },
      urgentWithinDays: 3,
      desc: "至遲於資遣生效 10 日前通報當地主管機關及公立就服機構(天災等不可抗力則離職後 3 日內)。",
    },
    {
      id: "severancePrep",
      label: "資遣費 / 預告工資核算",
      lawRef: "勞基法 §16、勞退條例 §12",
      kind: "建議時程",
      anchor: "noticeDate",
      offset: { days: -5 },
      urgentWithinDays: 3,
      desc: "完成資遣費與預告工資試算與核給準備(實務建議時程,見下方試算)。",
    },
    {
      id: "settleWages",
      label: "結清工資",
      lawRef: "勞基法施行細則 §9",
      kind: "法定期限",
      anchor: "noticeDate",
      offset: { days: 0 },
      urgentWithinDays: 2,
      desc: "勞動契約終止時,雇主應即結清工資給付勞工。",
    },
    {
      id: "serviceCert",
      label: "開立服務 / 非自願離職證明",
      lawRef: "勞基法 §19、就保法 §11",
      kind: "法定期限",
      anchor: "noticeDate",
      offset: { days: 0 },
      urgentWithinDays: 2,
      desc: "勞工請求時應發給服務證明書;並開立非自願離職證明,供請領失業給付。",
    },
    {
      id: "paySeverance",
      label: "發給資遣費",
      lawRef: "勞退條例 §12",
      kind: "法定期限",
      anchor: "noticeDate",
      offset: { days: 30 },
      urgentWithinDays: 7,
      desc: "資遣費應於終止勞動契約後 30 日內發給。",
    },
    {
      id: "handover",
      label: "職務交接與離職手續",
      lawRef: "—",
      kind: "建議時程",
      anchor: "noticeDate",
      offset: { days: 0 },
      urgentWithinDays: 2,
      desc: "完成職務交接、資產歸還與離職流程(非法定期限)。",
    },
  ],
};
