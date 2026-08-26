import { useEffect, useState, type CSSProperties } from "react";
import { Link } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Package, Plus, X, Pencil, ArrowLeftRight, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError, type CreateStockItemInput } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { Branch, StockItem } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const ALL_BRANCHES = Object.keys(BRANCH_LABELS) as Branch[];

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const EMPTY_FORM: CreateStockItemInput = { name: "", category: "car_glasses", unit: "pcs", reorderThreshold: 0, active: true };

export default function StockItems() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockItem | null>(null);
  const [form, setForm] = useState<CreateStockItemInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  function load() {
    setLoading(true);
    api.stock
      .items({ search: search || undefined, category: category.length ? (category as ("car_glasses" | "car_modifications")[]) : undefined })
      .then(setItems)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load stock items", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category]);

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title="Stock items" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Stock tracking requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(item: StockItem) {
    setEditing(item);
    setForm({ name: item.name, category: item.category, unit: item.unit, reorderThreshold: item.reorderThreshold, active: item.active });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.show("Item name is required.", "error");
      return;
    }
    setSaving(true);
    const dto: CreateStockItemInput = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit?.trim() || "pcs",
      reorderThreshold: form.reorderThreshold ?? 0,
      active: form.active,
    };
    try {
      if (editing) {
        await api.stock.updateItem(editing.id, dto);
        toast.show("Stock item updated.", "success");
      } else {
        await api.stock.createItem(dto);
        toast.show("Stock item added.", "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save stock item", "error");
    } finally {
      setSaving(false);
    }
  }

  const hasFilters = Boolean(search || category.length);

  return (
    <div>
      <PageHeader
        eyebrow="Stock Tracking"
        title="Stock items"
        description="What you're tracking, and how much is on hand at each branch."
        actions={
          <button onClick={openCreate} style={primaryButtonStyle}>
            <Plus size={15} /> Add item
          </button>
        }
      />

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit stock item" : "New stock item"}</div>
            <button onClick={() => setFormOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 0.8fr 0.8fr", gap: 12, marginBottom: 16 }}>
            <label style={fieldLabelStyle}>
              Name
              <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Swift LED headlight set" />
            </label>
            <label style={fieldLabelStyle}>
              Category
              <select style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as CreateStockItemInput["category"] }))}>
                {CATEGORY_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Unit
              <input style={inputStyle} value={form.unit} onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))} placeholder="pcs" />
            </label>
            <label style={fieldLabelStyle}>
              Reorder at
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={form.reorderThreshold}
                onChange={(e) => setForm((f) => ({ ...f, reorderThreshold: Number(e.target.value) }))}
              />
            </label>
          </div>
          {editing && (
            <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", marginBottom: 16 }}>
              <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} style={{ accentColor: "var(--brand)" }} />
              Active
            </label>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
              {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
            </button>
            <button onClick={() => setFormOpen(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        {hasFilters && <ClearFiltersButton onClick={() => { setSearch(""); setCategory([]); }} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${items.length} item${items.length === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 900 }}>
            <div className="mono" style={theadStyle}>
              <span>Name</span>
              <span>Category</span>
              {ALL_BRANCHES.map((b) => (
                <span key={b}>{BRANCH_LABELS[b]}</span>
              ))}
              <span>Reorder at</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={5} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {items.map((item) => (
                    <motion.div key={item.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle}>
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: item.active ? 1 : 0.5 }}>
                        {item.name}
                        {!item.active && <span style={{ fontWeight: 400, color: "var(--text-faint)", fontSize: 11 }}> (inactive)</span>}
                      </span>
                      <span><CategoryBadge category={item.category} /></span>
                      {ALL_BRANCHES.map((b) => {
                        const q = item.quantities.find((x) => x.branch === b);
                        return (
                          <span key={b} className="mono" style={{ fontWeight: q?.lowStock ? 700 : 400, color: q?.lowStock ? "var(--coral)" : "var(--text)" }}>
                            {q?.quantity ?? 0} {item.unit}
                          </span>
                        );
                      })}
                      <span className="mono" style={{ color: "var(--text-faint)" }}>{item.reorderThreshold}</span>
                      <span style={{ display: "flex", gap: 4 }}>
                        <Link to={`/stock/movements?item=${item.id}`} aria-label={`Log movement for ${item.name}`} title="Log movement" style={iconButtonStyle}>
                          <ArrowLeftRight size={14} />
                        </Link>
                        <button onClick={() => openEdit(item)} aria-label={`Edit ${item.name}`} title="Edit" style={iconButtonStyle}>
                          <Pencil size={14} />
                        </button>
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
            <Package size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No stock items yet</p>
            <p style={{ fontSize: 13 }}>Add them one at a time as you go -- no need to import everything at once.</p>
          </div>
        )}
      </div>
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

const gridColumns = "1.6fr 1fr repeat(4, 0.9fr) 0.8fr 80px";

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
  textDecoration: "none",
};
