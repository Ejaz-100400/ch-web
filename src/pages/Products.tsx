import { useEffect, useState } from "react";
import { Package, Pencil, Plus, ShieldAlert, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError, type ProductInput } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import type { Product } from "../types";

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const EMPTY_FORM: ProductInput = { name: "", category: "car_glasses", active: true };

export default function Products() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.products
      .list(categoryFilter || undefined)
      .then(setProducts)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load products", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryFilter]);

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Products" title="Product catalog" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Product management requires manager or admin access</p>
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

  function openEdit(product: Product) {
    setEditing(product);
    setForm({ name: product.name, category: product.category, active: product.active });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.show("Name is required.", "error");
      return;
    }
    setSaving(true);
    const dto: ProductInput = { name: form.name.trim(), category: form.category, active: form.active };
    try {
      if (editing) {
        await api.products.update(editing.id, dto);
        toast.show("Product updated.", "success");
      } else {
        await api.products.create(dto);
        toast.show("Product added.", "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save product", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(product: Product) {
    if (!window.confirm(`Delete ${product.name}? This can't be undone.`)) return;
    setDeletingId(product.id);
    try {
      await api.products.remove(product.id);
      toast.show("Product deleted.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete product", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = products.filter((p) => {
    const q = search.trim().toLowerCase();
    return !q || p.name.toLowerCase().includes(q);
  });

  const hasActiveFilters = Boolean(search || categoryFilter);
  const isAdmin = appUser?.role === "admin";

  return (
    <div>
      <PageHeader
        eyebrow="Products"
        title="Product catalog"
        description="Services and products your team discusses with customers."
        actions={
          <button onClick={openCreate} style={primaryButtonStyle}>
            <Plus size={15} /> New product
          </button>
        }
      />

      {formOpen && (
        <ProductForm form={form} setForm={setForm} editing={Boolean(editing)} saving={saving} onSave={handleSave} onCancel={() => setFormOpen(false)} />
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
        <FilterSelect label="Category" value={categoryFilter} onChange={setCategoryFilter} options={CATEGORY_OPTIONS} />
        {hasActiveFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setCategoryFilter("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? "Loading…" : `${filtered.length} product${filtered.length === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
      <div className="table-scroll">
        <div style={{ minWidth: 560 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "2fr 1.2fr 90px 80px",
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
          <span>Name</span>
          <span>Category</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading && <SkeletonRows rows={5} />}

        {!loading &&
          filtered.map((p) => (
            <div
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 1.2fr 90px 80px",
                alignItems: "center",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-soft)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.name}</span>
              <span>
                <CategoryBadge category={p.category} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 600, color: p.active ? "var(--brand-strong)" : "var(--text-faint)" }}>
                {p.active ? "Active" : "Inactive"}
              </span>
              <span style={{ display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(p)} aria-label={`Edit ${p.name}`} title="Edit" style={iconButtonStyle}>
                  <Pencil size={14} />
                </button>
                {isAdmin && (
                  <button
                    onClick={() => handleDelete(p)}
                    disabled={deletingId === p.id}
                    aria-label={`Delete ${p.name}`}
                    title="Delete"
                    style={{ ...iconButtonStyle, color: "var(--coral)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
      </div>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <Package size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No products match this search</p>
            <p style={{ fontSize: 13 }}>Try different filters, or add a new product.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProductForm({
  form,
  setForm,
  editing,
  saving,
  onSave,
  onCancel,
}: {
  form: ProductInput;
  setForm: (updater: (f: ProductInput) => ProductInput) => void;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit product" : "New product"}</div>
        <button onClick={onCancel} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={fieldLabelStyle}>
          Name
          <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label style={fieldLabelStyle}>
          Category
          <select style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProductInput["category"] }))}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", marginBottom: 16 }}>
        <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} style={{ accentColor: "var(--brand)" }} />
        Active
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add product"}
        </button>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
} as const;

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
} as const;

const inputStyle = {
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
  fontWeight: 400,
} as const;

const primaryButtonStyle = {
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

const secondaryButtonStyle = {
  padding: "9px 15px",
  background: "var(--paper)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
} as const;

const iconButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  background: "none",
  border: "none",
  borderRadius: 6,
  color: "var(--text-soft)",
} as const;
