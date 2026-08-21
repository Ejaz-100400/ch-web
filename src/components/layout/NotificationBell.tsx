import { useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, PhoneMissed, CalendarClock, Sparkles } from "lucide-react";
import { api } from "../../lib/api";

const POLL_INTERVAL_MS = 30_000;
const WHATS_NEW_SEEN_KEY = "ch-whats-new-seen";

// Add a new entry here whenever a feature ships worth telling the team
// about -- newest first. `id` just needs to be unique and sortable; date
// strings work well since they also show in the panel.
const WHATS_NEW: { id: string; date: string; title: string; description: string }[] = [
  {
    id: "2026-08-21-branch",
    date: "2026-08-21",
    title: "Branch tracking",
    description: "Calls now show which branch they were routed to (Ambattur, Kattankulathur, Sithalapakkam, Pondicherry) -- editable per call, with a Reports breakdown.",
  },
  {
    id: "2026-08-21-coverage",
    date: "2026-08-21",
    title: "Team Coverage page",
    description: "See who's covering each phone line and when, and calls now auto-assign to the right employee based on shift.",
  },
  {
    id: "2026-08-21-resolved",
    date: "2026-08-21",
    title: "Resolved calls turn green",
    description: "A missed/failed call now highlights green once that customer has any completed call on record.",
  },
  {
    id: "2026-08-21-returning",
    date: "2026-08-21",
    title: "Returning customers metric",
    description: "Reports now shows a Returning Customers tile next to Total Customers.",
  },
  {
    id: "2026-08-21-vehicle",
    date: "2026-08-21",
    title: "Vehicle details carry forward",
    description: "A returning customer's car make/model/variant/location now auto-fills from their last call.",
  },
];

function loadSeenDate(): string {
  try {
    return localStorage.getItem(WHATS_NEW_SEEN_KEY) ?? "";
  } catch {
    return "";
  }
}

export function NotificationBell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [missedCount, setMissedCount] = useState(0);
  const [missedPreview, setMissedPreview] = useState<{ id: string; phone: string }[]>([]);
  const [overdueCount, setOverdueCount] = useState(0);
  const [overduePreview, setOverduePreview] = useState<{ id: string; callId: string; name: string }[]>([]);
  const [seenDate, setSeenDate] = useState(loadSeenDate);
  const rootRef = useRef<HTMLDivElement>(null);

  const unseenUpdates = WHATS_NEW.filter((w) => w.date > seenDate);

  function load() {
    api.calls
      .missed(1, 5)
      .then((res) => {
        setMissedCount(res.total);
        setMissedPreview(res.items.map((c) => ({ id: c.id, phone: c.customer?.phoneNumber ?? "Unknown" })));
      })
      .catch(() => {});

    const today = new Date().toISOString().slice(0, 10);
    api.followUps
      .list({ status: "pending", dueBefore: today, pageSize: 5 })
      .then((res) => {
        setOverdueCount(res.total);
        setOverduePreview(res.items.map((f) => ({ id: f.id, callId: f.callId, name: f.call?.customer?.name ?? f.call?.customer?.phoneNumber ?? "Unknown" })));
      })
      .catch(() => {});
  }

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggleOpen() {
    setOpen((v) => {
      const next = !v;
      // Mark What's New as read the moment the panel opens, not before --
      // opening it is the "I saw this" signal.
      if (next && unseenUpdates.length > 0) {
        const latest = WHATS_NEW[0].date;
        try {
          localStorage.setItem(WHATS_NEW_SEEN_KEY, latest);
        } catch {
          /* ignore */
        }
        setSeenDate(latest);
      }
      return next;
    });
  }

  const totalBadge = missedCount + overdueCount + unseenUpdates.length;

  return (
    <div ref={rootRef} style={{ position: "relative" }}>
      <button
        onClick={toggleOpen}
        aria-label="Notifications"
        title="Notifications"
        aria-expanded={open}
        style={{
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 32,
          height: 32,
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border)",
          background: "var(--paper-raised)",
          color: "var(--text)",
          flexShrink: 0,
        }}
      >
        <Bell size={15} />
        {totalBadge > 0 && (
          <span
            style={{
              position: "absolute",
              top: -4,
              right: -4,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: 16,
              height: 16,
              padding: "0 3px",
              borderRadius: 999,
              background: "var(--coral)",
              color: "#fff",
              fontSize: 10,
              fontWeight: 800,
              lineHeight: 1,
            }}
          >
            {totalBadge > 99 ? "99+" : totalBadge}
          </span>
        )}
      </button>

      {open && (
        <div
          className="fade-in-up"
          style={{
            position: "absolute",
            top: "calc(100% + 8px)",
            right: 0,
            zIndex: 30,
            width: 340,
            maxHeight: 460,
            overflowY: "auto",
            background: "var(--paper-raised)",
            border: "1px solid var(--border)",
            borderRadius: "var(--radius-md)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <NotificationSection
            icon={PhoneMissed}
            iconColor="var(--coral)"
            title="Missed calls"
            count={missedCount}
            emptyText="No missed calls right now."
          >
            {missedPreview.map((c) => (
              <NotificationRow key={c.id} onClick={() => { setOpen(false); navigate("/missed-calls"); }}>
                <span className="mono">{c.phone}</span> called and didn't get through.
              </NotificationRow>
            ))}
            {missedCount > 0 && (
              <NotificationFooterLink onClick={() => { setOpen(false); navigate("/missed-calls"); }}>
                View all missed calls
              </NotificationFooterLink>
            )}
          </NotificationSection>

          <NotificationSection
            icon={CalendarClock}
            iconColor="var(--amber)"
            title="Overdue follow-ups"
            count={overdueCount}
            emptyText="Nothing overdue."
          >
            {overduePreview.map((f) => (
              <NotificationRow key={f.id} onClick={() => { setOpen(false); navigate(`/calls/${f.callId}`); }}>
                Follow-up with <strong>{f.name}</strong> is overdue.
              </NotificationRow>
            ))}
            {overdueCount > 0 && (
              <NotificationFooterLink onClick={() => { setOpen(false); navigate("/follow-ups"); }}>
                View all follow-ups
              </NotificationFooterLink>
            )}
          </NotificationSection>

          <NotificationSection
            icon={Sparkles}
            iconColor="var(--violet)"
            title="What's new"
            count={unseenUpdates.length}
            emptyText="You're all caught up."
            hideCountWhenZero
          >
            {WHATS_NEW.map((w) => (
              <div key={w.id} style={{ padding: "9px 14px", borderBottom: "1px solid var(--border-soft)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
                  <span style={{ fontSize: 12.5, fontWeight: 700 }}>{w.title}</span>
                  {w.date > seenDate && (
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--violet)", flexShrink: 0 }} />
                  )}
                </div>
                <p style={{ fontSize: 12, color: "var(--text-soft)", lineHeight: 1.5 }}>{w.description}</p>
              </div>
            ))}
          </NotificationSection>
        </div>
      )}
    </div>
  );
}

function NotificationSection({
  icon: Icon,
  iconColor,
  title,
  count,
  emptyText,
  hideCountWhenZero,
  children,
}: {
  icon: typeof Bell;
  iconColor: string;
  title: string;
  count: number;
  emptyText: string;
  hideCountWhenZero?: boolean;
  children: ReactNode;
}) {
  const hasChildren = Array.isArray(children) ? children.some(Boolean) : Boolean(children);
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 14px",
          borderBottom: "1px solid var(--border-soft)",
          position: "sticky",
          top: 0,
          background: "var(--paper-raised)",
        }}
      >
        <Icon size={13} color={iconColor} />
        <span style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--text-faint)" }}>
          {title}
        </span>
        {(!hideCountWhenZero || count > 0) && (
          <span style={{ fontSize: 11, fontWeight: 700, color: iconColor, marginLeft: "auto" }}>{count}</span>
        )}
      </div>
      {hasChildren ? children : <p style={{ fontSize: 12, color: "var(--text-faint)", padding: "10px 14px" }}>{emptyText}</p>}
    </div>
  );
}

function NotificationRow({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "left",
        padding: "9px 14px",
        borderBottom: "1px solid var(--border-soft)",
        background: "none",
        border: "none",
        borderBottomStyle: "solid",
        fontSize: 12.5,
        color: "var(--text)",
        lineHeight: 1.5,
      }}
    >
      {children}
    </button>
  );
}

function NotificationFooterLink({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "block",
        width: "100%",
        textAlign: "center",
        padding: "8px 14px",
        background: "none",
        border: "none",
        fontSize: 12,
        fontWeight: 700,
        color: "var(--brand-strong)",
      }}
    >
      {children}
    </button>
  );
}
