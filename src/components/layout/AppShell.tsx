import { useEffect, useState } from "react";
import { Menu, ShieldOff } from "lucide-react";
import { Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { FadeIn } from "../ui/FadeIn";
import { ThemeToggle } from "../ui/ThemeToggle";
import { useAuth } from "../../lib/auth-context";

export function AppShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, appUser, loading, signOut } = useAuth();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Close the drawer automatically whenever the route changes (e.g. tapping
  // a nav link already closes it via Sidebar's onClick, but this also
  // covers programmatic navigation elsewhere in the app).
  useEffect(() => {
    setMobileNavOpen(false);
  }, [location.pathname]);

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

  // A valid Supabase session (e.g. a Google account that authenticated fine)
  // doesn't by itself mean this person has a Custom Headlights account --
  // every API call requires a matching `users` row, so without one every
  // page would just be a wall of failed requests. Catch it here instead.
  if (!appUser) {
    return (
      <div style={{ display: "flex", height: "100vh", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, padding: 24, textAlign: "center" }}>
        <ShieldOff size={28} color="var(--text-faint)" />
        <div>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>This account isn't set up yet</p>
          <p style={{ fontSize: 13.5, color: "var(--text-soft)", maxWidth: 340 }}>
            {session.user.email} signed in successfully, but doesn't have a Custom Headlights account. Ask an admin to add you, then sign in again.
          </p>
        </div>
        <button
          onClick={handleLogout}
          style={{
            padding: "9px 18px",
            background: "var(--paper-raised)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-sm)",
            fontSize: 13.5,
            fontWeight: 600,
          }}
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--paper)" }}>
      {mobileNavOpen && <div className="mobile-sidebar-backdrop" onClick={() => setMobileNavOpen(false)} />}
      <Sidebar onLogout={handleLogout} mobileOpen={mobileNavOpen} onCloseMobile={() => setMobileNavOpen(false)} />
      <main style={{ flex: 1, overflowY: "auto", minWidth: 0 }}>
        <div className="app-main-inner" style={{ maxWidth: 1180, margin: "0 auto", padding: "32px 40px 60px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="mobile-topbar-btn"
              style={{ alignItems: "center", justifyContent: "center", width: 36, height: 36, background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", color: "var(--text)" }}
            >
              <Menu size={18} />
            </button>
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
