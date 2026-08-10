import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall, Pencil, Save, X, Trash2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, FilterSelect, AdvancedFiltersToggle, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge, CallStatusBadge, SentimentBadge, ImportedBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError, type UpdateCallInput, type UpdateExtractionInput } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { formatDuration, formatDateTime } from "../lib/format";
import type { BusinessCategory, Call, Employee, SentimentType } from "../types";

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const SENTIMENT_OPTIONS: { value: SentimentType; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

const FOLLOW_UP_OPTIONS = [
  { value: "true", label: "Follow-up needed" },
  { value: "false", label: "No follow-up" },
];

export default function CallList() {
  const navigate = useNavigate();
  const toast = useToast();
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const [editingCall, setEditingCall] = useState<Call | null>(null);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const [carMake, setCarMake] = useState("");
  const [carModel, setCarModel] = useState("");
  const [sentiment, setSentiment] = useState("");
  const [followUpRequired, setFollowUpRequired] = useState("");
  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setDebouncedPhone(phone);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search, phone]);

  useEffect(() => {
    setPage(1);
  }, [carMake, carModel, sentiment, followUpRequired, category, employeeId, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.calls
      .list({
        search: debouncedSearch || undefined,
        phone: debouncedPhone || undefined,
        carMake: carMake || undefined,
        carModel: carModel || undefined,
        sentiment: (sentiment as SentimentType) || undefined,
        followUpRequired: followUpRequired ? followUpRequired === "true" : undefined,
        category: category || undefined,
        employeeId: employeeId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setCalls(res.items);
        setTotal(res.total);
        // A selection only makes sense against the rows currently on screen --
        // a fresh fetch (new page, new filters) means it's stale.
        setSelectedIds(new Set());
        setConfirmingDelete(false);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load calls", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedPhone, carMake, carModel, sentiment, followUpRequired, category, employeeId, dateFrom, dateTo, page]);

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const hasActiveFilters = Boolean(
    search || phone || carMake || carModel || sentiment || followUpRequired || category || employeeId || dateFrom || dateTo,
  );
  const advancedFilterCount = [carMake, carModel, sentiment, followUpRequired].filter(Boolean).length;

  function clearFilters() {
    setSearch("");
    setPhone("");
    setCarMake("");
    setCarModel("");
    setSentiment("");
    setFollowUpRequired("");
    setCategory("");
    setEmployeeId("");
    setDateFrom("");
    setDateTo("");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const gridCols = isAdmin
    ? "24px 120px 90px 1fr 1.3fr 1fr 80px 90px 1fr 36px"
    : "120px 90px 1fr 1.3fr 1fr 80px 90px 1fr";

  function refreshCall(updated: Call) {
    setCalls((prev) => prev.map((c) => (c.id === updated.id ? { ...c, ...updated } : c)));
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = calls.length > 0 && calls.every((c) => selectedIds.has(c.id));

  function toggleSelectAllOnPage() {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(calls.map((c) => c.id)));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await api.calls.removeMany(ids);
      setCalls((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setTotal((prev) => Math.max(0, prev - res.deleted));
      setSelectedIds(new Set());
      setConfirmingDelete(false);
      toast.show(`Deleted ${res.deleted} call${res.deleted === 1 ? "" : "s"}.`, "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete calls", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Calls"
        title="Call log"
        description="Every inbound enquiry across both lines, with AI-extracted vehicle details, sentiment, and processing status."
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customer name or summary" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 130 }}
        />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <FilterSelect label="Employee" value={employeeId} onChange={setEmployeeId} options={employeeOptions} />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        <AdvancedFiltersToggle open={showAdvanced} count={advancedFilterCount} onClick={() => setShowAdvanced((v) => !v)} />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </FilterBar>

      {showAdvanced && (
        <FilterBar>
          <input
            type="text"
            value={carMake}
            onChange={(e) => setCarMake(e.target.value)}
            placeholder="Car make (e.g. Maruti)"
            style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 160 }}
          />
          <input
            type="text"
            value={carModel}
            onChange={(e) => setCarModel(e.target.value)}
            placeholder="Car model (e.g. Swift)"
            style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 160 }}
          />
          <FilterSelect label="Sentiment" value={sentiment} onChange={setSentiment} options={SENTIMENT_OPTIONS} />
          <FilterSelect label="Follow-up" value={followUpRequired} onChange={setFollowUpRequired} options={FOLLOW_UP_OPTIONS} />
        </FilterBar>
      )}

      {editingCall && (
        <CallEditForm
          call={editingCall}
          employees={employees}
          onClose={() => setEditingCall(null)}
          onSaved={(c) => { refreshCall(c); setEditingCall(null); }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {loading ? <LoadingText /> : `${total} call${total === 1 ? "" : "s"}`}
        </div>

        {isAdmin && selectedIds.size > 0 && (
          <div className="fade-in-up" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            {confirmingDelete ? (
              <>
                <span style={{ color: "var(--coral)", fontWeight: 700 }}>
                  Delete {selectedIds.size} call{selectedIds.size === 1 ? "" : "s"}? This can't be undone.
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
        <div style={{ minWidth: 940 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: gridCols,
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
              aria-label="Select all calls on this page"
              style={{ accentColor: "var(--brand)" }}
            />
          )}
          <span>Date</span>
          <span>Category</span>
          <span>Vehicle</span>
          <span>Customer</span>
          <span>Employee</span>
          <span>Duration</span>
          <span>Status</span>
          <span>Sentiment</span>
          {isAdmin && <span />}
        </div>

        {loading && <SkeletonRows rows={8} />}

        {!loading &&
          calls.map((call) => (
            <div
              key={call.id}
              role="button"
              tabIndex={0}
              onClick={() => navigate(`/calls/${call.id}`)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") navigate(`/calls/${call.id}`); }}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: gridCols,
                alignItems: "center",
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border-soft)",
                textAlign: "left",
                fontSize: 13,
                cursor: "pointer",
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              {isAdmin && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(call.id)}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelect(call.id)}
                  aria-label={`Select call from ${formatDateTime(call.callDate)}`}
                  style={{ accentColor: "var(--brand)" }}
                />
              )}
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>
                {formatDateTime(call.callDate)}
              </span>
              <CategoryBadge category={call.businessCategory} />
              <span style={{ color: "var(--text-soft)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {call.extraction?.carMake || call.extraction?.carModel
                  ? [call.extraction?.carMake, call.extraction?.carModel].filter(Boolean).join(" ")
                  : <span style={{ color: "var(--text-faint)" }}>—</span>}
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {call.customer?.name ?? call.extraction?.customerName ?? (
                    <span style={{ color: "var(--text-faint)" }}>{call.customer?.phoneNumber ?? "Unknown"}</span>
                  )}
                </span>
                {call.extraction?.extractedByModel === "manual_import" && (
                  <ImportedBadge importedByName={call.importedBy?.name} />
                )}
              </span>
              <span style={{ color: "var(--text-soft)" }}>{call.employee?.name ?? "Unassigned"}</span>
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                {formatDuration(call.durationSeconds)}
              </span>
              <CallStatusBadge status={call.status} />
              {call.extraction?.sentiment ? <SentimentBadge sentiment={call.extraction.sentiment} /> : <span style={{ color: "var(--text-faint)" }}>—</span>}
              {isAdmin && (
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingCall(call); }}
                  aria-label="Edit call"
                  title="Edit"
                  style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex", padding: 6, justifySelf: "start" }}
                >
                  <Pencil size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

        {!loading && calls.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <PhoneCall size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No calls match these filters</p>
            <p style={{ fontSize: 13 }}>Try different filters, or clear them to see every call.</p>
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

function CallEditForm({
  call,
  employees,
  onClose,
  onSaved,
}: {
  call: Call;
  employees: Employee[];
  onClose: () => void;
  onSaved: (updated: Call) => void;
}) {
  const toast = useToast();
  const e = call.extraction;
  const [category, setCategory] = useState<BusinessCategory>(call.businessCategory);
  const [callDate, setCallDate] = useState(call.callDate.slice(0, 10));
  const [employeeId, setEmployeeId] = useState(call.employeeId ?? "");
  const [customerName, setCustomerName] = useState(e?.customerName ?? "");
  const [carMake, setCarMake] = useState(e?.carMake ?? "");
  const [carModel, setCarModel] = useState(e?.carModel ?? "");
  const [carVariant, setCarVariant] = useState(e?.carVariant ?? "");
  const [location, setLocation] = useState(e?.location ?? "");
  const [customerRequirements, setCustomerRequirements] = useState(e?.customerRequirements ?? "");
  const [budget, setBudget] = useState(e?.budget != null ? String(e.budget) : "");
  const [sentiment, setSentiment] = useState<SentimentType | "">(e?.sentiment ?? "");
  const [followUpRequired, setFollowUpRequired] = useState(e?.followUpRequired ?? false);
  const [followUpDate, setFollowUpDate] = useState(e?.followUpDate ? e.followUpDate.slice(0, 10) : "");
  const [summary, setSummary] = useState(e?.summary ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      // The date input only edits the day -- keep the original time-of-day rather
      // than silently collapsing it to midnight when the date itself is unchanged.
      const original = new Date(call.callDate);
      const [year, month, day] = callDate.split("-").map(Number);
      original.setFullYear(year, month - 1, day);
      const callDto: UpdateCallInput = { businessCategory: category, callDate: original.toISOString(), employeeId };
      const updatedCall = await api.calls.update(call.id, callDto);

      let updatedExtraction = call.extraction;
      if (e) {
        const extractionDto: UpdateExtractionInput = {
          customerName: customerName.trim() || undefined,
          carMake: carMake.trim() || undefined,
          carModel: carModel.trim() || undefined,
          carVariant: carVariant.trim() || undefined,
          location: location.trim() || undefined,
          customerRequirements: customerRequirements.trim() || undefined,
          budget: budget ? Number(budget) : undefined,
          followUpRequired,
          followUpDate: followUpDate || undefined,
          summary: summary.trim() || undefined,
          sentiment: sentiment || undefined,
        };
        updatedExtraction = await api.calls.updateExtraction(call.id, extractionDto);
      }

      toast.show("Call updated.", "success");
      onSaved({ ...updatedCall, extraction: updatedExtraction });
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-up" style={{ ...editCardStyle, marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Edit call</div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label style={editFieldLabelStyle}>
          Category
          <select style={editInputStyle} value={category} onChange={(ev) => setCategory(ev.target.value as BusinessCategory)}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label style={editFieldLabelStyle}>
          Call date
          <input type="date" style={editInputStyle} value={callDate} onChange={(ev) => setCallDate(ev.target.value)} />
        </label>
        <label style={editFieldLabelStyle}>
          Employee
          <select style={editInputStyle} value={employeeId} onChange={(ev) => setEmployeeId(ev.target.value)}>
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </label>
      </div>

      {!e && (
        <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 12 }}>
          This call has no AI extraction yet -- only category, date, and employee can be edited until it does.
        </p>
      )}

      {e && (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={editFieldLabelStyle}>
              Customer name
              <input style={editInputStyle} value={customerName} onChange={(ev) => setCustomerName(ev.target.value)} />
            </label>
            <label style={editFieldLabelStyle}>
              Car make
              <input style={editInputStyle} value={carMake} onChange={(ev) => setCarMake(ev.target.value)} />
            </label>
            <label style={editFieldLabelStyle}>
              Car model
              <input style={editInputStyle} value={carModel} onChange={(ev) => setCarModel(ev.target.value)} />
            </label>
            <label style={editFieldLabelStyle}>
              Variant
              <input style={editInputStyle} value={carVariant} onChange={(ev) => setCarVariant(ev.target.value)} />
            </label>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={editFieldLabelStyle}>
              Location
              <input style={editInputStyle} value={location} onChange={(ev) => setLocation(ev.target.value)} />
            </label>
            <label style={editFieldLabelStyle}>
              Budget (₹)
              <input type="number" style={editInputStyle} value={budget} onChange={(ev) => setBudget(ev.target.value)} />
            </label>
          </div>
          <label style={{ ...editFieldLabelStyle, marginBottom: 12 }}>
            Customer requirements
            <textarea style={{ ...editInputStyle, minHeight: 50, resize: "vertical" }} value={customerRequirements} onChange={(ev) => setCustomerRequirements(ev.target.value)} />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12, alignItems: "end" }}>
            <label style={editFieldLabelStyle}>
              Sentiment
              <select style={editInputStyle} value={sentiment} onChange={(ev) => setSentiment(ev.target.value as SentimentType | "")}>
                <option value="">—</option>
                {SENTIMENT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", paddingBottom: 8 }}>
              <input type="checkbox" checked={followUpRequired} onChange={(ev) => setFollowUpRequired(ev.target.checked)} style={{ accentColor: "var(--brand)" }} />
              Follow-up required
            </label>
            <label style={editFieldLabelStyle}>
              Follow-up date
              <input type="date" style={editInputStyle} value={followUpDate} onChange={(ev) => setFollowUpDate(ev.target.value)} disabled={!followUpRequired} />
            </label>
          </div>
          <label style={{ ...editFieldLabelStyle, marginBottom: 16 }}>
            Summary
            <textarea style={{ ...editInputStyle, minHeight: 60, resize: "vertical" }} value={summary} onChange={(ev) => setSummary(ev.target.value)} />
          </label>
        </>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={editPrimaryButtonStyle}>
          <Save size={14} /> {saving ? "Saving…" : "Save changes"}
        </button>
        <button onClick={onClose} style={editSecondaryButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const editCardStyle = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
} as const;

const editFieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
  minWidth: 0,
} as const;

const editInputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
  fontWeight: 400,
} as const;

const editPrimaryButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 15px",
  background: "var(--brand)",
  color: "var(--on-brand)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 700,
} as const;

const editSecondaryButtonStyle = {
  padding: "9px 15px",
  background: "var(--paper)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
} as const;

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
