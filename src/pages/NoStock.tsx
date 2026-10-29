import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, HelpCircle, PackageX, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { SuggestInput } from "../components/ui/SuggestInput";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { LoadingText } from "../components/ui/Spinner";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/format";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import { todayIstDate } from "../lib/appointment-time";
import type { NoStockRequest, SaleMatchResult, StockItem } from "../types";

type Category = "car_glasses" | "car_modifications";

const CATEGORY_OPTIONS: { value: Category; label: string }[] = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const PAGE_SIZE = 20;

interface FormState {
  customerName: string;
  customerPhone: string;
  location: string;
  itemName: string;
  // "" until picked -- required, with no default so it can't be left on the wrong one by accident.
  category: Category | "";
  date: string;
}

function emptyForm(): FormState {
  return { customerName: "", customerPhone: "", location: "", itemName: "", category: "", date: todayIstDate() };
}

export default function NoStock() {
  const { appUser } = useAuth();
  const toast = useToast();
  const manager = canManage(appUser?.role);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [items, setItems] = useState<NoStockRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NoStockRequest | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [matchResult, setMatchResult] = useState<SaleMatchResult | null>(null);
  const [matching, setMatching] = useState(false);

  // Item-name suggestions from the stock catalog -- the thing asked for often
  // exists there with nothing on hand. Only managers can add, so only they fetch it.
  const [stockItems, setStockItems] = useState<StockItem[]>([]);
  useEffect(() => {
    if (manager) api.stock.items().then(setStockItems).catch(() => setStockItems([]));
  }, [manager]);

  useEffect(() => {
    setPage(1);
  }, [search, category, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const t = setTimeout(
      () => {
        api.noStock
          .list({
            search: search || undefined,
            category: category.length ? (category as Category[]) : undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
            page,
            pageSize: PAGE_SIZE,
          })
          .then((res) => {
            if (!active) return;
            setItems(res.items);
            setTotal(res.total);
          })
          .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load the list", "error"))
          .finally(() => {
            if (active) setLoading(false);
          });
      },
      search ? 300 : 0,
    );
    return () => {
      active = false;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, dateFrom, dateTo, page, refreshKey]);

  // Same debounced call-history lookup the Customer Tracker and Appointments
  // forms use: say whether this number has called before, and fill the name
  // if it's still blank.
  useEffect(() => {
    if (!formOpen) return;
    const phoneValue = form.customerPhone.trim();
    if (phoneValue.length < 6) {
      setMatchResult(null);
      return;
    }
    const t = setTimeout(() => {
      setMatching(true);
      api.sales
        .match(phoneValue)
        .then((res) => {
          setMatchResult(res);
          if (res.matched && res.customer.name) {
            setForm((f) => ({ ...f, customerName: f.customerName || res.customer.name || "" }));
          }
        })
        .catch(() => setMatchResult(null))
        .finally(() => setMatching(false));
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.customerPhone, formOpen]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setMatchResult(null);
    setFormOpen(true);
  }

  function openEdit(r: NoStockRequest) {
    setEditing(r);
    setForm({
      customerName: r.customerName,
      customerPhone: r.customerPhone,
      location: r.location ?? "",
      itemName: r.itemName,
      category: r.category,
      date: r.requestDate.slice(0, 10),
    });
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  function setItemName(value: string) {
    // Picking (or typing) a name that's already in the stock catalog also
    // sets its category, so the two can't disagree.
    const known = stockItems.find((s) => s.name.toLowerCase() === value.trim().toLowerCase());
    setForm((f) => ({ ...f, itemName: value, category: known ? known.category : f.category }));
  }

  // Everything but location is required -- Save stays disabled until it's all
  // there, so there's no error to show after the fact.
  const canSubmit = Boolean(form.customerName.trim() && form.customerPhone.trim() && form.itemName.trim() && form.category && form.date);

  async function handleSave() {
    if (!canSubmit || form.category === "") return;
    const dto = {
      customerName: form.customerName.trim(),
      customerPhone: form.customerPhone.trim(),
      // Sent even when empty so clearing a location on edit reaches the server.
      location: form.location.trim(),
      itemName: form.itemName.trim(),
      category: form.category,
      requestDate: form.date,
    };
    setSaving(true);
    try {
      if (editing) {
        await api.noStock.update(editing.id, dto);
        toast.show("Entry updated.", "success");
      } else {
        await api.noStock.create(dto);
        toast.show("Entry saved.", "success");
      }
      closeForm();
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save the entry", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(r: NoStockRequest) {
    if (!window.confirm(`Delete the entry for ${r.customerName} (${r.itemName})? This can't be undone.`)) return;
    setBusyId(r.id);
    try {
      await api.noStock.remove(r.id);
      toast.show("Entry deleted.", "success");
      setRefreshKey((k) => k + 1);
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete the entry", "error");
    } finally {
      setBusyId(null);
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasFilters = Boolean(search || category.length || dateFrom || dateTo);

  return (
    <div>
      <PageHeader
        eyebrow="No Stock"
        title="No stock enquiries"
        description="Customers who asked for something we didn't have -- take down their details so we can get back to them when it arrives."
        actions={
          manager && !formOpen ? (
            <button onClick={openCreate} style={primaryButtonStyle}>
              <Plus size={15} /> Add entry
            </button>
          ) : undefined
        }
      />

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit entry" : "New no-stock entry"}</div>
            <button onClick={closeForm} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 12 }}>
            <label style={fieldLabelStyle}>
              <span>Phone number <RequiredMark /></span>
              <input style={inputStyle} value={form.customerPhone} onChange={(e) => setForm((f) => ({ ...f, customerPhone: e.target.value }))} placeholder="9xxxxxxxxx" />
            </label>
            <label style={fieldLabelStyle}>
              <span>Customer name <RequiredMark /></span>
              <input style={inputStyle} value={form.customerName} onChange={(e) => setForm((f) => ({ ...f, customerName: e.target.value }))} placeholder="e.g. Ravi Kumar" />
            </label>
            <label style={fieldLabelStyle}>
              Location <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
              <input style={inputStyle} value={form.location} onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))} placeholder="e.g. Anna Nagar" />
            </label>
          </div>

          {matching && (
            <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 12 }}>
              <LoadingText label="Checking call history…" />
            </div>
          )}
          {!matching && matchResult && (
            <div style={{ ...matchHintStyle, background: matchResult.matched ? "var(--brand-soft)" : "var(--border-soft)" }}>
              {matchResult.matched ? (
                <CheckCircle2 size={14} color="var(--brand-strong)" style={{ flexShrink: 0, marginTop: 1 }} />
              ) : (
                <HelpCircle size={14} color="var(--text-faint)" style={{ flexShrink: 0, marginTop: 1 }} />
              )}
              <span style={{ fontSize: 12.5, color: matchResult.matched ? "var(--text)" : "var(--text-soft)" }}>
                {matchResult.matched ? (
                  <>
                    <strong>{matchResult.customer.name ?? "This number"}</strong> has called before -- {matchResult.customer.calls.length} call
                    {matchResult.customer.calls.length === 1 ? "" : "s"} on record.
                  </>
                ) : (
                  "No call history for this number yet."
                )}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 12, marginBottom: 16 }}>
            <label style={fieldLabelStyle}>
              <span>Item name <RequiredMark /></span>
              <SuggestInput
                style={inputStyle}
                value={form.itemName}
                onChange={setItemName}
                options={stockItems.map((s) => s.name)}
                placeholder="What they asked for"
              />
            </label>
            <label style={fieldLabelStyle}>
              <span>Category <RequiredMark /></span>
              <select
                style={{ ...inputStyle, borderColor: form.category ? "var(--border)" : "var(--brand)" }}
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as Category }))}
              >
                <option value="" disabled>Select…</option>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              <span>Date <RequiredMark /></span>
              <DateInput value={form.date} onChange={(v) => setForm((f) => ({ ...f, date: v }))} style={inputStyle} />
            </label>
          </div>

          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              onClick={handleSave}
              disabled={saving || !canSubmit}
              style={{ ...primaryButtonStyle, opacity: saving || !canSubmit ? 0.55 : 1, cursor: saving || !canSubmit ? "not-allowed" : "pointer" }}
            >
              {saving ? "Saving…" : editing ? "Save changes" : "Save entry"}
            </button>
            <button onClick={closeForm} style={secondaryButtonStyle}>
              Cancel
            </button>
            {!canSubmit && !saving && <span style={{ fontSize: 12, color: "var(--text-faint)" }}>Fill in everything marked * to continue.</span>}
          </div>
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search name, phone or item" />
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <DateInput value={dateFrom} onChange={setDateFrom} aria-label="From date" style={filterDateStyle} />
        <DateInput value={dateTo} onChange={setDateTo} aria-label="To date" style={filterDateStyle} />
        {hasFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setCategory([]);
              setDateFrom("");
              setDateTo("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${total} entr${total === 1 ? "y" : "ies"}`}
      </div>

      <div style={{ ...cardStyle, overflow: "hidden" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 860 }}>
            <div className="mono" style={theadStyle}>
              <span>Date</span>
              <span>Customer</span>
              <span>Location</span>
              <span>Item</span>
              <span>Category</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={5} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {items.map((r) => (
                    <motion.div key={r.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle}>
                      <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>{formatDate(r.requestDate)}</span>
                      <span style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {r.customerId ? (
                            <Link to={`/customers/${r.customerId}`} title="View customer and call history" style={{ color: "inherit", textDecoration: "none" }}>
                              {r.customerName}
                            </Link>
                          ) : (
                            r.customerName
                          )}
                        </div>
                        <div className="mono" style={{ fontSize: 12, color: "var(--text-soft)" }}>{r.customerPhone}</div>
                      </span>
                      <span style={{ color: "var(--text-soft)" }}>{r.location || "—"}</span>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>{r.itemName}</span>
                      <span><CategoryBadge category={r.category} /></span>
                      <span style={{ display: "flex", gap: 4 }}>
                        {manager && (
                          <>
                            <button onClick={() => openEdit(r)} aria-label={`Edit entry for ${r.customerName}`} title="Edit" style={iconButtonStyle}>
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(r)}
                              disabled={busyId === r.id}
                              aria-label={`Delete entry for ${r.customerName}`}
                              title="Delete"
                              style={{ ...iconButtonStyle, color: "var(--coral)" }}
                            >
                              <Trash2 size={14} />
                            </button>
                          </>
                        )}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && items.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <PackageX size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>
              {hasFilters ? "No entries match these filters" : "Nothing taken down yet"}
            </p>
            <p style={{ fontSize: 13 }}>{manager ? "When a customer asks for something we don't have, add it here." : "Entries added by your team will show up here."}</p>
          </div>
        )}
      </div>

      {!loading && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
    </div>
  );
}

function RequiredMark() {
  return (
    <span aria-hidden="true" title="Required" style={{ color: "var(--coral)", fontWeight: 700 }}>
      *
    </span>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

const gridColumns = "110px 1.3fr 1fr 1.5fr 140px 76px";

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
  gap: 8,
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

const matchHintStyle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  padding: "9px 12px",
  borderRadius: "var(--radius-sm)",
  marginBottom: 12,
};

const iconButtonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  background: "none",
  border: "none",
  borderRadius: 6,
  color: "var(--text-soft)",
  cursor: "pointer",
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
