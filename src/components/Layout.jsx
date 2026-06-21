import { Outlet } from "react-router-dom";
import { AppStateProvider } from "../state/AppState.jsx";

// 無頂部橫向 nav;導覽改置於各頁全高側欄(SidebarNav)。
// AppStateProvider 包住 Outlet:role / reports 跨頁共享,route 切換不重置。
export default function Layout() {
  return (
    <AppStateProvider>
      <div className="h-screen overflow-hidden bg-[#f6f8fb]">
        <Outlet />
      </div>
    </AppStateProvider>
  );
}
