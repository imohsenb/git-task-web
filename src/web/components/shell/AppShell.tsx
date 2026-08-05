import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";
import { useLiveEvents } from "../../lib/liveEvents";

export function AppShell() {
  useLiveEvents();

  return (
    <div className="min-h-screen bg-canvas p-4">
      <div className="mx-auto flex max-w-[1600px] overflow-hidden rounded-shell bg-shell shadow-shell min-h-[calc(100vh-2rem)]">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <main className="flex-1 overflow-y-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
