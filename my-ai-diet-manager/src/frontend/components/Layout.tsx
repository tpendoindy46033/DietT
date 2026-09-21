import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";
import { Link, usePath, useNavigate } from "../lib/router";
import { api } from "../lib/api";

const NAV_ITEMS: { to: string; label: string; icon: IconName }[] = [
  { to: "/today", label: "Today", icon: "today" },
  { to: "/history", label: "History", icon: "history" },
  { to: "/progress", label: "Progress", icon: "progress" },
  { to: "/settings", label: "Settings", icon: "settings" }
];

export function Layout({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const path = usePath();
  const navigate = useNavigate();
  const showFab = path === "/today" || path === "/history";

  const handleLogout = async () => {
    try {
      await api.post("/api/auth/logout");
    } finally {
      onLogout();
    }
  };

  return (
    <div className="app-shell">
      <aside className="app-sidebar">
        <div className="app-sidebar-brand">
          <Icon name="leaf" />
          <span>AI Diet Manager</span>
        </div>
        <nav className="app-sidebar-nav">
          {NAV_ITEMS.map((item) => (
            <Link key={item.to} to={item.to} className="sidebar-nav-item" ariaCurrent={path === item.to ? "page" : undefined}>
              <Icon name={item.icon} />
              {item.label}
            </Link>
          ))}
        </nav>
        <div style={{ marginTop: "auto" }}>
          <button type="button" className="sidebar-nav-item" onClick={handleLogout}>
            <Icon name="logout" />
            Log out
          </button>
        </div>
      </aside>

      <div className="app-main">
        <div className="app-content">{children}</div>
      </div>

      {showFab && (
        <button type="button" className="fab" onClick={() => navigate("/add-meal")}>
          <Icon name="plus" />
          Add Meal
        </button>
      )}

      <nav className="bottom-nav" aria-label="Primary">
        {NAV_ITEMS.map((item) => (
          <Link key={item.to} to={item.to} className="bottom-nav-item" ariaCurrent={path === item.to ? "page" : undefined}>
            <Icon name={item.icon} />
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
