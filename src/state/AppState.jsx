// 跨頁共享狀態(session only,不使用 localStorage)。
// 在 Layout 內包住 <Outlet/>,讓「智能問答」與「案件調查」共用同一份工作區資料:
//   - role:提問/報告身分(employer | worker),切換後報告自動走對應模板。
//   - conversations / activeConvId:對話紀錄。提升到此處,讓兩頁共用的三區側欄
//     (對話紀錄 / 諮詢摘要 / 歷史報告)在 route 切換後仍存活。
//   - summaries:諮詢摘要快照(由對話「匯出諮詢摘要」產生,可下載 / 續問)。
//   - reports:案件調查報告清單(正式立案的案件報告)。
// 一次性 handoff(prefill / caseContext / 跨頁選取)仍走 react-router 的 navigate(path,{state})。
import { createContext, useContext, useState } from "react";
import { scenarios } from "../data/scenarios.js";
import { genHexId } from "../lib/ids.js";

const AppStateContext = createContext(null);

export function makeConversation(scenarioId = scenarios[0].id) {
  return { id: genHexId(), title: "", scenarioId, messages: [] };
}

export function AppStateProvider({ children }) {
  const [role, setRole] = useState("employer"); // employer | worker
  const [conversations, setConversations] = useState(() => [makeConversation()]);
  const [activeConvId, setActiveConvId] = useState(() => null);
  const [summaries, setSummaries] = useState([]); // 諮詢摘要快照(輕量問答)
  const [reports, setReports] = useState([]); // 案件報告(正式立案),不預塞假資料

  // activeConvId 尚未設定時,預設指向第一個對話。
  const resolvedActiveId =
    activeConvId && conversations.some((c) => c.id === activeConvId)
      ? activeConvId
      : conversations[0]?.id || null;

  return (
    <AppStateContext.Provider
      value={{
        role,
        setRole,
        conversations,
        setConversations,
        activeConvId: resolvedActiveId,
        setActiveConvId,
        summaries,
        setSummaries,
        reports,
        setReports,
      }}
    >
      {children}
    </AppStateContext.Provider>
  );
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error("useAppState 必須在 AppStateProvider 內使用");
  return ctx;
}
