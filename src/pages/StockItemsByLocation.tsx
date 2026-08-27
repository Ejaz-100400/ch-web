import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowLeftRight, Package, ShieldAlert, Box } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import { boxColor } from "../lib/box-color";
import type { Branch, Product, StockItem, StockLocation } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };
const VALID_LOCATIONS = Object.keys(LOCATION_LABELS) as StockLocation[];

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const NO_SUBCATEGORY = "__none__";

export default function StockItemsByLocation() {
  const { location: locationParam } = useParams<{ location: string }>();
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string[]>([]);
  const [subcategory, setSubcategory] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<StockItem[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const location = (VALID_LOCATIONS as string[]).includes(locationParam ?? "") ? (locationParam as StockLocation) : null;

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

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  // The subcategory chip row -- every catalog product with at least one
  // stock item linked to it, plus a bucket for items with no link at all.
  const productNameById = useMemo(() => new Map(products.map((p) => [p.id, p.name])), [products]);
  const subcategoryChips = useMemo(() => {
    const seen = new Map<string, string>();
    let hasUnlinked = false;
    for (const item of items) {
      if (item.productId) seen.set(item.productId, productNameById.get(item.productId) ?? item.name);
      else hasUnlinked = true;
    }
    const chips = [...seen.entries()].map(([id, name]) => ({ value: id, label: name })).sort((a, b) => a.label.localeCompare(b.label));
    if (hasUnlinked) chips.push({ value: NO_SUBCATEGORY, label: "No subcategory" });
    return chips;
  }, [items, productNameById]);

  const filteredItems = useMemo(() => {
    if (!subcategory) return items;
    if (subcategory === NO_SUBCATEGORY) return items.filter((i) => !i.productId);
    return items.filter((i) => i.productId === subcategory);
  }, [items, subcategory]);

  if (!location) return <Navigate to="/stock/items" replace />;

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title={LOCATION_LABELS[location]} />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Stock tracking requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  const hasFilters = Boolean(search || category.length || subcategory);

  return (
    <div>
      <Link to="/stock/items" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, fontWeight: 700, color: "var(--text-soft)", textDecoration: "none", marginBottom: 10 }}>
        <ArrowLeft size={13} /> All locations
      </Link>
      <PageHeader
        eyebrow="Stock Tracking"
        title={LOCATION_LABELS[location]}
        description={`Everything you're tracking, and how much is on hand at ${LOCATION_LABELS[location]}.`}
      />

      {subcategoryChips.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 18 }}>
          <button onClick={() => setSubcategory("")} style={chipStyle(subcategory === "")}>
            All
          </button>
          {subcategoryChips.map((c) => (
            <button key={c.value} onClick={() => setSubcategory(c.value)} style={chipStyle(subcategory === c.value)}>
              {c.label}
            </button>
          ))}
        </div>
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name" />
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        {hasFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setCategory([]);
              setSubcategory("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${filteredItems.length} item${filteredItems.length === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: location === "warehouse" ? 740 : 640 }}>
            <div className="mono" style={theadStyle(location)}>
              <span>Name</span>
              {location === "warehouse" && <span>Box</span>}
              <span>Category</span>
              <span>On hand</span>
              <span>Reorder at</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={5} />}

            {!loading && (
              <motion.div variants={listContainerVariants} initial="hidden" animate="visible">
                <AnimatePresence initial={false}>
                  {filteredItems.map((item) => {
                    const q = item.quantities.find((x) => x.location === location);
                    return (
                      <motion.div key={item.id} layout="position" variants={listItemVariants} exit="exit" style={trowStyle(location)}>
                        <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: item.active ? 1 : 0.5 }}>
                          {item.name}
                          {!item.active && <span style={{ fontWeight: 400, color: "var(--text-faint)", fontSize: 11 }}> (inactive)</span>}
                        </span>
                        {location === "warehouse" && (
                          <span>
                            {item.boxNumber ? (
                              (() => {
                                const c = boxColor(item.boxNumber);
                                return (
                                  <span
                                    style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 7px", borderRadius: 999, fontSize: 11, fontWeight: 700, color: c.fg, background: c.bg }}
                                  >
                                    <Box size={10} /> {item.boxNumber}
                                  </span>
                                );
                              })()
                            ) : (
                              <span style={{ color: "var(--text-faint)", fontSize: 12 }}>—</span>
                            )}
                          </span>
                        )}
                        <span><CategoryBadge category={item.category} /></span>
                        <span className="mono" style={{ fontWeight: q?.lowStock ? 700 : 400, color: q?.lowStock ? "var(--coral)" : "var(--text)" }}>
                          {q?.quantity ?? 0} {item.unit}
                        </span>
                        <span className="mono" style={{ color: "var(--text-faint)" }}>{item.reorderThreshold}</span>
                        <span>
                          <Link
                            to={`/stock/movements?item=${item.id}&location=${location}`}
                            aria-label={`Log movement for ${item.name}`}
                            title="Log movement"
                            style={iconButtonStyle}
                          >
                            <ArrowLeftRight size={14} />
                          </Link>
                        </span>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </motion.div>
            )}
          </div>
        </div>

        {!loading && filteredItems.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <Package size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>Nothing matches here</p>
            <p style={{ fontSize: 13 }}>Try a different subcategory or filter, or add items from the main Stock Items page.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function chipStyle(active: boolean): CSSProperties {
  return {
    padding: "7px 14px",
    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
    borderRadius: 999,
    background: active ? "var(--brand-soft)" : "var(--paper-raised)",
    color: active ? "var(--brand-strong)" : "var(--text-soft)",
    fontSize: 12.5,
    fontWeight: active ? 700 : 600,
  };
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

function gridColumns(location: StockLocation | null): string {
  return location === "warehouse" ? "1.6fr 0.9fr 1.1fr 0.9fr 0.9fr 80px" : "1.8fr 1.2fr 1fr 0.9fr 80px";
}

function theadStyle(location: StockLocation | null): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: gridColumns(location),
    padding: "10px 18px",
    fontSize: 11,
    fontFamily: "var(--font-body)",
    fontWeight: 700,
    color: "var(--text-faint)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    borderBottom: "1px solid var(--border-soft)",
  };
}

function trowStyle(location: StockLocation | null): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: gridColumns(location),
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: "1px solid var(--border-soft)",
    fontSize: 13,
  };
}

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
