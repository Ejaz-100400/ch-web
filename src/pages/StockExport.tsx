import { useEffect, useMemo, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Download, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { SuggestInput } from "../components/ui/SuggestInput";
import { api, ApiError, downloadBlob, type StockExportQuery } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { Spinner, LoadingText } from "../components/ui/Spinner";
import { formatDateTime } from "../lib/format";
import type { AuditLogEntry, Branch, Product, StockItem, StockLocation } from "../types";

type ExportFormat = "xlsx" | "pdf";

const CATEGORY_LABELS: Record<string, string> = {
  car_glasses: "Car Glasses",
  car_modifications: "Car Modifications",
};

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const ACTIVE_OPTIONS = [
  { value: "true", label: "Active only" },
  { value: "false", label: "Inactive only" },
];

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };
const LOCATION_OPTIONS = (Object.keys(LOCATION_LABELS) as StockLocation[]).map((value) => ({ value, label: LOCATION_LABELS[value] }));

const FORMATS: { value: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet, description: "One row per item, one column per branch + Warehouse" },
  { value: "pdf", label: "PDF", icon: FileText, description: "Formatted report table" },
];

function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string" && value) return [value];
  return [];
}

function summarizeFilters(filters: Record<string, unknown> | undefined, products: Product[]): string {
  if (!filters) return "All stock items";
  const parts: string[] = [];
  const categories = asArray(filters.category);
  if (categories.length) parts.push(categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" or "));
  const productIds = asArray(filters.productId);
  if (productIds.length) parts.push(productIds.map((id) => products.find((p) => p.id === id)?.name ?? "subcategory").join(", "));
  const locations = asArray(filters.location);
  if (locations.length) parts.push(locations.map((l) => LOCATION_LABELS[l as StockLocation] ?? l).join(", "));
  if (filters.active === true) parts.push("Active only");
  if (filters.active === false) parts.push("Inactive only");
  if (filters.search) parts.push(`"${filters.search}"`);
  return parts.length ? parts.join(", ") : "All stock items";
}

export default function StockExport() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState<string[]>([]);
  const [productId, setProductId] = useState<string[]>([]);
  const [location, setLocation] = useState<string[]>([]);
  const [active, setActive] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [items, setItems] = useState<StockItem[]>([]);

  useEffect(() => {
    api.products.list().then(setProducts).catch(() => setProducts([]));
    api.stock.items({}).then(setItems).catch(() => setItems([]));
    loadHistory();
  }, []);

  // Subcategory options narrow to the selected category (if any) -- a
  // product only ever belongs to one category, so showing every product
  // regardless of the category filter would offer picks that could never
  // actually match together.
  const productOptions = useMemo(
    () =>
      products
        .filter((p) => category.length === 0 || category.includes(p.category))
        .map((p) => ({ value: p.id, label: p.name })),
    [products, category],
  );

  // Suggestions for the name search -- narrowed to whatever category/
  // subcategory is already picked, same reasoning as productOptions, so
  // the dropdown only ever shows names that could actually appear together
  // with the other active filters.
  const itemNameOptions = useMemo(
    () =>
      items
        .filter((i) => category.length === 0 || category.includes(i.category))
        .filter((i) => productId.length === 0 || (i.productId && productId.includes(i.productId)))
        .map((i) => i.name),
    [items, category, productId],
  );

  function loadHistory() {
    setHistoryLoading(true);
    return api.export
      .history("stock")
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  if (!canManage(appUser?.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title="Export stock report" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Export requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  async function handleGenerate() {
    setGenerating(true);
    const q: StockExportQuery = {
      category: category.length ? (category as ("car_glasses" | "car_modifications")[]) : undefined,
      productId: productId.length ? productId : undefined,
      location: location.length ? (location as StockLocation[]) : undefined,
      active: active.length === 1 ? active[0] === "true" : undefined,
      search: search || undefined,
    };
    try {
      const blob = await api.export.stock(format, q);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `stock-export-${dateStamp}.${format}`);
      toast.show(`${format.toUpperCase()} export downloaded.`, "success");
      await loadHistory();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Export failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Stock Tracking"
        title="Export stock report"
        description="Generate an Excel or PDF report of stock on hand, broken down by branch and category -- straight from live data."
      />

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
        {/* Configuration */}
        <div style={cardStyle}>
          <SectionLabel>1. Filter which items</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            <MultiSelectFilter
              label="Category"
              values={category}
              onChange={(v) => {
                setCategory(v);
                // Drop any picked subcategory that no longer belongs to the
                // narrowed category set -- a product only has one category,
                // so a stale pick here could never actually match.
                setProductId((ids) => ids.filter((id) => v.length === 0 || products.find((p) => p.id === id && v.includes(p.category))));
              }}
              options={CATEGORY_OPTIONS}
              triggerStyle={{ width: "100%" }}
            />
            <MultiSelectFilter label="Subcategory" values={productId} onChange={setProductId} options={productOptions} triggerStyle={{ width: "100%" }} />
            <MultiSelectFilter label="Status" values={active} onChange={(v) => setActive(v.slice(-1))} options={ACTIVE_OPTIONS} triggerStyle={{ width: "100%" }} />
            <div>
              <label style={fieldLabelStyle}>Search by name</label>
              <SuggestInput value={search} onChange={setSearch} options={itemNameOptions} placeholder="e.g. 120W/4300K" style={inputStyle} />
            </div>
          </div>

          <SectionLabel>2. Which locations to include</SectionLabel>
          <div style={{ marginBottom: 22 }}>
            <MultiSelectFilter label="Branch / Warehouse" values={location} onChange={setLocation} options={LOCATION_OPTIONS} triggerStyle={{ width: "100%" }} />
            <p style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 6 }}>
              Leave empty to include every branch and the Warehouse as separate columns.
            </p>
          </div>

          <SectionLabel>3. File format</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const activeFormat = format === f.value;
              return (
                <button
                  key={f.value}
                  onClick={() => setFormat(f.value)}
                  title={f.description}
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    padding: "12px 8px",
                    border: `1px solid ${activeFormat ? "var(--brand)" : "var(--border)"}`,
                    background: activeFormat ? "var(--brand-soft)" : "var(--paper)",
                    color: activeFormat ? "var(--brand-strong)" : "var(--text-soft)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: 12.5,
                    fontWeight: 700,
                  }}
                >
                  <Icon size={18} />
                  {f.label}
                </button>
              );
            })}
          </div>

          <button
            onClick={handleGenerate}
            disabled={generating}
            style={{
              width: "100%",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              padding: "12px 16px",
              background: "var(--brand)",
              color: "var(--on-brand)",
              border: "none",
              borderRadius: "var(--radius-sm)",
              fontSize: 14,
              fontWeight: 700,
              opacity: generating ? 0.7 : 1,
            }}
          >
            {generating ? <Spinner size={16} color="var(--on-brand)" trackColor="rgba(255,255,255,0.35)" /> : <Download size={16} />}
            {generating ? "Generating…" : "Generate & download"}
          </button>
        </div>

        {/* Recent exports -- who exported what, so it's traceable across the team */}
        <div style={cardStyle}>
          <SectionLabel>Recent exports</SectionLabel>
          {historyLoading ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}><LoadingText /></p>
          ) : history.length === 0 ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No exports yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
              {history.map((h) => {
                const format = (h.details?.format as ExportFormat | undefined) ?? "xlsx";
                return (
                  <div
                    key={h.id}
                    className="fade-in-up"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      border: "1px solid var(--border-soft)",
                      borderRadius: "var(--radius-sm)",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--brand-soft)", flexShrink: 0 }}>
                      {format === "xlsx" ? <FileSpreadsheet size={16} color="var(--brand-strong)" /> : <FileText size={16} color="var(--brand-strong)" />}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                        {summarizeFilters(h.details?.filters as Record<string, unknown> | undefined, products)}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        {h.user?.name ?? "Unknown user"} · {format.toUpperCase()} · {formatDateTime(h.createdAt)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 12 }}>
      {children}
    </div>
  );
}

const cardStyle = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 20,
  boxShadow: "var(--shadow-card)",
} as const;

const fieldLabelStyle = {
  display: "block",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
  marginBottom: 5,
} as const;

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
} as const;
