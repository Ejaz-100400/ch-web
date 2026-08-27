import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ClipboardCheck, Clock, PhoneMissed, CheckCircle2, AlertTriangle, Trash2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, FilterSelect, SearchInput, MultiSelectFilter, AdvancedFiltersToggle, ClearFiltersButton } from "../components/ui/FilterBar";
import { FollowUpStatusBadge, CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { DateInput } from "../components/ui/DateInput";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { useVehicleFilters } from "../lib/useVehicleFilters";
import { formatDate } from "../lib/format";
import type { Employee, FollowUp, FollowUpStatus, Product, SentimentType } from "../types";

const PAGE_SIZE = 20;

const STATUS_OPTIONS: { value: FollowUpStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "completed", label: "Completed" },
  { value: "missed", label: "Missed" },
];

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const BRANCH_OPTIONS = [
  { value: "ambattur", label: "Ambattur (HQ)" },
  { value: "kattankulathur", label: "Kattankulathur" },
  { value: "sithalapakkam", label: "Sithalapakkam" },
  { value: "pondicherry", label: "Pondicherry" },
];

const SENTIMENT_OPTIONS: { value: SentimentType; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

const TABS: { value: FollowUpStatus; label: string; icon: typeof Clock }[] = [
  { value: "pending", label: "Pending", icon: Clock },
  { value: "missed", label: "Missed", icon: PhoneMissed },
  { value: "completed", label: "Completed", icon: CheckCircle2 },
];

export default function FollowUps() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [status, setStatus] = useState<FollowUpStatus>("pending");
  const [counts, setCounts] = useState<Record<FollowUpStatus, number>>({ pending: 0, missed: 0, completed: 0 });
  const [assignedTo, setAssignedTo] = useState("");
  const [dueBefore, setDueBefore] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [branch, setBranch] = useState<string[]>([]);
  const [sentiment, setSentiment] = useState<string[]>([]);
  const [productId, setProductId] = useState<string[]>([]);
  const [callEmployeeId, setCallEmployeeId] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset: resetVehicleFilters } = useVehicleFilters();
  const [products, setProducts] = useState<Product[]>([]);
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const isAdmin = appUser?.role === "admin";

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
    api.products.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  const isFirstSearchEffect = useRef(true);
  useEffect(() => {
    if (isFirstSearchEffect.current) {
      isFirstSearchEffect.current = false;
      return;
    }
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedPhone(phone);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, phone]);

  // Respects every filter except status itself (grouping BY status while
  // also filtering ON it wouldn't mean anything) and page (pagination
  // doesn't change the totals) -- so the tiles always match what the list
  // below actually shows instead of reading as a separate, unfiltered total.
  function loadCounts() {
    api.followUps
      .counts({
        assignedTo: assignedTo || undefined,
        dueBefore: dueBefore || undefined,
        search: debouncedSearch || undefined,
        phone: debouncedPhone || undefined,
        category: category.length ? category : undefined,
        branch: branch.length ? branch : undefined,
        sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
        productId: productId.length ? productId : undefined,
        employeeId: callEmployeeId.length ? callEmployeeId : undefined,
        carMake: carMake.length ? carMake : undefined,
        carModel: carModel.length ? carModel : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      })
      .then((rows) => {
        const next: Record<FollowUpStatus, number> = { pending: 0, missed: 0, completed: 0 };
        for (const r of rows) next[r.status] = r.count;
        setCounts(next);
      })
      .catch(() => {});
  }

  useEffect(() => {
    loadCounts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    assignedTo,
    dueBefore,
    debouncedSearch,
    debouncedPhone,
    category,
    branch,
    sentiment,
    productId,
    callEmployeeId,
    carMake,
    carModel,
    dateFrom,
    dateTo,
  ]);

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
  }, [status, assignedTo, dueBefore, category, branch, sentiment, productId, callEmployeeId, carMake, carModel, dateFrom, dateTo]);

  function load() {
    setLoading(true);
    api.followUps
      .list({
        status,
        assignedTo: assignedTo || undefined,
        dueBefore: dueBefore || undefined,
        search: debouncedSearch || undefined,
        phone: debouncedPhone || undefined,
        category: category.length ? category : undefined,
        branch: branch.length ? branch : undefined,
        sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
        productId: productId.length ? productId : undefined,
        employeeId: callEmployeeId.length ? callEmployeeId : undefined,
        carMake: carMake.length ? carMake : undefined,
        carModel: carModel.length ? carModel : undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        setFollowUps(res.items);
        setTotal(res.total);
        // A selection only makes sense against the rows currently on screen --
        // a fresh fetch (new page, new filters) means it's stale.
        setSelectedIds(new Set());
        setConfirmingDelete(false);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load follow-ups", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    assignedTo,
    dueBefore,
    debouncedSearch,
    debouncedPhone,
    category,
    branch,
    sentiment,
    productId,
    callEmployeeId,
    carMake,
    carModel,
    dateFrom,
    dateTo,
    page,
  ]);

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

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = followUps.length > 0 && followUps.every((f) => selectedIds.has(f.id));

  function toggleSelectAllOnPage() {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(followUps.map((f) => f.id)));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await api.followUps.removeMany(ids);
      setFollowUps((prev) => prev.filter((f) => !selectedIds.has(f.id)));
      setTotal((prev) => Math.max(0, prev - res.deleted));
      setSelectedIds(new Set());
      setConfirmingDelete(false);
      toast.show(`Deleted ${res.deleted} follow-up${res.deleted === 1 ? "" : "s"}.`, "success");
      loadCounts();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete follow-ups", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleDeleteOne(f: FollowUp) {
    if (!window.confirm(`Delete this follow-up due ${formatDate(f.dueDate)}? This can't be undone.`)) return;
    setDeletingId(f.id);
    try {
      await api.followUps.remove(f.id);
      setFollowUps((prev) => prev.filter((x) => x.id !== f.id));
      setTotal((prev) => Math.max(0, prev - 1));
      setSelectedIds((prev) => {
        if (!prev.has(f.id)) return prev;
        const next = new Set(prev);
        next.delete(f.id);
        return next;
      });
      toast.show("Follow-up deleted.", "success");
      loadCounts();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete follow-up", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const hasActiveFilters = Boolean(
    assignedTo ||
      dueBefore ||
      search ||
      phone ||
      category.length ||
      branch.length ||
      sentiment.length ||
      productId.length ||
      callEmployeeId.length ||
      carMake.length ||
      carModel.length ||
      dateFrom ||
      dateTo,
  );
  const advancedFilterCount = [sentiment, productId, callEmployeeId, carMake, carModel].filter((v) => v.length > 0).length;

  function clearFilters() {
    setAssignedTo("");
    setDueBefore("");
    setSearch("");
    setPhone("");
    setCategory([]);
    setBranch([]);
    setSentiment([]);
    setProductId([]);
    setCallEmployeeId([]);
    resetVehicleFilters();
    setDateFrom("");
    setDateTo("");
  }

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
        <SearchInput value={search} onChange={setSearch} placeholder="Search customer name or summary" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 130 }}
        />
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <MultiSelectFilter label="Branch" values={branch} onChange={setBranch} options={BRANCH_OPTIONS} />
        <FilterSelect label="Assigned to" value={assignedTo} onChange={setAssignedTo} options={employeeOptions} />
        <DateInput
          value={dueBefore}
          onChange={setDueBefore}
          aria-label="Due before"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        <AdvancedFiltersToggle open={showAdvanced} count={advancedFilterCount} onClick={() => setShowAdvanced((v) => !v)} />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </FilterBar>

      {showAdvanced && (
        <FilterBar>
          <MultiSelectFilter
            label="Car make"
            values={carMake}
            onChange={setCarMake}
            options={carMakeOptions.map((make) => ({ value: make, label: make }))}
          />
          <MultiSelectFilter
            label="Car model"
            values={carModel}
            onChange={setCarModel}
            options={carModelOptions.map((model) => ({ value: model, label: model }))}
          />
          <MultiSelectFilter label="Sentiment" values={sentiment} onChange={setSentiment} options={SENTIMENT_OPTIONS} />
          <MultiSelectFilter
            label="Product"
            values={productId}
            onChange={setProductId}
            options={products.map((p) => ({ value: p.id, label: p.name }))}
          />
          <MultiSelectFilter label="Call employee" values={callEmployeeId} onChange={setCallEmployeeId} options={employeeOptions} />
          <DateInput
            value={dateFrom}
            onChange={setDateFrom}
            aria-label="Call date from"
            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
          />
          <DateInput
            value={dateTo}
            onChange={setDateTo}
            aria-label="Call date to"
            style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
          />
        </FilterBar>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {loading ? <LoadingText /> : `${total} follow-up${total === 1 ? "" : "s"}`}
        </div>

        {isAdmin && selectedIds.size > 0 && (
          <div className="fade-in-up" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            {confirmingDelete ? (
              <>
                <span style={{ color: "var(--coral)", fontWeight: 700 }}>
                  Delete {selectedIds.size} follow-up{selectedIds.size === 1 ? "" : "s"}? This can't be undone.
                </span>
                <button onClick={handleBulkDelete} disabled={deleting} style={bulkDeleteConfirmButtonStyle}>
                  {deleting ? "Deleting…" : "Confirm delete"}
                </button>
                <button onClick={() => setConfirmingDelete(false)} disabled={deleting} style={bulkCancelButtonStyle}>
                  Cancel
                </button>
              </>
            ) : (
              <>
                <span style={{ color: "var(--text-soft)", fontWeight: 600 }}>{selectedIds.size} selected</span>
                <button onClick={() => setConfirmingDelete(true)} style={bulkDeleteButtonStyle}>
                  <Trash2 size={13} /> Delete selected
                </button>
                <button onClick={() => setSelectedIds(new Set())} style={bulkCancelButtonStyle}>
                  Clear
                </button>
              </>
            )}
          </div>
        )}
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
        <div style={{ minWidth: isAdmin ? 830 : 760 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: isAdmin ? "28px 110px 1fr 1.6fr 1fr 1.4fr 150px 40px" : "110px 1fr 1.6fr 1fr 1.4fr 150px",
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
          {isAdmin && (
            <input
              type="checkbox"
              checked={allOnPageSelected}
              onChange={toggleSelectAllOnPage}
              aria-label="Select all follow-ups on this page"
              style={{ accentColor: "var(--brand)" }}
            />
          )}
          <span>Due</span>
          <span>Category</span>
          <span>Customer</span>
          <span>Assigned to</span>
          <span>Notes</span>
          <span>Status</span>
          {isAdmin && <span />}
        </div>

        {loading && <SkeletonRows rows={8} />}

        {!loading &&
          followUps.map((f) => (
            <div
              key={f.id}
              style={{
                display: "grid",
                gridTemplateColumns: isAdmin ? "28px 110px 1fr 1.6fr 1fr 1.4fr 150px 40px" : "110px 1fr 1.6fr 1fr 1.4fr 150px",
                alignItems: "center",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-soft)",
                fontSize: 13,
              }}
            >
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(f.id)}
                  onChange={() => toggleSelect(f.id)}
                  aria-label={`Select follow-up due ${formatDate(f.dueDate)}`}
                  style={{ accentColor: "var(--brand)" }}
                />
              )}
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(f.dueDate)}</span>
              <span>{f.call && <CategoryBadge category={f.call.businessCategory} />}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 6, overflow: "hidden" }}>
                <Link
                  to={`/calls/${f.callId}`}
                  style={{ textAlign: "left", fontSize: 13, color: "var(--brand-strong)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", textDecoration: "none" }}
                >
                  {f.call?.customer?.name ?? f.call?.customer?.phoneNumber ?? "View call"}
                </Link>
                {f.call?.customer && !f.call.customer.name && (
                  <span title="Customer name not recorded — check car model & product too when you call" style={{ display: "flex", flexShrink: 0 }}>
                    <AlertTriangle size={12} color="var(--amber)" />
                  </span>
                )}
              </span>
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
              {isAdmin && (
                <button
                  onClick={() => handleDeleteOne(f)}
                  disabled={deletingId === f.id}
                  aria-label="Delete follow-up"
                  title="Delete follow-up"
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "none", border: "none", borderRadius: 6, color: "var(--coral)" }}
                >
                  <Trash2 size={14} />
                </button>
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

const bulkDeleteButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 5,
  padding: "6px 12px",
  background: "var(--coral-soft)",
  color: "var(--coral)",
  border: "1px solid var(--coral)",
  borderRadius: "var(--radius-sm)",
  fontSize: 12.5,
  fontWeight: 700,
} as const;

const bulkDeleteConfirmButtonStyle = {
  padding: "6px 12px",
  background: "var(--coral)",
  color: "#fff",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: 12.5,
  fontWeight: 700,
} as const;

const bulkCancelButtonStyle = {
  padding: "6px 12px",
  background: "none",
  color: "var(--text-soft)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 12.5,
  fontWeight: 600,
} as const;

