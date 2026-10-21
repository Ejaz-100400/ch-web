import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, X } from "lucide-react";
import { api } from "../../lib/api";
import { formatIstTime, relativeToAppointment } from "../../lib/appointment-time";
import type { Appointment, Branch } from "../../types";

const POLL_INTERVAL_MS = 60_000;
const MAX_VISIBLE = 3;
const DISMISSED_KEY = "dismissed-appointment-alerts";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Velacherry",
  pondicherry: "Pondicherry",
};

function readDismissed(): string[] {
  try {
    const raw = localStorage.getItem(DISMISSED_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeDismissed(ids: string[]) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(ids));
  } catch {
    // Storage blocked -- the alert just comes back on the next poll, which
    // is the safe direction to fail in.
  }
}

// Site-wide heads-up for a booked customer who's due within the hour (or is
// running late). Server decides who qualifies (GET /appointments/upcoming:
// still "scheduled", from 30 min past to 60 min ahead); marking someone
// arrived / no-show / cancelled drops them from that list on the next poll.
// Dismissing only hides it on this browser -- it doesn't change the booking.
export function AppointmentReminder() {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState<Appointment[]>([]);
  const [dismissed, setDismissed] = useState<string[]>(readDismissed);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    function load() {
      api.appointments
        .upcoming()
        .then((res) => {
          if (!active) return;
          setUpcoming(res);
          // Forget dismissals for appointments no longer in the window, so
          // the stored list can't grow forever.
          setDismissed((prev) => {
            const kept = prev.filter((id) => res.some((a) => a.id === id));
            if (kept.length !== prev.length) writeDismissed(kept);
            return kept.length === prev.length ? prev : kept;
          });
        })
        .catch(() => {
          // A failed poll shouldn't blank an alert that was already showing.
        });
    }
    load();
    const poll = setInterval(load, POLL_INTERVAL_MS);
    const tick = setInterval(() => setNow(Date.now()), 30_000);
    return () => {
      active = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  const visible = upcoming.filter((a) => !dismissed.includes(a.id));
  if (visible.length === 0) return null;

  function dismiss(id: string) {
    const next = [...dismissed, id];
    setDismissed(next);
    writeDismissed(next);
  }

  return (
    <div role="alert">
      {visible.slice(0, MAX_VISIBLE).map((a) => {
        const rel = relativeToAppointment(a.appointmentAt, now);
        const details = [BRANCH_LABELS[a.branch], a.products.map((p) => p.name).join(", ")].filter(Boolean).join(" · ");
        return (
          <div
            key={a.id}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "9px 24px",
              background: rel.overdue ? "var(--coral)" : "var(--brand)",
              color: rel.overdue ? "#fff" : "var(--on-brand)",
              fontSize: 13,
              fontWeight: 600,
              borderBottom: "1px solid rgba(0,0,0,0.1)",
            }}
          >
            <CalendarClock size={15} strokeWidth={2.3} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{a.customerName}</strong> is coming at {formatIstTime(a.appointmentAt)} ({rel.label}){details ? ` -- ${details}` : ""}
            </span>
            <button
              onClick={() => navigate("/appointments")}
              style={{ flexShrink: 0, padding: "5px 12px", background: "rgba(0,0,0,0.14)", border: "none", borderRadius: "var(--radius-sm)", color: "inherit", fontSize: 12.5, fontWeight: 700 }}
            >
              View
            </button>
            <button
              onClick={() => dismiss(a.id)}
              aria-label="Dismiss"
              title="Dismiss"
              style={{ flexShrink: 0, display: "flex", background: "none", border: "none", color: "inherit", cursor: "pointer", padding: 2 }}
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
      {visible.length > MAX_VISIBLE && (
        <div style={{ padding: "6px 24px", background: "var(--brand)", color: "var(--on-brand)", fontSize: 12.5, fontWeight: 600 }}>
          +{visible.length - MAX_VISIBLE} more appointment{visible.length - MAX_VISIBLE === 1 ? "" : "s"} due soon
        </div>
      )}
    </div>
  );
}
