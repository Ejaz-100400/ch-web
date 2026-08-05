import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { FadeIn } from "../ui/FadeIn";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useAuth } from "../../lib/auth-context";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13.5 }}>
        Loading…
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  async function handleLogout() {
    await signOut();
    navigate("/login");
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--paper)" }}>
      <Sidebar onLogout={handleLogout} />
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div className="app-main-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 60px" }}>
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 16 }}>
            <ThemeToggle />
          </div>
          <FadeIn>
            <Outlet />
          </FadeIn>
        </div>
      </main>
    </div>
  );
}
