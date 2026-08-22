import { useEffect, useState } from "react";
import { ShieldAlert, Phone, PhoneCall, Clock, CheckCircle2, ThumbsUp, ThumbsDown } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Avatar } from "../components/ui/Avatar";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatDuration } from "../lib/format";
import type { EmployeePerformanceReport, EmployeePerformanceRow } from "../types";

function pct(n: number | null): string {
  return n == null ? "—" : `${Math.round(n * 100)}%`;
}

function scoreColor(score: number | null): string {
  if (score == null) return "var(--text-faint)";
  if (score >= 7.5) return "var(--success)";
  if (score >= 5) return "var(--amber)";
  return "var(--coral)";
}

function pad(h: number) {
  return String(h).padStart(2, "0") + ":00";
}

export default function EmployeePerformance() {
  const { appUser } = useAuth();
  const toast = useToast();
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [report, setReport] = useState<EmployeePerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!appUser?.isOwner) return;
    setLoading(true);
    api.performance
      .employees(month)
      .then(setReport)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load performance report", "error"))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, appUser?.isOwner]);

  if (!appUser?.isOwner) {
    return (
      <div>
        <PageHeader eyebrow="Performance" title="Employee performance" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>This page is restricted to the account owner</p>
          <p style={{ fontSize: 13 }}>You don't have access to view this.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        eyebrow="Performance · Owner only"
        title="Employee performance"
        description="Who's handling which line, how they're communicating with customers, and where each person stands this month."
        actions={
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>Month</span>
            <input
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
            />
          </div>
        }
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {loading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} height={220} />)}

        {!loading && report?.employees.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No active employees to report on.</p>
        )}

        {!loading && report?.employees.map((row) => <EmployeeCard key={row.employee.id} row={row} />)}
      </div>
    </div>
  );
}

function EmployeeCard({ row }: { row: EmployeePerformanceRow }) {
  const { employee, coverage, score, metrics, pros, cons } = row;

  return (
    <div className="fade-in-up" style={cardStyle}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 16, flexWrap: "wrap", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, flex: 1, minWidth: 220 }}>
          <Avatar name={employee.name} size={42} />
          <div>
            <div style={{ fontSize: 16, fontWeight: 700 }}>{employee.name}</div>
            <div style={{ fontSize: 12.5, color: "var(--text-soft)", display: "flex", alignItems: "center", gap: 5, marginTop: 2 }}>
              <Phone size={11} />
              {coverage.type === "backup" ? (
                <span>{coverage.label}</span>
              ) : coverage.lines && coverage.lines.length > 0 ? (
                <span>
                  {coverage.lines
                    .map((l) => (l.window ? `${l.phoneNumber} (${pad(l.window.startHour)}–${pad(l.window.endHour)})` : l.phoneNumber))
                    .join(", ")}
                </span>
              ) : (
                <span style={{ color: "var(--text-faint)" }}>No line assigned</span>
              )}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            width: 64,
            height: 64,
            borderRadius: "50%",
            border: `3px solid ${scoreColor(score)}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 19, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>
            {score == null ? "—" : score}
          </span>
          <span style={{ fontSize: 9, color: "var(--text-faint)", fontWeight: 700 }}>/ 10</span>
        </div>
      </div>

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 16 }}>
        <StatPill icon={PhoneCall} label="Calls" value={String(metrics.totalCalls)} />
        <StatPill icon={CheckCircle2} label="Completion" value={pct(metrics.completionRate)} />
        <StatPill icon={Clock} label="Avg. duration" value={metrics.avgDurationSeconds != null ? formatDuration(metrics.avgDurationSeconds) : "—"} />
        <StatPill icon={ThumbsUp} label="Interested rate" value={pct(metrics.interestedRate)} />
        <StatPill icon={CheckCircle2} label="Follow-ups done" value={pct(metrics.followUpRate)} />
        {metrics.followUpOverdue > 0 && <StatPill icon={Clock} label="Overdue follow-ups" value={String(metrics.followUpOverdue)} tone="var(--coral)" />}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }} className="grid-responsive-2">
        <div style={{ background: "var(--success-soft)", borderRadius: "var(--radius-sm)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "var(--success)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <ThumbsUp size={13} /> Pros
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {pros.map((p, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>{p}</li>
            ))}
          </ul>
        </div>
        <div style={{ background: "var(--coral-soft)", borderRadius: "var(--radius-sm)", padding: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8, fontSize: 11, fontWeight: 700, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            <ThumbsDown size={13} /> Cons
          </div>
          <ul style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 5 }}>
            {cons.map((c, i) => (
              <li key={i} style={{ fontSize: 12.5, lineHeight: 1.5, color: "var(--text)" }}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function StatPill({ icon: Icon, label, value, tone }: { icon: typeof Phone; label: string; value: string; tone?: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "7px 12px",
        background: "var(--paper)",
        border: "1px solid var(--border-soft)",
        borderRadius: 999,
        fontSize: 12,
      }}
    >
      <Icon size={12} color={tone ?? "var(--text-faint)"} />
      <span style={{ color: "var(--text-faint)" }}>{label}:</span>
      <span style={{ fontWeight: 700, color: tone ?? "var(--text)" }}>{value}</span>
    </div>
  );
}

const cardStyle = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  padding: 18,
} as const;
