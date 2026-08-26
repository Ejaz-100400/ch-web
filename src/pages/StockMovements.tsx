import { useEffect, useState, type CSSProperties } from "react";
import { useSearchParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeftRight, Plus, X, ArrowDownToLine, ArrowUpFromLine, ShieldAlert, Trash2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { api, ApiError, type CreateStockMovementInput } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { formatDate } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { Branch, StockItem, StockLocation, StockMovement, StockMovementType } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };
const LOCATION_OPTIONS = (Object.keys(LOCATION_LABELS) as StockLocation[]).map((value) => ({ value, label: LOCATION_LABELS[value] }));

const TYPE_OPTIONS: { value: StockMovementType; label: string }[] = [
  { value: "in", label: "Stock in" },
  { value: "out", label: "Stock out" },
];

const PAGE_SIZE = 20;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function emptyForm(defaultItemId: string): CreateStockMovementInput {
  return { stockItemId: defaultItemId, location: "ambattur", type: "in", quantity: 1, movementDate: todayIso(), reason: "", notes: "" };
}

export default function StockMovements() {
  const { appUser } = useAuth();
  const toast = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const itemFilter = searchParams.get("item") ?? "";

  const [items, setItems] = useState<StockItem[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [type, setType] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [total, setTotal] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<CreateStockMovementInput>(emptyForm(""));
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    api.stock.items().then(setItems).catch(() => setItems([]));
  }, []);

  useEffect(() => {
    setPage(1);
  }, [itemFilter, location, type, search, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.stock
      .movements({
        stockItemId: itemFilter || undefined,
        location: location.length ? (location as StockLocation[]) : undefined,
        type: type.length ? (type as StockMovementType[]) : undefined,
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setMovements(res.items);
        setTotal(res.total);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load stock movements", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemFilter, location, type, search, dateFrom, dateTo, page]);

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title="Stock movements" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Stock tracking requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  function openForm() {
    setForm(emptyForm(itemFilter || items[0]?.id || ""));
    setFormOpen(true);
  }

  function clearItemFilter() {
    setSearchParams((prev) => {
      const p = new URLSearchParams(prev);
      p.delete("item");
      return p;
    });
  }

  async function handleSave() {
    if (!form.stockItemId) {
      toast.show("Pick a stock item first.", "error");
      return;
    }
    if (!form.quantity || form.quantity < 1) {
      toast.show("Quantity must be at least 1.", "error");
      return;
    }
    setSaving(true);
    try {
      await api.stock.createMovement({
        stockItemId: form.stockItemId,
        location: form.location,
        type: form.type,
        quantity: form.quantity,
        movementDate: form.movementDate,
        reason: form.reason?.trim() || undefined,
        notes: form.notes?.trim() || undefined,
      });
      toast.show(form.type === "in" ? "Stock added." : "Stock removed.", "success");
      setFormOpen(false);
      setPage(1);
      // Re-fetch items too -- their per-location quantities just changed.
      api.stock.items().then(setItems).catch(() => {});
      api.stock
        .movements({ stockItemId: itemFilter || undefined, location: location.length ? (location as StockLocation[]) : undefined, type: type.length ? (type as StockMovementType[]) : undefined, search: search || undefined, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, page: 1, pageSize: PAGE_SIZE })
        .then((res) => {
          setMovements(res.items);
          setTotal(res.total);
        })
        .catch(() => {});
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to record movement", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(m: StockMovement) {
    if (!window.confirm(`Delete this ${m.type === "in" ? "stock in" : "stock out"} entry for "${m.stockItem?.name ?? "this item"}"?`)) return;
    setDeletingId(m.id);
    try {
      await api.stock.deleteMovement(m.id);
      toast.show("Movement deleted.", "success");
      setMovements((prev) => prev.filter((x) => x.id !== m.id));
      setTotal((t) => t - 1);
      api.stock.items().then(setItems).catch(() => {});
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete movement", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredItemName = itemFilter ? items.find((i) => i.id === itemFilter)?.name : null;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(location.length || type.length || search || dateFrom || dateTo || itemFilter);

  return (
    <div>
      <PageHeader
        eyebrow="Stock Tracking"
        title="Stock movements"
        description="Every restock and every unit used, so current levels always trace back to something."
        actions={
          !formOpen && (
            <button onClick={openForm} style={primaryButtonStyle}>
              <Plus size={15} /> Log movement
            </button>
          )
        }
      />

      {itemFilter && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14, fontSize: 12.5, color: "var(--text-soft)" }}>
          Filtered to <strong>{filteredItemName ?? "this item"}</strong>
          <button onClick={clearItemFilter} style={{ background: "none", border: "none", color: "var(--brand-strong)", fontWeight: 700, fontSize: 12.5 }}>
            Clear
          </button>
        </div>
      )}

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Log a stock movement</div>
            <button onClick={() => setFormOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Item
              <select style={inputStyle} value={form.stockItemId} onChange={(e) => setForm((f) => ({ ...f, stockItemId: e.target.value }))}>
                <option value="">Select an item</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Location
              <select style={inputStyle} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value as StockLocation }))}>
                {LOCATION_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Date
              <DateInput value={form.movementDate} onChange={(v) => setForm((f) => ({ ...f, movementDate: v }))} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 4, marginBottom: 12 }}>
            {TYPE_OPTIONS.map((o) => {
              const active = form.type === o.value;
              const Icon = o.value === "in" ? ArrowDownToLine : ArrowUpFromLine;
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, type: o.value }))}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "8px 14px",
                    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--brand-soft)" : "var(--paper)",
                    color: active ? "var(--brand-strong)" : "var(--text-soft)",
                    fontSize: 13,
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  <Icon size={14} /> {o.label}
                </button>
              );
            })}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "0.6fr 1.4fr", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              Quantity
              <input
                type="number"
                min={1}
                style={inputStyle}
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
              />
            </label>
            <label style={fieldLabelStyle}>
              Reason <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
              <input
                style={inputStyle}
                value={form.reason}
                onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
                placeholder={form.type === "in" ? "e.g. Restock from supplier" : "e.g. Used on customer install"}
              />
            </label>
          </div>

          <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
            Notes
            <textarea style={{ ...inputStyle, minHeight: 50, resize: "vertical" }} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </label>

          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving…" : "Log movement"}
            </button>
            <button onClick={() => setFormOpen(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search reason or item" />
        <MultiSelectFilter label="Location" values={location} onChange={setLocation} options={LOCATION_OPTIONS} />
        <FilterSelect label="Type" value={type[0] ?? ""} onChange={(v) => setType(v ? [v] : [])} options={TYPE_OPTIONS} />
        <DateInput value={dateFrom} onChange={setDateFrom} aria-label="From date" style={filterDateStyle} />
        <DateInput value={dateTo} onChange={setDateTo} aria-label="To date" style={filterDateStyle} />
        {hasFilters && (
          <ClearFiltersButton
            onClick={() => {
              setLocation([]);
              setType([]);
              setSearch("");
              setDateFrom("");
              setDateTo("");
              if (itemFilter) clearItemFilter();
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} movement${total === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 840 }}>
            <div className="mono" style={theadStyle}>
              <span>Date</span>
              <span>Item</span>
              <span>Location</span>
              <span>Type</span>
              <span>Qty</span>
              <span>Reason</span>
              <span>Entered by</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={6} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {movements.map((m) => (
                    <motion.div key={m.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle}>
                      <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(m.movementDate)}</span>
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600 }}>{m.stockItem?.name ?? "—"}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{LOCATION_LABELS[m.location]}</span>
                      <span>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "3px 8px",
                            borderRadius: 999,
                            fontSize: 11.5,
                            fontWeight: 700,
                            color: m.type === "in" ? "var(--brand-strong)" : "var(--coral)",
                            background: m.type === "in" ? "var(--brand-soft)" : "var(--coral-soft)",
                          }}
                        >
                          {m.type === "in" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />}
                          {m.type === "in" ? "In" : "Out"}
                        </span>
                      </span>
                      <span className="mono" style={{ fontWeight: 700 }}>{m.quantity}</span>
                      <span style={{ color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.reason ?? "—"}</span>
                      <span style={{ color: "var(--text-faint)", fontSize: 12.5 }}>{m.enteredBy?.name ?? "—"}</span>
                      <span>
                        <button
                          onClick={() => handleDelete(m)}
                          disabled={deletingId === m.id}
                          aria-label="Delete movement"
                          title="Delete"
                          style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 26, height: 26, background: "none", border: "none", borderRadius: 6, color: "var(--coral)" }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && movements.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <ArrowLeftRight size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No movements match these filters</p>
            <p style={{ fontSize: 13 }}>Log today's restock or usage to get started.</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

const gridColumns = "100px 1.4fr 1.1fr 90px 60px 1.3fr 1fr 70px";

const theadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: gridColumns,
  padding: "10px 18px",
  fontSize: 11,
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border-soft)",
};

const trowStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: gridColumns,
  alignItems: "center",
  padding: "12px 18px",
  borderBottom: "1px solid var(--border-soft)",
  fontSize: 13,
};

const fieldLabelStyle: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
  minWidth: 0,
};

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
  fontFamily: "inherit",
};

const filterDateStyle: CSSProperties = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
};

const primaryButtonStyle: CSSProperties = {
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
};

const secondaryButtonStyle: CSSProperties = {
  padding: "9px 15px",
  background: "var(--paper)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
};
