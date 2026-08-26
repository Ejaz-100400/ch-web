import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import type { Branch } from "../../types";

const POLL_INTERVAL_MS = 5 * 60_000;

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};

// Site-wide nag for the 8:30 PM IST sales-entry deadline. Unlike a toast,
// this stays up until the underlying data changes (a branch logs its
// sales) or the day rolls over -- the whole point is that it shouldn't be
// easy to dismiss and forget about.
export function SalesEntryReminder() {
  const navigate = useNavigate();
  const [missingBranches, setMissingBranches] = useState<Branch[]>([]);

  useEffect(() => {
    let active = true;
    function load() {
      api.sales
        .reminderStatus()
        .then((res) => {
          if (active) setMissingBranches(res.afterCutoff ? res.missingBranches : []);
        })
        .catch(() => {
          if (active) setMissingBranches([]);
        });
    }
    load();
    const id = setInterval(load, POLL_INTERVAL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  if (missingBranches.length === 0) return null;

  return (
    <div
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "9px 24px",
        background: "var(--amber)",
        color: "#1a1a1a",
        fontSize: 13,
        fontWeight: 600,
      }}
    >
      <AlertTriangle size={15} strokeWidth={2.3} style={{ flexShrink: 0 }} />
      <span style={{ flex: 1 }}>
        Sales entry not logged today for: {missingBranches.map((b) => BRANCH_LABELS[b]).join(", ")}.
      </span>
      <button
        onClick={() => navigate("/customer-tracker")}
        style={{
          flexShrink: 0,
          padding: "5px 12px",
          background: "rgba(0,0,0,0.12)",
          border: "none",
          borderRadius: "var(--radius-sm)",
          color: "#1a1a1a",
          fontSize: 12.5,
          fontWeight: 700,
        }}
      >
        Enter now
      </button>
    </div>
  );
}
