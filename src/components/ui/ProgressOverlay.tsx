import { Spinner } from "./Spinner";

interface ProgressOverlayProps {
  open: boolean;
  title: string;
  done: number;
  total: number;
  unitLabel?: string;
}

// Centered, full-screen overlay used for operations with real multi-step
// progress (batch import commits). Sits below the toast layer in z-index so
// a success toast fired the moment this closes still lands on top.
export function ProgressOverlay({ open, title, done, total, unitLabel = "rows" }: ProgressOverlayProps) {
  if (!open) return null;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 1900,
        padding: 20,
      }}
    >
      <div
        className="fade-in-up"
        role="status"
        aria-live="polite"
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-pop)",
          padding: "30px 36px",
          minWidth: 300,
          maxWidth: "90vw",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 16 }}>
          <Spinner size={32} thickness={3} />
        </div>
        <div style={{ fontSize: 14.5, fontWeight: 700, marginBottom: 6 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 16 }}>
          {done} / {total} {unitLabel} · {pct}%
        </div>
        <div style={{ height: 8, background: "var(--border-soft)", borderRadius: 999, overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background: "var(--brand)",
              borderRadius: 999,
              transition: "width 200ms ease",
            }}
          />
        </div>
      </div>
    </div>
  );
}
