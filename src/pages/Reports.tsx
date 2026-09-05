import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  BarChart,
  Bar,
  LabelList,
  PieChart,
  Pie,
  Cell,
  ReferenceDot,
} from "recharts";
import { PhoneCall, Glasses, Wrench, CalendarClock, SlidersHorizontal, Timer, Smile, AlertTriangle, HelpCircle, Users, Repeat2, Eye, EyeOff, CheckCircle2, PhoneMissed, Handshake } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { Skeleton } from "../components/ui/Skeleton";
import { CalendarTab } from "./reports/CalendarTab";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatCurrency, formatDate, formatDuration } from "../lib/format";
import { useVehicleFilters } from "../lib/useVehicleFilters";
import type {
  Branch,
  BranchBreakdownPoint,
  CallsByPeriodPoint,
  CustomerCallHistoryRow,
  CustomersByPeriodPoint,
  Employee,
  FollowUpBreakdownPoint,
  Paginated,
  Product,
  ReportsSummary,
  SentimentBreakdownPoint,
  SentimentType,
  TopCarMakePoint,
  TopCarModelPoint,
  TopEmployeePoint,
  TopProductPoint,
} from "../types";

const GRANULARITY_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
];

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const BRANCH_LABELS: Record<Branch, string> = {
  ambattur: "Ambattur (HQ)",
  kattankulathur: "Kattankulathur",
  sithalapakkam: "Sithalapakkam",
  pondicherry: "Pondicherry",
};

const BRANCH_OPTIONS = (Object.keys(BRANCH_LABELS) as Branch[]).map((value) => ({ value, label: BRANCH_LABELS[value] }));

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const SENTIMENT_OPTIONS = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

const FOLLOWUP_COLORS: Record<string, string> = {
  pending: "#d99a2b",
  completed: "#17967f",
  missed: "#d9503a",
};

const SENTIMENT_COLORS: Record<string, string> = {
  interested: "#17967f",
  not_interested: "#d9503a",
  needs_follow_up: "#d99a2b",
  unknown: "#9199a8",
};

const EMPLOYEE_SENTIMENT_LEGEND = [
  { key: "interested", label: "Interested", color: SENTIMENT_COLORS.interested },
  { key: "needs_follow_up", label: "Needs follow-up", color: SENTIMENT_COLORS.needs_follow_up },
  { key: "not_interested", label: "Not interested", color: SENTIMENT_COLORS.not_interested },
  { key: "unknown", label: "Not yet extracted", color: SENTIMENT_COLORS.unknown },
];

export default function Reports() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<"performance" | "calendar">("performance");
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [category, setCategory] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string[]>([]);
  const [branch, setBranch] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset: resetVehicleFilters } = useVehicleFilters();
  const [sentiment, setSentiment] = useState<string[]>([]);
  const [productId, setProductId] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [callsByPeriod, setCallsByPeriod] = useState<CallsByPeriodPoint[]>([]);
  const [customersByPeriod, setCustomersByPeriod] = useState<CustomersByPeriodPoint[]>([]);
  const [followUpBreakdown, setFollowUpBreakdown] = useState<FollowUpBreakdownPoint[]>([]);
  const [sentimentBreakdown, setSentimentBreakdown] = useState<SentimentBreakdownPoint[]>([]);
  const [topCarModels, setTopCarModels] = useState<TopCarModelPoint[]>([]);
  const [topCarMakes, setTopCarMakes] = useState<TopCarMakePoint[]>([]);
  const [carVizMode, setCarVizMode] = useState<"model" | "make">("model");
  const [topProducts, setTopProducts] = useState<TopProductPoint[]>([]);
  const [topEmployees, setTopEmployees] = useState<TopEmployeePoint[]>([]);
  const [branchBreakdown, setBranchBreakdown] = useState<BranchBreakdownPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerHistory, setCustomerHistory] = useState<Paginated<CustomerCallHistoryRow> | null>(null);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(true);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const CUSTOMER_HISTORY_PAGE_SIZE = 10;

  const filters = useMemo(
    () => ({
      category: category.length ? category : undefined,
      employeeId: employeeId.length ? employeeId : undefined,
      branch: branch.length ? branch : undefined,
      status: status.length ? status : undefined,
      carMake: carMake.length ? carMake : undefined,
      carModel: carModel.length ? carModel : undefined,
      sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
      productId: productId.length ? productId : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [category, employeeId, branch, status, carMake, carModel, sentiment, productId, dateFrom, dateTo],
  );

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
    api.products.list().then(setProducts).catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([
      api.reports.summary(filters),
      api.reports.callsByPeriod(granularity, filters),
      api.reports.customersByPeriod(granularity, filters),
      api.reports.followUps(filters),
      api.reports.sentiment(filters),
      api.reports.topCarModels(10, filters),
      api.reports.topCarMakes(10, filters),
      api.reports.topProducts(10, filters),
      api.reports.topEmployees(8, filters),
      api.reports.branches(filters),
    ])
      .then(([s, cbp, custp, f, sent, cm, ck, p, emp, br]) => {
        if (!active) return;
        setSummary(s);
        setCallsByPeriod(cbp);
        setCustomersByPeriod(custp);
        setFollowUpBreakdown(f);
        setSentimentBreakdown(sent);
        setTopCarModels(cm);
        setTopCarMakes(ck);
        setTopProducts(p);
        setTopEmployees(emp);
        setBranchBreakdown(br);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load reports", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [granularity, filters]);

  // A filter change invalidates whatever page of the customer table was
  // showing -- page 1 of the new filtered set is the only one guaranteed to
  // still make sense.
  useEffect(() => {
    setCustomerHistoryPage(1);
  }, [filters]);

  useEffect(() => {
    let active = true;
    setCustomerHistoryLoading(true);
    api.reports
      .customerCallHistory(customerHistoryPage, CUSTOMER_HISTORY_PAGE_SIZE, filters)
      .then((res) => {
        if (active) setCustomerHistory(res);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load customer call history", "error");
      })
      .finally(() => {
        if (active) setCustomerHistoryLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, customerHistoryPage]);

  const volumeData = [...callsByPeriod]
    .reverse()
    .map((p) => ({ period: formatDate(p.period), glasses: p.carGlasses, modifications: p.carModifications }));
  const customerVolumeData = [...customersByPeriod].reverse().map((p) => ({ period: formatDate(p.period), customers: p.count }));
  const followUpData = followUpBreakdown.map((f) => ({ name: f.status, value: f.count }));
  const sentimentData = sentimentBreakdown.map((s) => ({ name: s.sentiment, value: s.count }));
  // Backend already returns these highest-first -- don't reverse, or the
  // tallest bar ends up at the bottom instead of the top.
  const productData = topProducts.map((p) => ({ name: p.name, count: p.count }));
  const carModelData = topCarModels.map((c) => ({ name: c.car_model, count: c.count }));
  const carMakeData = topCarMakes.map((c) => ({ name: c.car_make, count: c.count }));
  const carVizData = carVizMode === "model" ? carModelData : carMakeData;
  const employeeData = topEmployees.map((e) => ({
    name: e.name,
    count: e.count,
    interested: e.interested,
    needs_follow_up: e.needsFollowUp,
    not_interested: e.notInterested,
    unknown: e.unknown,
  }));
  const branchData = branchBreakdown.map((b) => ({ name: BRANCH_LABELS[b.branch], count: b.count }));

  const hasActiveFilters = Boolean(
    category.length ||
      employeeId.length ||
      branch.length ||
      status.length ||
      carMake.length ||
      carModel.length ||
      sentiment.length ||
      productId.length ||
      dateFrom ||
      dateTo,
  );
  function clearFilters() {
    setCategory([]);
    setEmployeeId([]);
    setBranch([]);
    setStatus([]);
    resetVehicleFilters();
    setSentiment([]);
    setProductId([]);
    setDateFrom("");
    setDateTo("");
  }

  return (
    <div>
      <PageHeader
        eyebrow="Reports"
        title={activeTab === "performance" ? "Business performance" : "Calendar"}
        description={
          activeTab === "performance"
            ? "Enquiry volume, follow-up outcomes, and what customers are actually asking for."
            : "Call volume by day, at a glance."
        }
        actions={
          <button
            onClick={() => setFiltersVisible((v) => !v)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "9px 15px",
              background: filtersVisible ? "var(--brand)" : "var(--paper-raised)",
              color: filtersVisible ? "var(--on-brand)" : "var(--text)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-sm)",
              fontSize: 13.5,
              fontWeight: 700,
              transition: "background 120ms ease, color 120ms ease",
            }}
          >
            {filtersVisible ? <EyeOff size={15} /> : <Eye size={15} />}
            {filtersVisible ? "Hide filters" : "Show filters"}
          </button>
        }
      />

      <div style={{ display: "flex", gap: 4, borderBottom: "1px solid var(--border)", marginBottom: 18 }}>
        {(["performance", "calendar"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 16px",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${activeTab === tab ? "var(--brand)" : "transparent"}`,
              fontSize: 13.5,
              fontWeight: activeTab === tab ? 700 : 600,
              color: activeTab === tab ? "var(--text)" : "var(--text-soft)",
              cursor: "pointer",
            }}
          >
            {tab === "performance" ? "Business performance" : "Calendar"}
          </button>
        ))}
      </div>

      <div className="reports-layout" style={{ display: "grid", gridTemplateColumns: filtersVisible ? "1fr 260px" : "1fr", gap: 20, alignItems: "start" }}>
        {activeTab === "performance" ? (
        <div style={{ minWidth: 0 }}>
          {/* Left-to-right, top-to-bottom = business priority: overall volume
              and reach first, then what's being called about, then how
              likely it is to turn into revenue, then follow-up execution,
              then call efficiency last. */}
          <div className="grid-responsive-4" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 14 }}>
            <KpiCard icon={PhoneCall} label="Total calls" value={summary?.totalCalls} tint="var(--brand)" loading={loading} />
            <KpiCard icon={Users} label="Total customers" value={summary?.totalCustomers} tint="var(--violet)" loading={loading} />
            <KpiCard icon={Repeat2} label="Returning customers" value={summary?.returningCustomers} tint="var(--violet)" loading={loading} />
            <KpiCard icon={Glasses} label="Car Glasses" value={summary?.carGlassesEnquiries} tint="var(--brand)" loading={loading} />
            <KpiCard icon={Wrench} label="Car Modifications" value={summary?.carModificationEnquiries} tint="var(--violet)" loading={loading} />
            <KpiCard icon={HelpCircle} label="Unknown category" value={summary?.unknownCategoryEnquiries} tint="var(--text-faint)" loading={loading} />
            <KpiCard
              icon={Smile}
              label="Interested rate"
              value={summary?.interestedRate != null ? `${summary.interestedRate}%` : "—"}
              tint="var(--brand)"
              loading={loading}
            />
            <KpiCard
              icon={Handshake}
              label="Call → Sale rate"
              value={summary?.callToSaleRate != null ? `${summary.callToSaleRate}%` : "—"}
              tint="var(--brand)"
              loading={loading}
            />
            <KpiCard icon={CalendarClock} label="Follow-ups pending" value={summary?.followUpsPending} tint="var(--amber)" loading={loading} />
            <KpiCard
              icon={AlertTriangle}
              label="Follow-ups overdue"
              value={summary?.followUpsOverdue}
              tint="var(--coral)"
              loading={loading}
            />
            <KpiCard
              icon={CheckCircle2}
              label="Follow-up completion rate"
              value={summary?.followUpCompletionRate != null ? `${summary.followUpCompletionRate}%` : "—"}
              tint="var(--brand)"
              loading={loading}
            />
            <KpiCard icon={CheckCircle2} label="Follow-ups completed" value={summary?.followUpsCompleted} tint="var(--brand)" loading={loading} />
            <KpiCard icon={PhoneMissed} label="Follow-ups missed" value={summary?.followUpsMissed} tint="var(--coral)" loading={loading} />
            <KpiCard
              icon={Timer}
              label="Avg. call duration"
              value={summary?.avgCallDurationSeconds != null ? formatDuration(summary.avgCallDurationSeconds) : "—"}
              tint="var(--violet)"
              loading={loading}
            />
          </div>

          <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={cardStyle}>
              <SectionLabel>Call volume</SectionLabel>
              {loading ? (
                <Skeleton height={220} />
              ) : volumeData.length === 0 ? (
                <EmptyChart message="No calls match these filters." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={volumeData} margin={{ left: -20, right: 8, top: 8 }}>
                      <defs>
                        <linearGradient id="volumeFillGlasses" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#17967f" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#17967f" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="volumeFillMods" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#6a63d1" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#6a63d1" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                      <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                      <Area type="monotone" name="Glasses" dataKey="glasses" stroke="#17967f" strokeWidth={2.5} fill="url(#volumeFillGlasses)" isAnimationActive />
                      <Area type="monotone" name="Modifications" dataKey="modifications" stroke="#6a63d1" strokeWidth={2.5} fill="url(#volumeFillMods)" isAnimationActive />
                      <MaxMinDots data={volumeData} dataKey="glasses" color="#17967f" />
                      <MaxMinDots data={volumeData} dataKey="modifications" color="#6a63d1" />
                    </AreaChart>
                  </ResponsiveContainer>
                  <Legend
                    items={[
                      { key: "glasses", label: "Glasses", color: "#17967f" },
                      { key: "modifications", label: "Modifications", color: "#6a63d1" },
                    ]}
                  />
                </>
              )}
            </div>

            <div style={cardStyle}>
              <SectionLabel>Customer volume</SectionLabel>
              {loading ? (
                <Skeleton height={220} />
              ) : customerVolumeData.length === 0 ? (
                <EmptyChart message="No customers match these filters." />
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={customerVolumeData} margin={{ left: -20, right: 8, top: 8 }}>
                    <XAxis dataKey="period" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                    <Line
                      type="monotone"
                      dataKey="customers"
                      stroke="#d99a2b"
                      strokeWidth={2.5}
                      strokeDasharray="6 4"
                      dot={{ r: 3, fill: "#d99a2b", strokeWidth: 0 }}
                      isAnimationActive
                    />
                    <MaxMinDots data={customerVolumeData} dataKey="customers" color="#d99a2b" />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
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
                  <Legend items={followUpData.map((d) => ({ key: d.name, label: d.name.replace("_", " "), color: FOLLOWUP_COLORS[d.name] ?? "#9199a8" }))} />
                </>
              )}
            </div>

            <div style={cardStyle}>
              <SectionLabel>Sentiment breakdown</SectionLabel>
              {loading ? (
                <Skeleton height={220} />
              ) : sentimentData.every((d) => d.value === 0) ? (
                <EmptyChart message="No sentiment extracted yet." />
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={sentimentData} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={3} isAnimationActive>
                        {sentimentData.map((d) => (
                          <Cell key={d.name} fill={SENTIMENT_COLORS[d.name] ?? "#9199a8"} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <Legend items={sentimentData.map((d) => ({ key: d.name, label: d.name.replace("_", " "), color: SENTIMENT_COLORS[d.name] ?? "#9199a8" }))} />
                </>
              )}
            </div>
          </div>

          <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 14 }}>
            <div style={cardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, gap: 10 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Top car {carVizMode === "model" ? "models" : "makes"} mentioned
                </div>
                <div style={{ display: "flex", background: "var(--paper)", border: "1px solid var(--border)", borderRadius: 999, padding: 2, gap: 2, flexShrink: 0 }}>
                  {(["model", "make"] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setCarVizMode(mode)}
                      style={{
                        padding: "4px 11px",
                        border: "none",
                        borderRadius: 999,
                        fontSize: 11.5,
                        fontWeight: 700,
                        textTransform: "capitalize",
                        background: carVizMode === mode ? "var(--brand)" : "transparent",
                        color: carVizMode === mode ? "var(--on-brand)" : "var(--text-soft)",
                        transition: "background 120ms ease, color 120ms ease",
                      }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              {loading ? (
                <Skeleton height={240} />
              ) : carVizData.length === 0 ? (
                <EmptyChart message={`No car ${carVizMode === "model" ? "models" : "makes"} extracted yet.`} />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, carVizData.length * 30)}>
                  <BarChart data={carVizData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                    <YAxis type="category" dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={90} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                    <Bar dataKey="count" fill="#17967f" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive>
                      <LabelList dataKey="count" position="right" fontSize={11} fill="#5b6270" fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            <div style={cardStyle}>
              <SectionLabel>Top products discussed</SectionLabel>
              {loading ? (
                <Skeleton height={240} />
              ) : productData.length === 0 ? (
                <EmptyChart message="No products linked to calls yet." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, productData.length * 30)}>
                  <BarChart data={productData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                    <YAxis type="category" dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={140} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                    <Bar dataKey="count" fill="#6a63d1" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive>
                      <LabelList dataKey="count" position="right" fontSize={11} fill="#5b6270" fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div style={{ ...cardStyle, marginBottom: 14 }}>
            <SectionLabel>Top employees by enquiries</SectionLabel>
            {loading ? (
              <Skeleton height={220} />
            ) : employeeData.length === 0 ? (
              <EmptyChart message="No calls assigned to an employee yet." />
            ) : (
              <>
                <ResponsiveContainer width="100%" height={Math.max(220, employeeData.length * 32)}>
                  <BarChart data={employeeData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
                    <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                    <YAxis type="category" dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={130} />
                    <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} formatter={(value, key) => [value, EMPLOYEE_SENTIMENT_LEGEND.find((s) => s.key === key)?.label ?? String(key)]} />
                    <Bar dataKey="interested" stackId="sentiment" fill={SENTIMENT_COLORS.interested} maxBarSize={18} isAnimationActive />
                    <Bar dataKey="needs_follow_up" stackId="sentiment" fill={SENTIMENT_COLORS.needs_follow_up} maxBarSize={18} isAnimationActive />
                    <Bar dataKey="not_interested" stackId="sentiment" fill={SENTIMENT_COLORS.not_interested} maxBarSize={18} isAnimationActive />
                    <Bar dataKey="unknown" stackId="sentiment" fill={SENTIMENT_COLORS.unknown} radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive>
                      <LabelList dataKey="count" position="right" fontSize={11} fill="#5b6270" fontWeight={700} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <Legend items={EMPLOYEE_SENTIMENT_LEGEND} />
              </>
            )}
          </div>

          <div style={{ ...cardStyle, marginTop: 14 }}>
            <SectionLabel>Calls by branch</SectionLabel>
            {loading ? (
              <Skeleton height={180} />
            ) : branchData.length === 0 ? (
              <EmptyChart message="No branch assigned to any call yet -- tracked from now on, so older calls won't show here." />
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, branchData.length * 34)}>
                <BarChart data={branchData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                  <Bar dataKey="count" fill="#1e9e58" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive>
                    <LabelList dataKey="count" position="right" fontSize={11} fill="#5b6270" fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ ...cardStyle, marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 14 }}>
              Customers &amp; call history
            </div>
            <CustomerHistoryTable
              data={customerHistory}
              loading={customerHistoryLoading}
              page={customerHistoryPage}
              pageSize={CUSTOMER_HISTORY_PAGE_SIZE}
              onPageChange={setCustomerHistoryPage}
            />
          </div>
        </div>
        ) : (
          <CalendarTab
            month={selectedMonth}
            category={category}
            employeeId={employeeId}
            carMake={carMake}
            carModel={carModel}
            sentiment={sentiment}
            productId={productId}
          />
        )}

        {filtersVisible && (
        <div className="reports-filter-panel" style={{ ...cardStyle, position: "sticky", top: 20, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <SlidersHorizontal size={14} color="var(--text-faint)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Filters
            </span>
          </div>

          {activeTab === "performance" && (
          <FilterField label="Granularity">
            <select style={filterInputStyle} value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)}>
              {GRANULARITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FilterField>
          )}

          <FilterField label="Category">
            <MultiSelectFilter
              label="All categories"
              values={category}
              onChange={setCategory}
              options={CATEGORY_OPTIONS}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Employee">
            <MultiSelectFilter
              label="All employees"
              values={employeeId}
              onChange={setEmployeeId}
              options={employees.map((emp) => ({ value: emp.id, label: emp.name }))}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Branch">
            <MultiSelectFilter
              label="All branches"
              values={branch}
              onChange={setBranch}
              options={BRANCH_OPTIONS}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Status">
            <MultiSelectFilter
              label="All statuses"
              values={status}
              onChange={setStatus}
              options={STATUS_OPTIONS}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Car make">
            <MultiSelectFilter
              label="All makes"
              values={carMake}
              onChange={setCarMake}
              options={carMakeOptions.map((make) => ({ value: make, label: make }))}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Car model">
            <MultiSelectFilter
              label="All models"
              values={carModel}
              onChange={setCarModel}
              options={carModelOptions.map((model) => ({ value: model, label: model }))}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Sentiment">
            <MultiSelectFilter
              label="All sentiments"
              values={sentiment}
              onChange={setSentiment}
              options={SENTIMENT_OPTIONS}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          <FilterField label="Product">
            <MultiSelectFilter
              label="All products"
              values={productId}
              onChange={setProductId}
              options={products.map((p) => ({ value: p.id, label: p.name }))}
              triggerStyle={{ width: "100%" }}
            />
          </FilterField>

          {activeTab === "performance" ? (
            <>
              <FilterField label="From date">
                <DateInput style={filterInputStyle} value={dateFrom} onChange={setDateFrom} />
              </FilterField>

              <FilterField label="To date">
                <DateInput style={filterInputStyle} value={dateTo} onChange={setDateTo} />
              </FilterField>
            </>
          ) : (
            <FilterField label="Month">
              <input
                type="month"
                style={filterInputStyle}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              />
            </FilterField>
          )}

          {hasActiveFilters && (
            <button onClick={clearFilters} style={clearFiltersButtonStyle}>
              Clear filters
            </button>
          )}
        </div>
        )}
      </div>
    </div>
  );
}

function FilterField({ label, children }: { label: string; children: ReactNode }) {
  // A <label> would be right for a lone <select>/<input>, but MultiSelectFilter
  // nests a whole popover of checkboxes inside it -- clicking one inside a
  // <label> can trigger the browser's implicit label-click-forwarding onto
  // the first labelable descendant (the trigger button), snapping the
  // popover shut mid-click. Plain div + visual-only text avoids that.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5, marginBottom: 14 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-soft)" }}>{label}</span>
      {children}
    </div>
  );
}

function Legend({ items }: { items: { key: string; label: string; color: string }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", marginTop: -8 }}>
      {items.map((d) => (
        <span key={d.key} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "var(--text-soft)", textTransform: "capitalize" }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
          {d.label}
        </span>
      ))}
    </div>
  );
}

function CustomerHistoryTable({
  data,
  loading,
  page,
  pageSize,
  onPageChange,
}: {
  data: Paginated<CustomerCallHistoryRow> | null;
  loading: boolean;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  if (loading) return <Skeleton height={220} />;

  const rows = data?.items ?? [];
  if (rows.length === 0) {
    return <EmptyChart message="No customers match the current filters." />;
  }

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div>
      <div className="table-scroll">
        <div style={{ minWidth: 640 }}>
          <div
            className="mono"
            style={{
              display: "grid",
              gridTemplateColumns: "1.6fr 1.1fr 70px 1fr 1.2fr 1fr",
              padding: "8px 4px",
              fontSize: 11,
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              color: "var(--text-faint)",
              textTransform: "uppercase",
              letterSpacing: "0.04em",
              borderBottom: "1px solid var(--border-soft)",
            }}
          >
            <span>Customer</span>
            <span>Phone</span>
            <span>Calls</span>
            <span>Last call</span>
            <span>Latest vehicle</span>
            <span>Budget</span>
          </div>
          {rows.map((r) => (
            <a
              key={r.customerId}
              href={`/customers/${r.customerId}`}
              target="_blank"
              rel="noreferrer"
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1.1fr 70px 1fr 1.2fr 1fr",
                alignItems: "center",
                padding: "10px 4px",
                fontSize: 13,
                borderBottom: "1px solid var(--border-soft)",
                color: "inherit",
                textDecoration: "none",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span style={{ fontWeight: 700, color: "var(--brand-strong)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {r.name ?? <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Unnamed caller</span>}
              </span>
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                {r.phoneNumber}
              </span>
              <span className="mono" style={{ color: "var(--text-soft)" }}>{r.callCount}</span>
              <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{formatDate(r.lastCallDate)}</span>
              <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                {[r.latestCarMake, r.latestCarModel].filter(Boolean).join(" ") || "—"}
              </span>
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                {r.totalBudget > 0 ? formatCurrency(r.totalBudget) : "—"}
              </span>
            </a>
          ))}
        </div>
      </div>

      {totalPages > 1 && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, fontSize: 12.5 }}>
          <span style={{ color: "var(--text-faint)" }}>
            Page {page} of {totalPages} · {total} customer{total === 1 ? "" : "s"}
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => onPageChange(page - 1)} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
              Previous
            </button>
            <button onClick={() => onPageChange(page + 1)} disabled={page >= totalPages} style={pagerButtonStyle(page >= totalPages)}>
              Next
            </button>
          </div>
        </div>
      )}
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
  icon: typeof PhoneCall;
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
      {loading ? <Skeleton width={60} height={26} /> : (
        <div style={{ fontFamily: "var(--font-display)", fontSize: 26, fontWeight: 700 }}>{value ?? "—"}</div>
      )}
    </div>
  );
}

// Highlights only the peak and trough of a line/area series with a labeled
// dot -- the line itself has no gridlines to read values off of, so the
// extremes need calling out directly rather than left for the eye to guess.
function MaxMinDots({ data, dataKey, color }: { data: Record<string, string | number>[]; dataKey: string; color: string }) {
  if (data.length === 0) return null;
  let maxIdx = 0;
  let minIdx = 0;
  data.forEach((d, i) => {
    if ((d[dataKey] as number) > (data[maxIdx][dataKey] as number)) maxIdx = i;
    if ((d[dataKey] as number) < (data[minIdx][dataKey] as number)) minIdx = i;
  });
  if (data[maxIdx][dataKey] === data[minIdx][dataKey]) return null; // flat series -- nothing to call out
  const dotStyle = { r: 4, fill: color, stroke: "var(--paper-raised)", strokeWidth: 2 };
  return (
    <>
      <ReferenceDot
        x={data[maxIdx].period}
        y={data[maxIdx][dataKey]}
        {...dotStyle}
        label={{ value: `${data[maxIdx][dataKey]}`, position: "top", fontSize: 11, fontWeight: 700, fill: color }}
      />
      <ReferenceDot
        x={data[minIdx].period}
        y={data[minIdx][dataKey]}
        {...dotStyle}
        label={{ value: `${data[minIdx][dataKey]}`, position: "bottom", fontSize: 11, fontWeight: 700, fill: color }}
      />
    </>
  );
}

function EmptyChart({ message }: { message: string }) {
  return (
    <div style={{ height: 200, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-faint)", fontSize: 13, textAlign: "center", padding: "0 12px" }}>
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

const filterInputStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
};

const clearFiltersButtonStyle: CSSProperties = {
  width: "100%",
  padding: "8px 10px",
  background: "none",
  color: "var(--text-soft)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 12.5,
  fontWeight: 600,
};

function pagerButtonStyle(disabled: boolean): CSSProperties {
  return {
    padding: "6px 12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper)",
    fontSize: 12.5,
    fontWeight: 600,
    color: disabled ? "var(--text-faint)" : "var(--text)",
    opacity: disabled ? 0.6 : 1,
  };
}
