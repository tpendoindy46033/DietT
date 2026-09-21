import { useCallback, useEffect, useState } from "react";
import { Layout } from "./components/Layout";
import { SkeletonPage } from "./components/Skeleton";
import { ProfileProvider } from "./lib/ProfileContext";
import { matchPath, usePath, useNavigate } from "./lib/router";
import { api } from "./lib/api";

import { LoginPage } from "./pages/LoginPage";
import { TodayPage } from "./pages/TodayPage";
import { AddMealPage } from "./pages/AddMealPage";
import { MealEditPage } from "./pages/MealEditPage";
import { HistoryPage } from "./pages/HistoryPage";
import { ProgressPage } from "./pages/ProgressPage";
import { SettingsPage } from "./pages/SettingsPage";

type AuthState = "checking" | "authenticated" | "unauthenticated";

export function App() {
  const [authState, setAuthState] = useState<AuthState>("checking");
  const path = usePath();
  const navigate = useNavigate();

  const checkSession = useCallback(async () => {
    try {
      const data = await api.get<{ authenticated: boolean }>("/api/auth/session");
      setAuthState(data.authenticated ? "authenticated" : "unauthenticated");
    } catch {
      setAuthState("unauthenticated");
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  useEffect(() => {
    if (authState === "unauthenticated" && path !== "/login") {
      navigate("/login", { replace: true });
    }
    if (authState === "authenticated" && (path === "/login" || path === "/")) {
      navigate("/today", { replace: true });
    }
  }, [authState, path, navigate]);

  if (authState === "checking") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: "var(--space-6)" }}>
        <SkeletonPage />
      </div>
    );
  }

  if (authState !== "authenticated") {
    return <LoginPage onLoggedIn={() => setAuthState("authenticated")} />;
  }

  return (
    <ProfileProvider>
      <Layout onLogout={() => setAuthState("unauthenticated")}>
        <Routes path={path} />
      </Layout>
    </ProfileProvider>
  );
}

function Routes({ path }: { path: string }) {
  if (path === "/today") return <TodayPage />;
  if (path === "/add-meal") return <AddMealPage />;
  if (path === "/history") return <HistoryPage />;
  if (path === "/progress") return <ProgressPage />;
  if (path === "/settings") return <SettingsPage />;

  const editMatch = matchPath("/meals/:id/edit", path);
  if (editMatch) return <MealEditPage mealId={editMatch.id} />;

  return <TodayPage />;
}
