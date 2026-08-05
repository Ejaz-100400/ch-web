import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { PhoneCall, Glasses, Wrench, CalendarClock } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, FilterSelect } from "../components/ui/FilterBar";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatDate } from "../lib/format";
import type { CallsByPeriodPoint, FollowUpBreakdownPoint, ReportsSummary, TopCarModelPoint, TopProductPoint } from "../types";

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const FOLLOWUP_COLORS: Record<string, string> = {
  pending: "#d99a2b",
  completed: "#17967f",
  missed: "#d9503a",
};

export default function Reports() {
  const toast = useToast();
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");

  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [callsByPeriod, setCallsByPeriod] = useState<CallsByPeriodPoint[]>([]);
  const [followUpBreakdown, setFollowUpBreakdown] = useState<FollowUpBreakdownPoint[]>([]);
  const [topCarModels, setTopCarModels] = useState<TopCarModelPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    Promise.all([api.reports.summary(), api.reports.followUps(), api.reports.topCarModels(8), api.reports.topProducts(8)])
      .then(([s, f, cm, p]) => {
        if (!active) return;
        setSummary(s);
        setFollowUpBreakdown(f);
        setTopCarModels(cm);
        setTopProducts(p);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load reports", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    api.reports
      .callsByPeriod(granularity)
      .then((res) => {
        if (active) setCallsByPeriod(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load call volume", "error"));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity]);

  const volumeData = [...callsByPeriod].reverse().map((p) => ({ period: formatDate(p.period), calls: p.count }));
  const followUpData = followUpBreakdown.map((f) => ({ name: f.status, value: f.count }));
  const productData = [...topProducts].reverse().map((p) => ({ name: p.name, count: p.count }));

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title="Business performance"
        description="Enquiry volume, follow-up outcomes, and what customers are actually asking for."
      />

      <div className="grid-responsive-4" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 20 }}>
        <KpiCard icon={PhoneCall} label="Total enquiries" value={summary?.totalEnquiries ?? null} tint="var(--brand)" />
        <KpiCard icon={Glasses} label="Car Glasses" value={summary?.carGlassesEnquiries ?? null} tint="var(--brand)" />
        <KpiCard icon={Wrench} label="Car Modifications" value={summary?.carModificationEnquiries ?? null} tint="var(--violet)" />
        <KpiCard icon={CalendarClock} label="Follow-ups pending" value={summary?.followUpsPending ?? null} tint="var(--amber)" />
      </div>

      <FilterBar>
        <FilterSelect label="Granularity" value={granularity} onChange={(v) => setGranularity(v as typeof granularity)} options={GRANULARITY_OPTIONS} />
      </FilterBar>

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: 14, marginBottom: 14 }}>
        <div style={cardStyle}>
          <SectionLabel>Call volume</SectionLabel>
          {loading ? (
            <Skeleton height={220} />
          ) : volumeData.length === 0 ? (
            <EmptyChart message="No calls recorded yet." />
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={volumeData} margin={{ left: -20, right: 8, top: 8 }}>
                <defs>
                  <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#17967f" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#17967f" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#ebecf1" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                <Area type="monotone" dataKey="calls" stroke="#17967f" strokeWidth={2.5} fill="url(#volumeFill)" isAnimationActive />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <SectionLabel>Follow-up outcomes</SectionLabel>
          {loading ? (
            <Skeleton height={220} />
          ) : followUpData.every((d) => d.value === 0) ? (
            <EmptyChart message="No follow-ups yet." />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={followUpData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} isAnimationActive>
                    {followUpData.map((d) => (
                      <Cell key={d.name} fill={FOLLOWUP_COLORS[d.name] ?? "#9199a8"} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: -8 }}>
                {followUpData.map((d) => (
                  <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-soft)", textTransform: "capitalize" }}>
                    <span style={{ width: 8, height: 8, borderRadius: "50%", background: FOLLOWUP_COLORS[d.name] ?? "#9199a8" }} />
                    {d.name.replace("_", " ")}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        <div style={cardStyle}>
          <SectionLabel>Top car models mentioned</SectionLabel>
          {loading ? (
            <Skeleton height={200} />
          ) : topCarModels.length === 0 ? (
            <EmptyChart message="No car models extracted yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={topCarModels} margin={{ left: -20, right: 8, top: 8 }}>
                <CartesianGrid stroke="#ebecf1" vertical={false} />
                <XAxis dataKey="car_model" tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                <Bar dataKey="count" fill="#17967f" radius={[6, 6, 0, 0]} maxBarSize={44} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <SectionLabel>Top products discussed</SectionLabel>
          {loading ? (
            <Skeleton height={200} />
          ) : productData.length === 0 ? (
            <EmptyChart message="No products linked to calls yet." />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={productData} layout="vertical" margin={{ left: 0, right: 16, top: 8 }}>
                <CartesianGrid stroke="#ebecf1" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={130} />
                <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                <Bar dataKey="count" fill="#6a63d1" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: number | null;
  tint: string;
}) {
  return (
    <div style={cardStyle} className="fade-in-up">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <Icon size={16} color={tint} strokeWidth={2.2} />
        <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{label}</span>
      </div>
      {value === null ? <Skeleton width={60} height={26} /> : (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{value}</div>
      )}
    </div>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13 }}>
      {message}
    </div>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
      {children}
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
