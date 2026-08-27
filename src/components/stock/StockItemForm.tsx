import { useMemo, useState, type CSSProperties } from "react";
import { X, Box } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../ui/Toast";
import { variantFieldsForProduct } from "../../lib/stock-variant-fields";
import type { Branch, Product, StockItem, StockLocation } from "../../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const ALL_BRANCHES = Object.keys(BRANCH_LABELS) as Branch[];
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };
const ALL_LOCATIONS = Object.keys(LOCATION_LABELS) as StockLocation[];

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const NO_SUBCATEGORY = "__none__";

interface ItemFormState {
  category: "car_glasses" | "car_modifications";
  productChoice: string; // a Product id, NO_SUBCATEGORY, or "" (nothing picked yet)
  name: string;
  unit: string;
  reorderThreshold: number;
  active: boolean;
  storageType: "branch" | "warehouse";
  startingBranch: Branch;
  startingQuantity: string;
  boxNumber: string;
  price: string;
  attributes: Record<string, string>;
  addStockLocation: StockLocation;
  addStockQuantity: string;
}

function emptyForm(defaultLocation?: StockLocation): ItemFormState {
  const startsAtWarehouse = defaultLocation === "warehouse";
  return {
    category: "car_glasses",
    productChoice: "",
    name: "",
    unit: "pcs",
    reorderThreshold: 0,
    active: true,
    storageType: startsAtWarehouse ? "warehouse" : "branch",
    startingBranch: defaultLocation && !startsAtWarehouse ? defaultLocation : "ambattur",
    startingQuantity: "",
    boxNumber: "",
    price: "",
    attributes: {},
    addStockLocation: defaultLocation ?? "ambattur",
    addStockQuantity: "",
  };
}

/**
 * The add/edit stock item form, shared between the full catalog page
 * (Stock Items) and a single location's page (Stock Items -> a branch or
 * the Warehouse) -- the latter passes defaultLocation so "starting stock"
 * defaults to wherever the user already is instead of always Ambattur.
 */
export function StockItemForm({
  editing,
  products,
  defaultLocation,
  onClose,
  onSaved,
}: {
  editing: StockItem | null;
  products: Product[];
  defaultLocation?: StockLocation;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [form, setForm] = useState<ItemFormState>(() =>
    editing
      ? {
          category: editing.category,
          productChoice: editing.productId ?? NO_SUBCATEGORY,
          name: editing.name,
          unit: editing.unit,
          reorderThreshold: editing.reorderThreshold,
          active: editing.active,
          storageType: "branch",
          startingBranch: "ambattur",
          startingQuantity: "",
          boxNumber: editing.boxNumber ?? "",
          price: editing.price != null ? String(editing.price) : "",
          attributes: editing.attributes ?? {},
          addStockLocation: defaultLocation ?? "ambattur",
          addStockQuantity: "",
        }
      : emptyForm(defaultLocation),
  );
  const [saving, setSaving] = useState(false);

  // What you're actually allowed to pick as a stock item's identity: real,
  // active, sellable products -- not a service like Doom cleaning, which
  // has nothing to hold in stock. Narrowed further to the chosen category.
  const pickableProducts = useMemo(
    () => products.filter((p) => p.active && p.category === form.category && !p.name.toLowerCase().includes("doom")),
    [products, form.category],
  );

  const selectedProductName = useMemo(() => products.find((p) => p.id === form.productChoice)?.name, [products, form.productChoice]);
  const variantFields = variantFieldsForProduct(selectedProductName);

  // Box number only makes sense for Warehouse items -- hide it when we know
  // for certain we're editing from a specific branch's page. Still shown
  // when opened from the main Stock Items catalog (no location context) or
  // from the Warehouse page itself.
  const showBoxNumberField = !defaultLocation || defaultLocation === "warehouse";

  function selectProduct(productId: string) {
    // Reset spec fields on a subcategory change -- carrying over e.g. an
    // LED item's "Watts" value onto a newly-picked 5D Ring would just be
    // stale, invisible data sitting in the record.
    setForm((f) => ({ ...f, productChoice: productId, attributes: {} }));
  }

  async function handleSave() {
    if (!form.productChoice) {
      toast.show("Pick a subcategory, or choose “No subcategory”.", "error");
      return;
    }
    if (!form.name.trim()) {
      toast.show("Product name is required.", "error");
      return;
    }

    const startingQty = Number(form.startingQuantity);
    const initialStock =
      !editing && startingQty > 0
        ? [{ location: form.storageType === "warehouse" ? ("warehouse" as const) : form.startingBranch, quantity: startingQty }]
        : undefined;

    const trimmedAddQty = form.addStockQuantity.trim();
    if (trimmedAddQty && (!Number.isFinite(Number(trimmedAddQty)) || Number(trimmedAddQty) <= 0)) {
      toast.show("Add stock quantity must be a positive number.", "error");
      return;
    }

    const trimmedPrice = form.price.trim();
    const dto = {
      productId: form.productChoice === NO_SUBCATEGORY ? undefined : form.productChoice,
      name: form.name.trim(),
      category: form.category,
      unit: form.unit?.trim() || "pcs",
      reorderThreshold: form.reorderThreshold ?? 0,
      active: form.active,
      // Always sent (even empty/null) so clearing an existing value on edit
      // actually reaches the server -- omitting the key would just leave
      // the old value untouched instead of clearing it.
      boxNumber: form.boxNumber.trim(),
      price: trimmedPrice ? Number(trimmedPrice) : null,
      attributes: Object.fromEntries(Object.entries(form.attributes).filter(([, v]) => v.trim())),
      initialStock,
      addStock: editing && trimmedAddQty ? { location: form.addStockLocation, quantity: Number(trimmedAddQty) } : undefined,
    };

    setSaving(true);
    try {
      if (editing) {
        await api.stock.updateItem(editing.id, dto);
        toast.show(dto.addStock ? `Stock item updated -- added ${dto.addStock.quantity} to ${LOCATION_LABELS[dto.addStock.location]}.` : "Stock item updated.", "success");
      } else {
        await api.stock.createItem(dto);
        toast.show("Stock item added.", "success");
      }
      onSaved();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save stock item", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit stock item" : "New stock item"}</div>
        <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1.4fr", gap: 12, marginBottom: 12 }}>
        <label style={fieldLabelStyle}>
          Product category
          <select
            style={inputStyle}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ItemFormState["category"], productChoice: "", attributes: {} }))}
          >
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </label>
        <label style={fieldLabelStyle}>
          Product subcategory
          <select style={inputStyle} value={form.productChoice} onChange={(e) => selectProduct(e.target.value)}>
            <option value="" disabled>Choose from your Products catalog…</option>
            {pickableProducts.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {editing?.productId && !pickableProducts.some((p) => p.id === editing.productId) && (
              <option value={editing.productId}>{editing.name} (no longer in catalog list)</option>
            )}
            <option value={NO_SUBCATEGORY}>No subcategory</option>
          </select>
        </label>
      </div>

      <label style={{ ...fieldLabelStyle, marginBottom: 12 }}>
        Product name
        <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Amy Tricolor Fog" />
      </label>

      {variantFields && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 8 }}>
            {selectedProductName} spec <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: `repeat(${variantFields.length}, 1fr)`, gap: 12 }}>
            {variantFields.map((field) => (
              <label key={field.key} style={fieldLabelStyle}>
                {field.label}
                <input
                  style={inputStyle}
                  value={form.attributes[field.key] ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, attributes: { ...f.attributes, [field.key]: e.target.value } }))}
                  placeholder={field.placeholder}
                />
              </label>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
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
        <label style={fieldLabelStyle}>
          Price <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
          <input
            type="number"
            min={0}
            step="0.01"
            style={inputStyle}
            value={form.price}
            onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
            placeholder="e.g. 850"
          />
        </label>
      </div>

      {!editing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 8 }}>
            Starting stock <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional -- leave blank if you don't have any yet)</span>
          </div>
          <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
            {(["branch", "warehouse"] as const).map((t) => {
              const active = form.storageType === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, storageType: t }))}
                  style={{
                    padding: "7px 14px",
                    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                    borderRadius: "var(--radius-sm)",
                    background: active ? "var(--brand-soft)" : "var(--paper)",
                    color: active ? "var(--brand-strong)" : "var(--text-soft)",
                    fontSize: 13,
                    fontWeight: active ? 700 : 600,
                  }}
                >
                  {t === "branch" ? "Branch" : "Warehouse"}
                </button>
              );
            })}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {form.storageType === "branch" && (
              <label style={fieldLabelStyle}>
                Branch
                <select style={inputStyle} value={form.startingBranch} onChange={(e) => setForm((f) => ({ ...f, startingBranch: e.target.value as Branch }))}>
                  {ALL_BRANCHES.map((b) => (
                    <option key={b} value={b}>{BRANCH_LABELS[b]}</option>
                  ))}
                </select>
              </label>
            )}
            <label style={fieldLabelStyle}>
              Quantity
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={form.startingQuantity}
                onChange={(e) => setForm((f) => ({ ...f, startingQuantity: e.target.value }))}
                placeholder="0"
              />
            </label>
            {form.storageType === "warehouse" && (
              <label style={fieldLabelStyle}>
                Box number <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional)</span>
                <input
                  style={inputStyle}
                  value={form.boxNumber}
                  onChange={(e) => setForm((f) => ({ ...f, boxNumber: e.target.value }))}
                  placeholder="e.g. Box 5"
                />
              </label>
            )}
          </div>
        </div>
      )}

      {editing && showBoxNumberField && (
        <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <Box size={12} /> Warehouse box number <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional -- only relevant if you keep this item in the Warehouse)</span>
          </span>
          <input
            style={inputStyle}
            value={form.boxNumber}
            onChange={(e) => setForm((f) => ({ ...f, boxNumber: e.target.value }))}
            placeholder="e.g. Box 5"
          />
        </label>
      )}

      {editing && (
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 8 }}>
            Add stock <span style={{ fontWeight: 400, color: "var(--text-faint)" }}>(optional -- adds to whatever's already there; this is the only way to add more Warehouse stock)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <label style={fieldLabelStyle}>
              Location
              <select style={inputStyle} value={form.addStockLocation} onChange={(e) => setForm((f) => ({ ...f, addStockLocation: e.target.value as StockLocation }))}>
                {ALL_LOCATIONS.map((l) => (
                  <option key={l} value={l}>{LOCATION_LABELS[l]}</option>
                ))}
              </select>
            </label>
            <label style={fieldLabelStyle}>
              Quantity
              <input
                type="number"
                min={0}
                style={inputStyle}
                value={form.addStockQuantity}
                onChange={(e) => setForm((f) => ({ ...f, addStockQuantity: e.target.value }))}
                placeholder="0"
              />
            </label>
          </div>
        </div>
      )}

      {editing && (
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", marginBottom: 16 }}>
          <input type="checkbox" checked={form.active} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} style={{ accentColor: "var(--brand)" }} />
          Active
        </label>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add item"}
        </button>
        <button onClick={onClose} style={secondaryButtonStyle}>
          Cancel
        </button>
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
