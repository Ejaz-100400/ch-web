import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardCheck, Clock, PhoneMissed, CheckCircle2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { FollowUpStatusBadge, CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { DateInput } from "../components/ui/DateInput";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { formatDate } from "../lib/format";
import type { Employee, FollowUp, FollowUpStatus } from "../types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
];

const TABS: { value: FollowUpStatus; label: string; icon: typeof Clock }[] = [
  { value: "pending", label: "Pending", icon: Clock },
  { value: "missed", label: "Missed", icon: PhoneMissed },
  { value: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function FollowUps() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<FollowUpStatus>("pending");
  const [counts, setCounts] = useState<Record<FollowUpStatus, number>>({ pending: 0, missed: 0, completed: 0 });
  const [assignedTo, setAssignedTo] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  // Kept in the URL (not plain useState) so that navigating to a call's
  // detail page and then clicking the browser Back button restores the same
  // page instead of resetting to page 1 -- the list remounts fresh on back
  // navigation, and without this the page number it started on is gone.
  const [searchParams, setSearchParams] = useSearchParams();
  const page = Number(searchParams.get("page")) || 1;
  function setPage(update: number | ((p: number) => number)) {
    const next = typeof update === "function" ? update(page) : update;
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next <= 1) params.delete("page");
        else params.set("page", String(next));
        return params;
      },
      { replace: true },
    );
  }

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  function loadCounts() {
    // Deliberately unfiltered (independent of assignedTo/dueBefore/status) --
    // these tiles are meant to read as a stable at-a-glance total, not shift
    // around every time the list below gets filtered differently.
    api.reports
      .followUps()
      .then((rows) => {
        const next: Record<FollowUpStatus, number> = { pending: 0, missed: 0, completed: 0 };
        for (const r of rows) next[r.status] = r.count;
        setCounts(next);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCounts();
  }, []);

  // useEffect also fires on mount, which happens again every time this page
  // is reached via browser Back navigation (the component remounts fresh).
  // Without this guard, that mount-time fire would silently overwrite the
  // page number just restored from the URL, permanently defeating the
  // page-in-URL fix.
  const isFirstFilterEffect = useRef(true);
  useEffect(() => {
    if (isFirstFilterEffect.current) {
      isFirstFilterEffect.current = false;
      return;
    }
    setPage(1);
  }, [status, assignedTo, dueBefore]);

  function load() {
    setLoading(true);
    api.followUps
      .list({
        status,
        assignedTo: assignedTo || undefined,
        dueBefore: dueBefore || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        setFollowUps(res.items);
        setTotal(res.total);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load follow-ups", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, assignedTo, dueBefore, page]);

  async function updateStatus(id: string, newStatus: FollowUpStatus) {
    setUpdating(id);
    try {
      const updated = await api.followUps.update(id, { status: newStatus });
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, ...updated } : f)));
      toast.show("Follow-up updated.", "success");
      loadCounts();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update follow-up", "error");
    } finally {
      setUpdating(null);
    }
  }

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const hasActiveFilters = Boolean(assignedTo || dueBefore);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalFollowUps = counts.pending + counts.missed + counts.completed;

  return (
    <div>
      <PageHeader
        eyebrow="Follow-ups"
        title="Follow-up queue"
        description="Enquiries the AI flagged as needing a callback, sorted by due date."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginBottom: 18 }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = status === tab.value;
          const pct = totalFollowUps > 0 ? Math.round((counts[tab.value] / totalFollowUps) * 100) : 0;
          return (
            <button
              key={tab.value}
              onClick={() => setStatus(tab.value)}
              aria-pressed={active}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "14px 16px",
                background: active ? "var(--brand-soft)" : "var(--paper-raised)",
                border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                borderRadius: "var(--radius-md)",
                boxShadow: "var(--shadow-card)",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <span
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 36,
                  height: 36,
                  borderRadius: "50%",
                  flexShrink: 0,
                  background: active ? "var(--brand)" : "var(--border-soft)",
                  color: active ? "var(--on-brand)" : "var(--text-soft)",
                }}
              >
                <Icon size={17} />
              </span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                  {tab.label}
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
                  <span style={{ fontSize: 20, fontWeight: 700, color: "var(--text)" }}>{counts[tab.value]}</span>
                  {totalFollowUps > 0 && <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{pct}%</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <FilterBar>
        <FilterSelect label="Assigned to" value={assignedTo} onChange={setAssignedTo} options={employeeOptions} />
        <DateInput
          value={dueBefore}
          onChange={setDueBefore}
          aria-label="Due before"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        {hasActiveFilters && <ClearFiltersButton onClick={() => { setAssignedTo(""); setDueBefore(""); }} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} follow-up${total === 1 ? "" : "s"}`}
      </div>

      <div
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
      <div className="table-scroll">
        <div style={{ minWidth: 760 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "110px 1fr 1.6fr 1fr 1.4fr 150px",
            padding: "10px 18px",
            fontSize: 11,
            fontFamily: "var(--font-body)",
            fontWeight: 700,
            color: "var(--text-faint)",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            borderBottom: "1px solid var(--border-soft)",
          }}
        >
          <span>Due</span>
          <span>Category</span>
          <span>Customer</span>
          <span>Assigned to</span>
          <span>Notes</span>
          <span>Status</span>
        </div>

        {loading && <SkeletonRows rows={8} />}

        {!loading &&
          followUps.map((f) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: "110px 1fr 1.6fr 1fr 1.4fr 150px",
                alignItems: "center",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-soft)",
                fontSize: 13,
              }}
            >
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(f.dueDate)}</span>
              <span>{f.call && <CategoryBadge category={f.call.businessCategory} />}</span>
              <button
                onClick={() => navigate(`/calls/${f.callId}`)}
                style={{ background: "none", border: "none", textAlign: "left", padding: 0, fontSize: 13, color: "var(--brand-strong)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
              >
                {f.call?.customer?.name ?? f.call?.customer?.phoneNumber ?? "View call"}
              </button>
              <span style={{ color: "var(--text-soft)" }}>{f.employee?.name ?? "Unassigned"}</span>
              <span style={{ color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.notes ?? "—"}</span>
              {canManage(appUser?.role) ? (
                <select
                  value={f.status}
                  disabled={updating === f.id}
                  onChange={(e) => updateStatus(f.id, e.target.value as FollowUpStatus)}
                  style={{
                    padding: "5px 8px",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--radius-sm)",
                    background: "var(--paper)",
                    fontSize: 12.5,
                    fontWeight: 600,
                  }}
                >
                  {STATUS_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <FollowUpStatusBadge status={f.status} />
              )}
            </div>
          ))}
        </div>
      </div>

        {!loading && followUps.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <ClipboardCheck size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No follow-ups match these filters</p>
            <p style={{ fontSize: 13 }}>Try different filters, or clear them to see everything.</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

