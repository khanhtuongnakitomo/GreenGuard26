import type { PropsWithChildren } from "react";
import { Bell } from "lucide-react";
import { BottomNav } from "./BottomNav";

export function MobileShell({ children }: PropsWithChildren) {
  return (
    <main className="mobile-shell">
      <div className="status-bar">
        <strong>9:41</strong>
        <span>100</span>
      </div>
      <header className="top-bar">
        <div className="brand">
          <div className="leaf-logo" />
          <h1>GreenPoint</h1>
        </div>
        <button className="icon-button" aria-label="Notifications">
          <Bell size={22} />
          <span />
        </button>
      </header>
      {children}
      <BottomNav />
    </main>
  );
}
