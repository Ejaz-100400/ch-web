import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Boxes, Package, AlertTriangle, Glasses, Wrench, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, MultiSelectFilter, ClearFiltersButton } from "../components/ui/FilterBar";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import type { Branch, StockLocation, StockOverview as StockOverviewData } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };
const LOCATION_OPTIONS = (Object.keys(LOCATION_LABELS) as StockLocation[]).map((value) => ({ value, label: LOCATION_LABELS[value] }));

const CATEGORY_LABELS: Record<string, string> = { car_glasses: "Car Glasses", car_modifications: "Car Modifications" };
const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

export default function StockOverview() {
  const { appUser } = useAuth();
  const toast = useToast();
  const [location, setLocation] = useState<string[]>([]);
  const [category, setCategory] = useState<string[]>([]);
  const [data, setData] = useState<StockOverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.stock
      .overview({ location: location.length ? (location as StockLocation[]) : undefined, category: category.length ? (category as ("car_glasses" | "car_modifications")[]) : undefined })
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load stock overview", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, category]);

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title="Stock overview" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Stock tracking requires manager or admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  const glassesTotal = data?.totalsByCategory.find((t) => t.category === "car_glasses")?.total ?? 0;
  const modsTotal = data?.totalsByCategory.find((t) => t.category === "car_modifications")?.total ?? 0;

  return (
    <div>
      <PageHeader
        eyebrow="Stock Tracking"
        title="Stock overview"
        description="Current on-hand quantities across branches, and anything that's fallen below its reorder threshold."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: 14, marginBottom: 18 }}>
        <KpiCard icon={Package} label="Active items" value={data?.totalItems} tint="var(--brand)" loading={loading} />
        <KpiCard icon={AlertTriangle} label="Low stock alerts" value={data?.lowStockCount} tint={data && data.lowStockCount > 0 ? "var(--coral)" : "var(--brand)"} loading={loading} />
        <KpiCard icon={Glasses} label="Car Glasses on hand" value={glassesTotal} tint="var(--brand)" loading={loading} />
        <KpiCard icon={Wrench} label="Car Modifications on hand" value={modsTotal} tint="var(--violet)" loading={loading} />
      </div>

      <FilterBar>
        <MultiSelectFilter label="Location" values={location} onChange={setLocation} options={LOCATION_OPTIONS} />
        <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        {(location.length > 0 || category.length > 0) && (
          <ClearFiltersButton
            onClick={() => {
              setLocation([]);
              setCategory([]);
            }}
          />
        )}
      </FilterBar>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Low stock
        </div>
        <Link to="/stock/movements" style={{ fontSize: 12.5, fontWeight: 700, color: "var(--brand-strong)", textDecoration: "none" }}>
          Log a restock →
        </Link>
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 620 }}>
            <div className="mono" style={theadStyle}>
              <span>Item</span>
              <span>Category</span>
              <span>Location</span>
              <span>On hand</span>
              <span>Threshold</span>
            </div>

            {loading && (
              <div style={{ padding: "12px 18px" }}>
                <Skeleton height={40} />
              </div>
            )}

            {!loading &&
              data?.lowStockEntries.map((e, i) => (
                <div key={`${e.stockItemId}-${e.location}`} style={trowStyle(i === data.lowStockEntries.length - 1)}>
                  <span style={{ fontWeight: 600 }}>{e.name}</span>
                  <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{CATEGORY_LABELS[e.category] ?? e.category}</span>
                  <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{LOCATION_LABELS[e.location]}</span>
                  <span className="mono" style={{ color: "var(--coral)", fontWeight: 700 }}>
                    {e.quantity} {e.unit}
                  </span>
                  <span className="mono" style={{ color: "var(--text-faint)" }}>{e.reorderThreshold}</span>
                </div>
              ))}
          </div>
        </div>

        {!loading && (!data || data.lowStockEntries.length === 0) && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <Boxes size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>Nothing running low</p>
            <p style={{ fontSize: 13 }}>Every item with a reorder threshold set is above it right now.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
  loading,
}: {
  icon: typeof Package;
  label: string;
  value: ReactNode;
  tint: string;
  loading: boolean;
}) {
  return (
    <div style={cardStyle} className="fade-in-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={tint} strokeWidth={2.2} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{label}</span>
      </div>
      {loading ? <Skeleton width={60} height={26} /> : <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{value ?? "—"}</div>}
    </div>
  );
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  padding: 18,
  boxShadow: "var(--shadow-card)",
};

const theadStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.6fr 1.2fr 1.2fr 100px 100px",
  padding: "10px 18px",
  fontSize: 11,
  fontFamily: "var(--font-body)",
  fontWeight: 700,
  color: "var(--text-faint)",
  textTransform: "uppercase",
  letterSpacing: "0.04em",
  borderBottom: "1px solid var(--border-soft)",
};

function trowStyle(isLast: boolean): CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: "1.6fr 1.2fr 1.2fr 100px 100px",
    alignItems: "center",
    padding: "12px 18px",
    borderBottom: isLast ? "none" : "1px solid var(--border-soft)",
    fontSize: 13,
  };
}
