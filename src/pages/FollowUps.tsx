import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardCheck } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { FollowUpStatusBadge, CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
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

export default function FollowUps() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState("");
  const [assignedTo, setAssignedTo] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [total, setTotal] = useState(0);
  const [updating, setUpdating] = useState<string | null>(null);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [status, assignedTo, dueBefore]);

  function load() {
    setLoading(true);
    api.followUps
      .list({
        status: (status || undefined) as FollowUpStatus | undefined,
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
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update follow-up", "error");
    } finally {
      setUpdating(null);
    }
  }

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const hasActiveFilters = Boolean(status || assignedTo || dueBefore);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="Follow-ups"
        title="Follow-up queue"
        description="Enquiries the AI flagged as needing a callback, sorted by due date."
      />

      <FilterBar>
        <FilterSelect label="Status" value={status} onChange={setStatus} options={STATUS_OPTIONS} />
        <FilterSelect label="Assigned to" value={assignedTo} onChange={setAssignedTo} options={employeeOptions} />
        <DateInput
          value={dueBefore}
          onChange={setDueBefore}
          aria-label="Due before"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        {hasActiveFilters && <ClearFiltersButton onClick={() => { setStatus(""); setAssignedTo(""); setDueBefore(""); }} />}
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

      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pagerButtonStyle(page >= totalPages)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function pagerButtonStyle(disabled: boolean) {
  return {
    padding: "7px 14px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-raised)",
    fontSize: 12.5,
    fontWeight: 600,
    color: disabled ? "var(--text-faint)" : "var(--text)",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
