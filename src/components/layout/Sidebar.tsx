import { useEffect, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  Users,
  BarChart3,
  Download,
  Upload,
  LogOut,
  PhoneIncoming,
  PhoneMissed,
  ClipboardList,
  Phone,
  UserCog,
  Package,
  UsersRound,
  CalendarClock,
  TrendingUp,
  X,
  Boxes,
  LayoutDashboard,
  ArrowLeftRight,
  Bookmark,
  Shield,
} from "lucide-react";
import { Waveform } from "../ui/Waveform";
import { Avatar } from "../ui/Avatar";
import { Logo } from "../ui/Logo";
import { useAuth, canManage } from "../../lib/auth-context";
import { api } from "../../lib/api";

const NAV_ITEMS = [
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/calls", label: "Calls", icon: PhoneIncoming },
  { to: "/missed-calls", label: "Missed Calls", icon: PhoneMissed },
  { to: "/follow-ups", label: "Follow-ups", icon: ClipboardList },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/reports", label: "Reports", icon: BarChart3 },
  { to: "/export", label: "Export", icon: Download },
  { to: "/import", label: "Import", icon: Upload },
  { to: "/business-numbers", label: "Business Numbers", icon: Phone },
  { to: "/team-coverage", label: "Team Coverage", icon: CalendarClock },
];

const MANAGER_NAV_ITEMS = [
  { to: "/products", label: "Products", icon: Package },
  { to: "/customer-tracker", label: "Customer Tracker", icon: TrendingUp },
];
const ADMIN_NAV_ITEMS = [
  { to: "/employees", label: "Employees", icon: UserCog },
  { to: "/team", label: "Team", icon: UsersRound },
];
const OWNER_NAV_ITEMS = [{ to: "/login-activity", label: "Login Activity", icon: Shield }];

const STOCK_NAV_ITEMS = [
  { to: "/stock", label: "Overview", icon: LayoutDashboard },
  { to: "/stock/items", label: "Stock Items", icon: Package },
  { to: "/stock/movements", label: "Movements", icon: ArrowLeftRight },
];

const ROLE_LABEL: Record<string, string> = { admin: "Admin", manager: "Manager", viewer: "Viewer" };

export function Sidebar({
  onLogout,
  mobileOpen = false,
  onCloseMobile,
}: {
  onLogout: () => void;
  mobileOpen?: boolean;
  onCloseMobile?: () => void;
}) {
  const { appUser } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [inFlight, setInFlight] = useState<number | null>(null);
  const canSeeStock = canManage(appUser?.role);
  const mode: "calls" | "stock" = canSeeStock && location.pathname.startsWith("/stock") ? "stock" : "calls";

  useEffect(() => {
    let active = true;
    async function poll() {
      try {
        // No status filter exists on GET /calls, so this samples the most
        // recent page of calls -- a fair proxy for "what's in flight right
        // now" at this business's call volume.
        const { items } = await api.calls.list({ pageSize: 100 });
        if (!active) return;
        setInFlight(items.filter((c) => c.status === "pending" || c.status === "processing").length);
      } catch {
        if (active) setInFlight(null);
      }
    }
    poll();
    const id = setInterval(poll, 30000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  return (
    <aside
      className={`app-sidebar${mobileOpen ? " is-open" : ""}`}
      style={{
        width: 232,
        flexShrink: 0,
        background: "var(--ink)",
        color: "var(--text-inverse)",
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "20px 14px",
        transition: "width 180ms ease",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "4px 8px 26px" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: "var(--brand)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <Logo size={17} color="var(--on-brand)" />
        </div>
        <span className="app-sidebar-label" style={{ display: "flex", flexDirection: "column", lineHeight: 1.08, flex: 1 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 14, letterSpacing: "0.01em" }}>CUSTOM</span>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 10.5, color: "var(--text-inverse-soft)", letterSpacing: "0.06em" }}>
            HEADLIGHTS
          </span>
        </span>
        <button
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="mobile-sidebar-close"
          style={{ background: "transparent", border: "none", color: "var(--text-inverse-soft)", padding: 6, borderRadius: 6, flexShrink: 0 }}
        >
          <X size={18} />
        </button>
      </div>

      {canSeeStock && (
        <div style={{ display: "flex", gap: 3, padding: "0 2px 16px" }}>
          <button
            onClick={() => navigate("/customers")}
            title="Call Tracking"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 6px",
              border: "none",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              background: mode === "calls" ? "var(--brand)" : "var(--surface-1)",
              color: mode === "calls" ? "var(--on-brand)" : "var(--text-inverse-soft)",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            <Phone size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
            <span className="app-sidebar-label">Call Tracking</span>
          </button>
          <button
            onClick={() => navigate("/stock")}
            title="Stock Tracking"
            style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              padding: "8px 6px",
              border: "none",
              borderRadius: 7,
              fontSize: 12,
              fontWeight: 700,
              background: mode === "stock" ? "var(--brand)" : "var(--surface-1)",
              color: mode === "stock" ? "var(--on-brand)" : "var(--text-inverse-soft)",
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            <Boxes size={13} strokeWidth={2.4} style={{ flexShrink: 0 }} />
            <span className="app-sidebar-label">Stock Tracking</span>
          </button>
        </div>
      )}

      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[
          ...(mode === "stock"
            ? STOCK_NAV_ITEMS
            : [
                ...NAV_ITEMS,
                ...(canManage(appUser?.role) ? MANAGER_NAV_ITEMS : []),
                ...(appUser?.role === "admin" ? ADMIN_NAV_ITEMS : []),
              ]),
          ...(appUser?.isOwner ? OWNER_NAV_ITEMS : []),
        ].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/stock"}
            title={label}
            onClick={onCloseMobile}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: 11,
              padding: "9px 12px",
              borderRadius: 8,
              fontSize: 13.5,
              fontWeight: 600,
              color: isActive ? "#fff" : "var(--text-inverse-soft)",
              background: isActive ? "var(--surface-2)" : "transparent",
              transition: "background 120ms ease, color 120ms ease",
            })}
          >
            <Icon size={17} strokeWidth={2.2} style={{ flexShrink: 0 }} />
            <span className="app-sidebar-label">{label}</span>
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 14 }}>
        <div
          className="app-sidebar-label"
          style={{
            border: "1px solid var(--ink-border)",
            borderRadius: 12,
            padding: "12px 12px 14px",
            background: "var(--surface-1)",
          }}
        >
          <div style={{ fontSize: 11, color: "var(--text-inverse-soft)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 8 }}>
            Processing queue
          </div>
          <Waveform
            data={[0.3, 0.7, 0.4, 0.9, 0.5, 0.8, 0.3, 0.6, 0.4, 0.75, 0.5, 0.35]}
            animate={Boolean(inFlight)}
            height={26}
            color="var(--brand)"
            barWidth={3}
            gap={2}
          />
          <div style={{ fontSize: 12, color: "var(--text-inverse-soft)", marginTop: 8 }}>
            {inFlight === null
              ? "—"
              : inFlight === 0
                ? "All caught up"
                : `${inFlight} call${inFlight === 1 ? "" : "s"} awaiting processing`}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px" }}>
          <Avatar name={appUser?.name ?? "..."} size={30} />
          <div className="app-sidebar-footer-text" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#fff", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {appUser?.name ?? "Loading…"}
            </div>
            <div style={{ fontSize: 11.5, color: "var(--text-inverse-soft)" }}>
              {appUser ? ROLE_LABEL[appUser.role] ?? appUser.role : ""}
            </div>
          </div>
          <button
            onClick={onLogout}
            aria-label="Log out"
            title="Log out"
            style={{
              background: "transparent",
              border: "none",
              color: "var(--text-inverse-soft)",
              display: "flex",
              padding: 6,
              borderRadius: 6,
              flexShrink: 0,
              transition: "color 120ms ease",
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
