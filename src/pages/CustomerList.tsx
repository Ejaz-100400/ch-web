import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Copy, Merge, Pencil, Save, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, FilterSelect, AdvancedFiltersToggle, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge, CallStatusBadge } from "../components/ui/StatusBadge";
import { Avatar } from "../components/ui/Avatar";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { useVehicleFilters } from "../lib/useVehicleFilters";
import { formatDuration, relativeDay, formatDateTime } from "../lib/format";
import type { Call, Customer } from "../types";

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

export default function CustomerList() {
  const navigate = useNavigate();
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [phone, setPhone] = useState("");
  const [debouncedPhone, setDebouncedPhone] = useState("");
  const { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset: resetVehicleFilters } = useVehicleFilters();
  const [category, setCategory] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [callsByCustomer, setCallsByCustomer] = useState<Record<string, Call[]>>({});
  const [callsLoading, setCallsLoading] = useState<string | null>(null);

  const [showDuplicates, setShowDuplicates] = useState(false);
  const isAdmin = appUser?.role === "admin";
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [refreshToken, setRefreshToken] = useState(0);

  function refreshCustomer(updated: Customer) {
    setCustomers((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
  }

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
  }, [carMake, carModel, category]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.customers
      .list({
        search: debouncedSearch || undefined,
        phone: debouncedPhone || undefined,
        carMake: carMake || undefined,
        carModel: carModel || undefined,
        category: category || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setCustomers(res.items);
        setTotal(res.total);
        // A selection only makes sense against the rows currently on screen --
        // a fresh fetch (new page, new filters) means it's stale.
        setSelectedIds(new Set());
        setConfirmingDelete(false);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load customers", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, debouncedPhone, carMake, carModel, category, page, refreshToken]);

  async function toggleExpand(customer: Customer) {
    const isOpen = expanded === customer.id;
    setExpanded(isOpen ? null : customer.id);
    if (!isOpen && !callsByCustomer[customer.id]) {
      setCallsLoading(customer.id);
      try {
        const calls = await api.customers.calls(customer.id);
        setCallsByCustomer((prev) => ({ ...prev, [customer.id]: calls }));
      } catch (err) {
        toast.show(err instanceof ApiError ? err.message : "Failed to load calls", "error");
      } finally {
        setCallsLoading(null);
      }
    }
  }

  const hasActiveFilters = Boolean(search || phone || carMake || carModel || category);
  const advancedFilterCount = [carMake, carModel, category].filter(Boolean).length;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const gridCols = isAdmin ? "24px 28px 1.8fr 1.2fr 1.2fr 1.3fr 1fr 40px" : "28px 1.8fr 1.2fr 1.2fr 1.3fr 1fr";

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const allOnPageSelected = customers.length > 0 && customers.every((c) => selectedIds.has(c.id));

  function toggleSelectAllOnPage() {
    setSelectedIds(allOnPageSelected ? new Set() : new Set(customers.map((c) => c.id)));
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    setDeleting(true);
    try {
      const ids = Array.from(selectedIds);
      const res = await api.customers.removeMany(ids);
      setCustomers((prev) => prev.filter((c) => !selectedIds.has(c.id)));
      setTotal((prev) => Math.max(0, prev - res.deleted));
      setSelectedIds(new Set());
      setConfirmingDelete(false);
      toast.show(`Deleted ${res.deleted} customer${res.deleted === 1 ? "" : "s"}. Their call history stays, just unassigned.`, "success");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete customers", "error");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Customers"
        title="Customer directory"
        description="Search your customer base and jump straight into a call record. Customers are created automatically the first time they call in."
        actions={
          canManage(appUser?.role) ? (
            <button
              onClick={() => setShowDuplicates((v) => !v)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 15px",
                background: showDuplicates ? "var(--brand)" : "var(--paper-raised)",
                color: showDuplicates ? "var(--on-brand)" : "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13.5,
                fontWeight: 700,
                transition: "background 120ms ease, color 120ms ease",
              }}
            >
              <Copy size={15} /> Possible duplicates
            </button>
          ) : undefined
        }
      />

      {showDuplicates && canManage(appUser?.role) && (
        <DuplicatesPanel
          onClose={() => setShowDuplicates(false)}
          onMerged={() => {
            setPage(1);
            setRefreshToken((t) => t + 1);
          }}
        />
      )}

      {editingCustomer && (
        <CustomerEditForm customer={editingCustomer} onClose={() => setEditingCustomer(null)} onSaved={(c) => { refreshCustomer(c); setEditingCustomer(null); }} />
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Phone number"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 150 }}
        />
        <AdvancedFiltersToggle open={showAdvanced} count={advancedFilterCount} onClick={() => setShowAdvanced((v) => !v)} />
        {hasActiveFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setPhone("");
              resetVehicleFilters();
              setCategory("");
            }}
          />
        )}
      </FilterBar>

      {showAdvanced && (
        <FilterBar>
          <select style={vehicleSelectStyle} value={carMake} onChange={(e) => setCarMake(e.target.value)}>
            <option value="">All makes</option>
            {carMakeOptions.map((make) => (
              <option key={make} value={make}>{make}</option>
            ))}
          </select>
          <select style={vehicleSelectStyle} value={carModel} onChange={(e) => setCarModel(e.target.value)}>
            <option value="">All models</option>
            {carModelOptions.map((model) => (
              <option key={model} value={model}>{model}</option>
            ))}
          </select>
          <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        </FilterBar>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, gap: 12, flexWrap: "wrap" }}>
        <div style={{ fontSize: 12.5, color: "var(--text-faint)" }}>
          {loading ? <LoadingText /> : `${total} customer${total === 1 ? "" : "s"}`}
        </div>

        {isAdmin && selectedIds.size > 0 && (
          <div className="fade-in-up" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12.5 }}>
            {confirmingDelete ? (
              <>
                <span style={{ color: "var(--coral)", fontWeight: 700 }}>
                  Delete {selectedIds.size} customer{selectedIds.size === 1 ? "" : "s"}? Their call history stays, just unassigned. This can't be undone.
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
        <div style={{ minWidth: 760 }}>
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
              aria-label="Select all on page"
              style={{ cursor: "pointer" }}
            />
          )}
          <span />
          <span>Customer</span>
          <span>Phone</span>
          <span>Vehicle</span>
          <span>Notes</span>
          <span>Since</span>
          {isAdmin && <span />}
        </div>

        {loading && <SkeletonRows rows={6} />}

        {!loading &&
          customers.map((c) => {
            const isOpen = expanded === c.id;
            const calls = callsByCustomer[c.id] ?? [];

            return (
              <div key={c.id} style={{ borderBottom: "1px solid var(--border-soft)" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => toggleExpand(c)}
                  onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleExpand(c); }}
                  style={{
                    width: "100%",
                    display: "grid",
                    gridTemplateColumns: gridCols,
                    alignItems: "center",
                    padding: "12px 18px",
                    background: isOpen ? "var(--paper)" : "transparent",
                    border: "none",
                    textAlign: "left",
                    fontSize: 13.5,
                    cursor: "pointer",
                  }}
                >
                  {isAdmin && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(c.id)}
                      onChange={() => toggleSelect(c.id)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${c.name ?? c.phoneNumber}`}
                      style={{ cursor: "pointer" }}
                    />
                  )}
                  <span style={{ color: "var(--text-faint)", display: "flex" }}>
                    {isOpen ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                    <Avatar name={c.name ?? c.phoneNumber} size={30} />
                    <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 700 }}>
                      {c.name ?? <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Unnamed caller</span>}
                    </span>
                  </span>
                  <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                    {c.phoneNumber}
                  </span>
                  <span style={{ color: "var(--text-soft)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.latestCarMake || c.latestCarModel
                      ? [c.latestCarMake, c.latestCarModel].filter(Boolean).join(" ")
                      : <span style={{ color: "var(--text-faint)" }}>—</span>}
                  </span>
                  <span style={{ color: "var(--text-soft)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {c.notes ?? "—"}
                  </span>
                  <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{relativeDay(c.createdAt)}</span>
                  {isAdmin && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); }}
                      aria-label="Edit customer"
                      title="Edit"
                      style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex", padding: 6, justifySelf: "start" }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>

                {isOpen && (
                  <div className="expand-row-anim" style={{ background: "var(--paper)", padding: "6px 18px 16px 56px" }}>
                    {callsLoading === c.id ? (
                      <p style={{ fontSize: 13, color: "var(--text-faint)", padding: "8px 0" }}>Loading calls…</p>
                    ) : calls.length === 0 ? (
                      <p style={{ fontSize: 13, color: "var(--text-faint)", padding: "8px 0" }}>No calls logged yet.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        {calls.map((call) => (
                          <button
                            key={call.id}
                            onClick={() => navigate(`/calls/${call.id}`)}
                            style={{
                              display: "grid",
                              gridTemplateColumns: "110px auto 1fr auto",
                              alignItems: "center",
                              gap: 14,
                              padding: "10px 12px",
                              background: "var(--paper-raised)",
                              border: "1px solid var(--border-soft)",
                              borderRadius: "var(--radius-sm)",
                              textAlign: "left",
                              fontSize: 13,
                              transition: "border-color 120ms ease",
                            }}
                          >
                            <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>
                              {formatDateTime(call.callDate)}
                            </span>
                            <CategoryBadge category={call.businessCategory} />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-soft)" }}>
                              {call.extraction?.summary ?? "No summary yet"}
                              {call.employee && <span style={{ color: "var(--text-faint)" }}> · {call.employee.name}</span>}
                            </span>
                            <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="mono" style={{ fontSize: 12, color: "var(--text-soft)" }}>
                                {formatDuration(call.durationSeconds)}
                              </span>
                              <CallStatusBadge status={call.status} />
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

        {!loading && customers.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No customers match this search</p>
            <p style={{ fontSize: 13 }}>Try a different name or phone number, or clear the search.</p>
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

function CustomerEditForm({
  customer,
  onClose,
  onSaved,
}: {
  customer: Customer;
  onClose: () => void;
  onSaved: (updated: Customer) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState(customer.name ?? "");
  const [notes, setNotes] = useState(customer.notes ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const updated = await api.customers.update(customer.id, { name: name.trim() || undefined, notes: notes.trim() || undefined });
      toast.show("Customer updated.", "success");
      onSaved(updated);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save changes", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-up" style={{ ...editCardStyle, marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Edit customer</div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={editFieldLabelStyle}>
          Name
          <input style={editInputStyle} value={name} onChange={(e) => setName(e.target.value)} placeholder={customer.phoneNumber} />
        </label>
        <label style={editFieldLabelStyle}>
          Notes
          <input style={editInputStyle} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
      </div>
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

const vehicleSelectStyle = {
  padding: "9px 12px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13.5,
  width: 160,
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

function DuplicatesPanel({ onClose, onMerged }: { onClose: () => void; onMerged: () => void }) {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [pairs, setPairs] = useState<
    { id_a: string; name_a: string; id_b: string; name_b: string; similarity: number; call_count_a: number; call_count_b: number }[]
  >([]);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [merging, setMerging] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    api.customers
      .duplicates()
      .then((res) => {
        if (active) setPairs(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load duplicates", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function merge(duplicateId: string, canonicalId: string, key: string) {
    setMerging(key);
    try {
      await api.customers.merge(duplicateId, canonicalId);
      setPairs((prev) => prev.filter((p) => !(p.id_a === duplicateId || p.id_b === duplicateId)));
      toast.show("Customers merged.", "success");
      onMerged();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Merge failed", "error");
    } finally {
      setMerging(null);
      setConfirming(null);
    }
  }

  return (
    <div
      className="fade-in-up"
      style={{
        background: "var(--paper-raised)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        padding: 16,
        marginBottom: 18,
        boxShadow: "var(--shadow-card)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>Possible duplicate customers</div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>

      {loading && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Checking for duplicates…</p>}
      {!loading && pairs.length === 0 && <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No likely duplicates found by name similarity.</p>}

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {pairs.map((p) => {
          const key = `${p.id_a}-${p.id_b}`;
          const isReviewing = confirming === key;
          return (
            <div
              key={key}
              style={{
                border: "1px solid var(--border-soft)",
                borderRadius: "var(--radius-sm)",
                fontSize: 13,
                overflow: "hidden",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px" }}>
                <span style={{ flex: 1 }}>
                  <strong>{p.name_a}</strong> <span style={{ color: "var(--text-faint)" }}>vs</span> <strong>{p.name_b}</strong>
                </span>
                <span className="mono" style={{ fontSize: 12, color: "var(--text-faint)" }}>
                  {Math.round(p.similarity * 100)}% similar
                </span>
                <button
                  onClick={() => setConfirming(isReviewing ? null : key)}
                  style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 10px", background: isReviewing ? "var(--paper)" : "var(--paper)", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12, fontWeight: 600 }}
                >
                  <Merge size={13} /> {isReviewing ? "Hide review" : "Review merge"}
                </button>
              </div>

              {isReviewing && (
                <div className="fade-in-up" style={{ padding: "12px", borderTop: "1px solid var(--border-soft)", background: "var(--paper)" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                    <div style={{ padding: 10, border: "1px solid var(--coral)", borderRadius: 6, background: "var(--coral-soft)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--coral)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
                        Will be deleted
                      </div>
                      <div style={{ fontWeight: 700 }}>{p.name_a}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.call_count_a} call{p.call_count_a === 1 ? "" : "s"} moved over</div>
                    </div>
                    <div style={{ padding: 10, border: "1px solid var(--brand)", borderRadius: 6, background: "var(--paper-raised)" }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: 4 }}>
                        Kept (survivor)
                      </div>
                      <div style={{ fontWeight: 700 }}>{p.name_b}</div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)" }}>{p.call_count_b} existing call{p.call_count_b === 1 ? "" : "s"}</div>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: "var(--text-soft)", marginBottom: 12 }}>
                    All {p.call_count_a} call{p.call_count_a === 1 ? "" : "s"} from "{p.name_a}" will be reassigned to "{p.name_b}", then "{p.name_a}" is deleted. This can't be undone.
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => merge(p.id_a, p.id_b, key)}
                      disabled={merging === key}
                      style={{ padding: "6px 12px", background: "var(--brand)", color: "var(--on-brand)", border: "none", borderRadius: 6, fontSize: 12.5, fontWeight: 700 }}
                    >
                      {merging === key ? "Merging…" : "Confirm merge"}
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      disabled={merging === key}
                      style={{ padding: "6px 12px", background: "none", border: "1px solid var(--border)", borderRadius: 6, fontSize: 12.5, fontWeight: 600 }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
