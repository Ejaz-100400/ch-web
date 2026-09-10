import { useEffect, useState, type CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  Shuffle,
  Box,
  Package,
  ShieldAlert,
  Plus,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { Skeleton } from "../components/ui/Skeleton";
import { Pagination } from "../components/ui/Pagination";
import { LoadingText } from "../components/ui/Spinner";
import { api, ApiError } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatDate, formatCurrency } from "../lib/format";
import { boxColor } from "../lib/box-color";
import { listContainerVariants, listItemVariants } from "../lib/motion";
import type { Branch, StockItemDetail as StockItemDetailData, StockLocation, StockMovement } from "../types";

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};
const LOCATION_LABELS: Record<StockLocation, string> = { ...BRANCH_LABELS, warehouse: "Warehouse" };

const PAGE_SIZE = 20;

export default function StockItemDetail() {
  const { id = "" } = useParams();
  const { appUser } = useAuth();
  const toast = useToast();

  const [item, setItem] = useState<StockItemDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsLoading, setMovementsLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);

  useEffect(() => {
    setLoading(true);
    setNotFound(false);
    api.stock
      .item(id)
      .then(setItem)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) setNotFound(true);
        else toast.show(err instanceof ApiError ? err.message : "Failed to load stock item", "error");
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    let active = true;
    setMovementsLoading(true);
    api.stock
      .movements({ stockItemId: id, page, pageSize: PAGE_SIZE })
      .then((res) => {
        if (!active) return;
        setMovements(res.items);
        setTotal(res.total);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setMovementsLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id, page]);

  if (appUser && !canManage(appUser.role)) {
    return (
      <div>
        <PageHeader eyebrow="Stock Tracking" title="Stock item" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Stock tracking requires manager or admin access</p>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div>
        <BackLink />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <Package size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>This stock item no longer exists.</p>
        </div>
      </div>
    );
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const specFields = item?.attributes ? Object.entries(item.attributes).filter(([, v]) => v) : [];

  return (
    <div>
      <BackLink />

      {loading || !item ? (
        <div style={{ ...cardStyle, padding: 20 }}>
          <LoadingText />
        </div>
      ) : (
        <>
          <PageHeader
            eyebrow="Stock Tracking"
            title={item.name}
            actions={
              <Link to={`/stock/movements?item=${item.id}`} style={primaryButtonStyle}>
                <Plus size={15} /> Log movement
              </Link>
            }
          />

          {/* Catalog details */}
          <div style={{ ...cardStyle, padding: 18, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center" }}>
            <Detail label="Category">
              <CategoryBadge category={item.category} />
            </Detail>
            <Detail label="Subcategory">{item.product?.name ?? "—"}</Detail>
            <Detail label="Unit">{item.unit}</Detail>
            <Detail label="Reorder at">{item.reorderThreshold}</Detail>
            <Detail label="Price">{item.price != null ? formatCurrency(item.price) : "—"}</Detail>
            {item.boxNumber && (
              <Detail label="Warehouse box">
                {(() => {
                  const c = boxColor(item.boxNumber);
                  return (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: "2px 8px", borderRadius: 999, fontSize: 12, fontWeight: 700, color: c.fg, background: c.bg }}>
                      <Box size={11} /> {item.boxNumber}
                    </span>
                  );
                })()}
              </Detail>
            )}
            {specFields.map(([k, v]) => (
              <Detail key={k} label={k}>{v}</Detail>
            ))}
            {!item.active && <Detail label="Status">Inactive</Detail>}
          </div>

          {/* In / out totals */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 16 }}>
            <StatCard label="Total in" value={item.totals.in} tint="var(--brand-strong)" icon={ArrowDownToLine} />
            <StatCard label="Total out" value={item.totals.out} tint="var(--coral)" icon={ArrowUpFromLine} />
            <StatCard label="Net on hand" value={item.totals.net} tint="var(--text)" />
            <StatCard label="Movements" value={item.totals.movementCount} tint="var(--text-soft)" />
          </div>

          {/* On hand by location */}
          <SectionLabel>On hand by location</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 22 }}>
            {item.quantities.map((q) => (
              <div
                key={q.location}
                style={{
                  ...cardStyle,
                  padding: "12px 14px",
                  border: `1px solid ${q.lowStock ? "var(--coral)" : "var(--border)"}`,
                }}
              >
                <div style={{ fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, marginBottom: 4 }}>{LOCATION_LABELS[q.location]}</div>
                <div style={{ fontSize: 20, fontWeight: 800, color: q.lowStock ? "var(--coral)" : "var(--text)" }}>{q.quantity}</div>
                {q.lowStock && <div style={{ fontSize: 11, color: "var(--coral)", fontWeight: 700, marginTop: 2 }}>Low</div>}
              </div>
            ))}
          </div>

          {/* Movement history -- vertical timeline, styled after the call-history tracker */}
          <SectionLabel>Movement history{!movementsLoading && ` · ${total}`}</SectionLabel>
          <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 14, boxShadow: "var(--shadow-card)" }}>
            {movementsLoading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} style={{ display: "flex", gap: 12 }}>
                    <Skeleton width={12} height={12} radius={999} />
                    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                      <Skeleton width={170} height={12} />
                      <Skeleton width={110} height={10} />
                    </div>
                  </div>
                ))}
              </div>
            ) : movements.length === 0 ? (
              <div style={{ padding: "28px 8px", textAlign: "center", color: "var(--text-faint)" }}>
                <ArrowRightLeft size={20} style={{ marginBottom: 8, opacity: 0.5 }} />
                <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No movements logged for this item yet</p>
                <p style={{ fontSize: 13 }}>Its stock came in with the item and hasn't moved since.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 440, overflowY: "auto", paddingRight: 4 }}>
                <motion.div variants={listContainerVariants} initial="hidden" animate="visible" style={{ display: "flex", flexDirection: "column" }}>
                  {movements.map((m, i) => {
                    const color = movementColor(m);
                    const last = i === movements.length - 1;
                    return (
                      <motion.div key={m.id} variants={listItemVariants} style={{ display: "flex", gap: 12 }}>
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <span style={{ width: 12, height: 12, borderRadius: "50%", background: color, marginTop: 3, flexShrink: 0 }} />
                          {!last && <span style={{ width: 2, flex: 1, minHeight: 24, background: "var(--border)", marginTop: 3 }} />}
                        </div>
                        <div style={{ paddingBottom: last ? 0 : 16, minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            {typeBadge(m)}
                            <span style={{ fontSize: 13, fontWeight: 700 }}>
                              {m.quantity} {m.type === "in" ? "in" : "out"} · {LOCATION_LABELS[m.location]}
                            </span>
                          </div>
                          <div style={{ fontSize: 12.5, color: "var(--text-soft)", marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {reasonCell(m)}
                          </div>
                          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginTop: 2 }}>
                            {formatDate(m.movementDate)}
                            {m.enteredBy?.name ? ` · ${m.enteredBy.name}` : ""}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </motion.div>
              </div>
            )}
          </div>

          {!movementsLoading && totalPages > 1 && <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />}
        </>
      )}
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/stock/items" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "var(--text-soft)", marginBottom: 14 }}>
      <ArrowLeft size={15} /> Stock items
    </Link>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: "var(--text-faint)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{children}</div>
    </div>
  );
}

function StatCard({ label, value, tint, icon: Icon }: { label: string; value: number; tint: string; icon?: typeof ArrowDownToLine }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11.5, color: "var(--text-faint)", fontWeight: 600, marginBottom: 6 }}>
        {Icon && <Icon size={13} />} {label}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: tint }}>{value}</div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 10 }}>
      {children}
    </div>
  );
}

function typeBadge(m: StockMovement) {
  const base: CSSProperties = { display: "inline-flex", alignItems: "center", gap: 4, padding: "3px 8px", borderRadius: 999, fontSize: 11.5, fontWeight: 700 };
  if (m.transferId) return <span style={{ ...base, color: "var(--violet)", background: "var(--violet-soft)" }}><ArrowRightLeft size={11} /> Transfer</span>;
  if (m.swapId) return <span style={{ ...base, color: "var(--amber)", background: "var(--amber-soft)" }}><Shuffle size={11} /> Swap</span>;
  return (
    <span style={{ ...base, color: m.type === "in" ? "var(--brand-strong)" : "var(--coral)", background: m.type === "in" ? "var(--brand-soft)" : "var(--coral-soft)" }}>
      {m.type === "in" ? <ArrowDownToLine size={11} /> : <ArrowUpFromLine size={11} />} {m.type === "in" ? "In" : "Out"}
    </span>
  );
}

function movementColor(m: StockMovement): string {
  if (m.transferId) return "var(--violet)";
  if (m.swapId) return "var(--amber)";
  return m.type === "in" ? "var(--brand-strong)" : "var(--coral)";
}

function reasonCell(m: StockMovement) {
  if (m.transferId && m.relatedLocation) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--violet)", fontWeight: 600 }}>
        <ArrowRightLeft size={11} />
        {m.type === "out" ? `To ${LOCATION_LABELS[m.relatedLocation]}` : `From ${LOCATION_LABELS[m.relatedLocation]}`}
      </span>
    );
  }
  if (m.swapId && m.relatedStockItem) {
    return (
      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12.5, color: "var(--amber)", fontWeight: 600 }} title={m.relatedStockItem.name}>
        <Shuffle size={11} />
        {m.type === "out" ? `Replaces ${m.relatedStockItem.name}` : `Swapped for ${m.relatedStockItem.name}`}
      </span>
    );
  }
  return <span style={{ color: "var(--text-soft)" }}>{m.reason ?? "—"}</span>;
}

const cardStyle: CSSProperties = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
};

const primaryButtonStyle: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 15px",
  background: "var(--brand)",
  color: "var(--on-brand)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 700,
  textDecoration: "none",
};
