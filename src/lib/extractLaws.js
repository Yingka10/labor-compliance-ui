// 法條卡片資料來源 — 「以回答實際引用為主」(CLAUDE.md §法條卡片資料來源):
//   主來源 = 回答內文 regex + 模型自列的「相關法條」標註段(這則回答真正用到的依據)。
//   後備   = cyphers(圖譜節點),只在內文/標註完全沒列任何條號時才採用。
//   理由:cyphers 會把「情境通用節點」一起撈回(如過勞職災題也帶出 性平§13 / 民法§188 /
//   職安§6),那是周邊噪音,且會用通用條號蓋掉內文的具體條號(職安§43 等)。故不再無條件
//   採信 cyphers。去重後每條附全國法規資料庫官方原文連結(查無 pcode 的非白名單法規不顯示)。

// 已驗證的全國法規資料庫 pcode(law.moj.gov.tw,2026-06 逐一查證,涵蓋本系統可能引用的勞動法規)。
// 未列者僅顯示條號、不附連結。
const LAW_PCODE = {
  // 勞動基準 / 工資 / 退休
  勞動基準法: "N0030001",
  勞動基準法施行細則: "N0030002",
  勞工請假規則: "N0030006",
  勞工退休金條例: "N0030020",
  勞工退休金條例施行細則: "N0030021",
  最低工資法: "N0030028",
  // 性別平等
  性別平等工作法: "N0030014",
  性別平等工作法施行細則: "N0030015",
  // 職業安全衛生 / 職災
  職業安全衛生法: "N0060001",
  職業安全衛生法施行細則: "N0060002",
  職業災害勞工保護法: "N0060041",
  // 就業 / 社會保險
  就業服務法: "N0090001",
  就業服務法施行細則: "N0090006",
  中高齡者及高齡者就業促進法: "N0090055",
  就業保險法: "N0050021",
  勞工保險條例: "N0050001",
  勞工保險條例施行細則: "N0050002",
  勞工職業災害保險及保護法: "N0050031",
  // 集體勞動 / 爭議 / 訴訟
  勞資爭議處理法: "N0020007",
  大量解僱勞工保護法: "N0020012",
  工會法: "N0020001",
  工會法施行細則: "N0020002",
  團體協約法: "N0020006",
  勞動事件法: "B0010064",
  // 普通法
  民法: "B0000001",
  中華民國刑法: "C0000001",
};

// 常見簡稱 / 舊名 → 正式法名(時間軸 lawRef、回答本文、cyphers 法規名稱常用簡稱)。
const LAW_ABBR = {
  勞基法: "勞動基準法",
  勞基法施行細則: "勞動基準法施行細則",
  勞退條例: "勞工退休金條例",
  勞退條例施行細則: "勞工退休金條例施行細則",
  職安法: "職業安全衛生法",
  職安法施行細則: "職業安全衛生法施行細則",
  職保法: "職業災害勞工保護法",
  性平法: "性別平等工作法",
  性工法: "性別平等工作法",
  性別工作平等法: "性別平等工作法", // 2023 更名前舊名
  就服法: "就業服務法",
  就保法: "就業保險法",
  勞保條例: "勞工保險條例",
  災保法: "勞工職業災害保險及保護法",
  勞職保法: "勞工職業災害保險及保護法",
  勞資爭議法: "勞資爭議處理法",
  大解法: "大量解僱勞工保護法",
  中高齡就業法: "中高齡者及高齡者就業促進法",
  刑法: "中華民國刑法",
  民法: "民法",
};

// 已知法名(用於修掉 regex 對前綴的過度捕捉,如「特別是勞動基準法」→「勞動基準法」)。
// 直接由 pcode 表推導,長者優先比對後綴,避免與表脫鉤。
const KNOWN_LAWS = Object.keys(LAW_PCODE).sort((a, b) => b.length - a.length);

// 後綴對照表:正式法名(→自身)+ 簡稱/舊名(→正式名),由長到短,
// 用來修掉自由文字的前綴雜訊與簡稱(如「雇主以勞基法」→「勞動基準法」、「特別是勞動基準法」→「勞動基準法」)。
const SUFFIX_MAP = [
  ...KNOWN_LAWS.map((k) => [k, k]),
  ...Object.keys(LAW_ABBR).map((k) => [k, LAW_ABBR[k]]),
].sort((a, b) => b[0].length - a[0].length);

// 把 regex / cyphers 抓到的法名修正為正式法名:先查簡稱表,再以後綴比對(含簡稱)去除前綴雜訊。
function canonicalLaw(raw) {
  if (LAW_ABBR[raw]) return LAW_ABBR[raw];
  for (const [suffix, full] of SUFFIX_MAP) {
    if (raw.endsWith(suffix)) return full;
  }
  return raw;
}

// 官方原文連結(查無 pcode 回 null)。flno:第32條之1 → "32-1";第59條 → "59"。
function officialUrl(law, num, sub) {
  const pcode = LAW_PCODE[law];
  if (!pcode) return null;
  const flno = sub ? `${num}-${sub}` : `${num}`;
  return `https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${pcode}&flno=${flno}`;
}

// 由法名/簡稱 + 條號 產生官方連結。
//   有條號 → LawSingle 單條(flno:第32條之1 → "32-1");
//   無條號 → LawAll 整部法規首頁;查無 pcode 回 null。
export function lawArticleUrl(nameOrAbbr, num, sub) {
  const full = LAW_ABBR[nameOrAbbr] || nameOrAbbr;
  const pcode = LAW_PCODE[full];
  if (!pcode) return null;
  if (num == null || num === "")
    return `https://law.moj.gov.tw/LawClass/LawAll.aspx?pcode=${pcode}`;
  const flno = sub ? `${num}-${sub}` : `${num}`;
  return `https://law.moj.gov.tw/LawClass/LawSingle.aspx?pcode=${pcode}&flno=${flno}`;
}

// 可連結的法名 token(正式名 + 簡稱),長者優先以免「勞基法施行細則」被「勞基法」截斷。
const LINKABLE_TOKENS = [...new Set([...Object.keys(LAW_PCODE), ...Object.keys(LAW_ABBR)])].sort(
  (a, b) => b.length - a.length
);
const ESC = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// 比對「<法名> §N」「<法名> §N之N」「<法名>第N條」「<法名>第N條之N」,條號可省(→整部法規)。
const LINKIFY_RE = new RegExp(
  `(${LINKABLE_TOKENS.map(ESC).join("|")})\\s*(?:§\\s*(\\d+)(?:\\s*之\\s*(\\d+))?|第\\s*(\\d+)\\s*條(?:\\s*之\\s*(\\d+))?)?`,
  "g"
);

/**
 * 把含法條引用的字串切成可渲染片段,讓含 pcode 的法規變成官方連結。
 * @param {string} text
 * @returns {Array<string | {text:string, url:string}>}  純文字片段或連結片段
 */
export function linkifyLawText(text) {
  if (!text) return [];
  const out = [];
  let last = 0;
  LINKIFY_RE.lastIndex = 0;
  let m;
  while ((m = LINKIFY_RE.exec(text)) !== null) {
    const [matched, token, n1, s1, n2, s2] = m;
    const num = n1 ?? n2;
    const sub = s1 ?? s2;
    const url = lawArticleUrl(token, num, sub);
    if (!url) continue; // 無 pcode 不連結,留給後面當純文字處理
    if (m.index > last) out.push(text.slice(last, m.index));
    out.push({ text: matched, url });
    last = m.index + matched.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out.length ? out : [text];
}

// 從本文/標註段萃取「法名 + 條號」用的 regex —— 鎖定 26 部已知法名(含簡稱、含
// 條例/規則/細則,如 民法、勞工保險條例、勞工請假規則、勞動基準法施行細則),
// 而非任何「以法結尾的字串」。如此能補齊舊版漏抓的 民法/條例/規則/細則,又因只認
// 白名單法名,「辦法/方法第N條」之類根本不會被捕捉。條號可為「§N / 第N條」(必填,
// 可帶 之N),長名優先比對(LINKABLE_TOKENS 已由長到短排序),避免被短法名截斷。
const LAW_REF = new RegExp(
  `(${LINKABLE_TOKENS.map(ESC).join("|")})\\s*(?:§\\s*(\\d+)(?:\\s*之\\s*(\\d+))?|第\\s*(\\d+)\\s*條(?:\\s*之\\s*(\\d+))?)`,
  "g"
);

// 連續條號:同一法名後以頓號/連接詞接續的條號(如「勞動基準法第59條、第79條」「勞基§59及§79」),
// 沿用前一個法名。必須有連接詞(、,，及與或和)才接,避免把下一句的條號誤併。
const LAW_CONT = /^\s*[、,，及與或和]\s*(?:§\s*(\d+)(?:\s*之\s*(\d+))?|第\s*(\d+)\s*條(?:\s*之\s*(\d+))?)/;

function normalize(rawLaw, num, sub) {
  const law = canonicalLaw(rawLaw);
  const article = sub ? `第${num}條之${sub}` : `第${num}條`;
  return {
    law,
    article,
    key: `${law}|${article}`,
    display: `${law}${article}`,
    url: officialUrl(law, num, sub),
  };
}

// 從任意字串萃取所有法規引用。
function fromText(text) {
  const out = [];
  if (!text) return out;
  LAW_REF.lastIndex = 0;
  let m;
  while ((m = LAW_REF.exec(text)) !== null) {
    const law = m[1];
    out.push(normalize(law, m[2] ?? m[4], m[3] ?? m[5])); // m[2]=§N、m[4]=第N條;m[3]/m[5]=之N
    // 沿用同一法名,吃掉後續「、第N條」「及§N」等連續條號。
    let cursor = LAW_REF.lastIndex;
    let c;
    while ((c = LAW_CONT.exec(text.slice(cursor))) !== null) {
      out.push(normalize(law, c[1] ?? c[3], c[2] ?? c[4]));
      cursor += c[0].length;
    }
    LAW_REF.lastIndex = cursor;
  }
  return out;
}

/**
 * @param {import("../types.js").Cypher[]} cyphers
 * @param {string} body                解析掉標註段後的回答本文
 * @param {string[]} lawRefs           parseCitations 取得的「相關法條」標註項
 * @returns {Array<{law:string, article:string, display:string, url:string|null}>}
 */
export function extractLaws(cyphers = [], body = "", lawRefs = []) {
  // 主來源:回答內文 + 模型自列的「相關法條」標註段(這則回答實際引用到的條文)。
  const fromBody = fromText(body);
  const fromAnno = (lawRefs || []).flatMap((r) => fromText(r));
  let refs = [...fromBody, ...fromAnno];

  // 後備:內文/標註完全沒抓到任何條號(模型只寫法名沒寫條)才退回 cyphers 圖譜節點,
  // 避免一般情況下用圖譜的通用條號蓋掉內文的具體條號。
  if (refs.length === 0) {
    const fromCyphers = [];
    for (const cy of cyphers || []) {
      for (const row of cy.data || []) {
        const law = row["法規條文_法規"];
        const num = row["法規條文_條號"];
        if (law && num) {
          const cleaned = String(num).match(/第?\s*(\d+)\s*條(?:之\s*(\d+))?/);
          if (cleaned) fromCyphers.push(normalize(law, cleaned[1], cleaned[2]));
        }
      }
    }
    refs = fromCyphers;
  }

  // 白名單:只保留全國法規資料庫已驗證的勞動法(LAW_PCODE 共 26 部);
  // 連同 fromText 的 token 鎖定,雙重擋掉「辦法/方法第N條」與非勞動法噪音。
  const whitelisted = refs.filter((r) => LAW_PCODE[r.law]);

  // 去重(key = 法名|條號),保持出現順序
  const seen = new Set();
  const result = [];
  for (const r of whitelisted) {
    if (seen.has(r.key)) continue;
    seen.add(r.key);
    result.push({ law: r.law, article: r.article, display: r.display, url: r.url });
  }
  return result;
}
