import { useEffect, useMemo, useState, type ReactNode, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
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
import { PhoneCall, Glasses, Wrench, CalendarClock, SlidersHorizontal, Timer, Wallet, Smile, AlertTriangle, HelpCircle, Users, Eye, EyeOff, X, ChevronDown, ChevronRight } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { Skeleton } from "../components/ui/Skeleton";
import { CategoryBadge, CallStatusBadge } from "../components/ui/StatusBadge";
import { api, ApiError, type ReportsQuery } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatCurrency, formatDate, formatDateTime, formatDuration } from "../lib/format";
import { useVehicleFilters } from "../lib/useVehicleFilters";
import type {
  Call,
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
};

export default function Reports() {
  const toast = useToast();
  const [filtersVisible, setFiltersVisible] = useState(true);
  const [showAllCustomers, setShowAllCustomers] = useState(false);
  const [granularity, setGranularity] = useState<"daily" | "weekly" | "monthly">("daily");
  const [category, setCategory] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string[]>([]);
  const { carMake, setCarMake, carModel, setCarModel, carMakeOptions, carModelOptions, reset: resetVehicleFilters } = useVehicleFilters();
  const [sentiment, setSentiment] = useState<string[]>([]);
  const [productId, setProductId] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [callsByPeriod, setCallsByPeriod] = useState<CallsByPeriodPoint[]>([]);
  const [customersByPeriod, setCustomersByPeriod] = useState<CustomersByPeriodPoint[]>([]);
  const [followUpBreakdown, setFollowUpBreakdown] = useState<FollowUpBreakdownPoint[]>([]);
  const [sentimentBreakdown, setSentimentBreakdown] = useState<SentimentBreakdownPoint[]>([]);
  const [topCarModels, setTopCarModels] = useState<TopCarModelPoint[]>([]);
  const [topProducts, setTopProducts] = useState<TopProductPoint[]>([]);
  const [topEmployees, setTopEmployees] = useState<TopEmployeePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [customerHistory, setCustomerHistory] = useState<Paginated<CustomerCallHistoryRow> | null>(null);
  const [customerHistoryLoading, setCustomerHistoryLoading] = useState(true);
  const [customerHistoryPage, setCustomerHistoryPage] = useState(1);
  const CUSTOMER_HISTORY_PAGE_SIZE = 10;

  const filters = useMemo(
    () => ({
      category: category.length ? category : undefined,
      employeeId: employeeId.length ? employeeId : undefined,
      carMake: carMake.length ? carMake : undefined,
      carModel: carModel.length ? carModel : undefined,
      sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
      productId: productId.length ? productId : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    }),
    [category, employeeId, carMake, carModel, sentiment, productId, dateFrom, dateTo],
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
      api.reports.topCarModels(8, filters),
      api.reports.topProducts(8, filters),
      api.reports.topEmployees(8, filters),
    ])
      .then(([s, cbp, custp, f, sent, cm, p, emp]) => {
        if (!active) return;
        setSummary(s);
        setCallsByPeriod(cbp);
        setCustomersByPeriod(custp);
        setFollowUpBreakdown(f);
        setSentimentBreakdown(sent);
        setTopCarModels(cm);
        setTopProducts(p);
        setTopEmployees(emp);
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
  const employeeData = topEmployees.map((e) => ({ name: e.name, count: e.count }));

  const hasActiveFilters = Boolean(
    category.length || employeeId.length || carMake.length || carModel.length || sentiment.length || productId.length || dateFrom || dateTo,
  );
  function clearFilters() {
    setCategory([]);
    setEmployeeId([]);
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
        title="Business performance"
        description="Enquiry volume, follow-up outcomes, and what customers are actually asking for."
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

      <div className="reports-layout" style={{ display: "grid", gridTemplateColumns: filtersVisible ? "1fr 260px" : "1fr", gap: 20, alignItems: "start" }}>
        <div style={{ minWidth: 0 }}>
          {/* Left-to-right, top-to-bottom = business priority: overall volume
              and reach first, then what's being called about, then how
              likely it is to turn into revenue, then follow-up execution,
              then call efficiency last. */}
          <div className="grid-responsive-4" style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 14, marginBottom: 14 }}>
            <KpiCard icon={PhoneCall} label="Total calls" value={summary?.totalCalls} tint="var(--brand)" loading={loading} />
            <KpiCard icon={Users} label="Total customers" value={summary?.totalCustomers} tint="var(--violet)" loading={loading} />
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
              icon={Wallet}
              label="Budget potential / customer"
              value={summary ? formatCurrency(summary.budgetPotentialPerCustomer) : undefined}
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
              <SectionLabel>Top car models mentioned</SectionLabel>
              {loading ? (
                <Skeleton height={240} />
              ) : carModelData.length === 0 ? (
                <EmptyChart message="No car models extracted yet." />
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(240, carModelData.length * 30)}>
                  <BarChart data={carModelData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
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
              <ResponsiveContainer width="100%" height={Math.max(220, employeeData.length * 32)}>
                <BarChart data={employeeData} layout="vertical" margin={{ left: 0, right: 30, top: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 12, fill: "#5b6270" }} axisLine={false} tickLine={false} allowDecimals={false} hide />
                  <YAxis type="category" dataKey="name" interval={0} tick={{ fontSize: 11, fill: "#5b6270" }} axisLine={false} tickLine={false} width={130} />
                  <Tooltip contentStyle={{ borderRadius: 8, borderColor: "#e2e4ea", fontSize: 13 }} />
                  <Bar dataKey="count" fill="#d99a2b" radius={[0, 6, 6, 0]} maxBarSize={18} isAnimationActive>
                    <LabelList dataKey="count" position="right" fontSize={11} fill="#5b6270" fontWeight={700} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          <div style={{ ...cardStyle, marginTop: 14 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Customers &amp; call history
              </div>
              {(customerHistory?.total ?? 0) > CUSTOMER_HISTORY_PAGE_SIZE && (
                <button
                  onClick={() => setShowAllCustomers(true)}
                  style={{ background: "none", border: "none", color: "var(--brand-strong)", fontSize: 12.5, fontWeight: 700 }}
                >
                  View all {customerHistory?.total} &rarr;
                </button>
              )}
            </div>
            <CustomerHistoryTable
              data={customerHistory}
              loading={customerHistoryLoading}
              page={customerHistoryPage}
              pageSize={CUSTOMER_HISTORY_PAGE_SIZE}
              onPageChange={setCustomerHistoryPage}
            />
          </div>

          {showAllCustomers && <CustomerHistoryModal onClose={() => setShowAllCustomers(false)} filters={filters} />}
        </div>

        {filtersVisible && (
        <div className="reports-filter-panel" style={{ ...cardStyle, position: "sticky", top: 20, padding: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
            <SlidersHorizontal size={14} color="var(--text-faint)" />
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
              Filters
            </span>
          </div>

          <FilterField label="Granularity">
            <select style={filterInputStyle} value={granularity} onChange={(e) => setGranularity(e.target.value as typeof granularity)}>
              {GRANULARITY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </FilterField>

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

          <FilterField label="From date">
            <input type="date" style={filterInputStyle} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </FilterField>

          <FilterField label="To date">
            <input type="date" style={filterInputStyle} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </FilterField>

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
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 5, fontSize: 12, fontWeight: 600, color: "var(--text-soft)", marginBottom: 14 }}>
      {label}
      {children}
    </label>
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
            <div
              key={r.customerId}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1.1fr 70px 1fr 1.2fr 1fr",
                alignItems: "center",
                padding: "10px 4px",
                fontSize: 13,
                borderBottom: "1px solid var(--border-soft)",
              }}
            >
              <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
            </div>
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

// Full-detail view of the same customer-call-history data: bigger page size,
// and each row expands in place to show that customer's actual calls (same
// lazy-fetch-and-cache idea as the Customer directory page) rather than just
// the rolled-up counts the compact table on the page shows.
function CustomerHistoryModal({ onClose, filters }: { onClose: () => void; filters: ReportsQuery }) {
  const toast = useToast();
  const navigate = useNavigate();
  const PAGE_SIZE = 25;
  const [data, setData] = useState<Paginated<CustomerCallHistoryRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [callsByCustomer, setCallsByCustomer] = useState<Record<string, Call[]>>({});
  const [callsLoading, setCallsLoading] = useState<string | null>(null);

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.reports
      .customerCallHistory(page, PAGE_SIZE, filters)
      .then((res) => {
        if (active) setData(res);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load customer history", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  async function toggleExpand(customerId: string) {
    const isOpen = expandedId === customerId;
    setExpandedId(isOpen ? null : customerId);
    if (!isOpen && !callsByCustomer[customerId]) {
      setCallsLoading(customerId);
      try {
        const calls = await api.customers.calls(customerId);
        setCallsByCustomer((prev) => ({ ...prev, [customerId]: calls }));
      } catch (err) {
        toast.show(err instanceof ApiError ? err.message : "Failed to load calls", "error");
      } finally {
        setCallsLoading(null);
      }
    }
  }

  const rows = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(0, 0, 0, 0.45)",
        backdropFilter: "blur(2px)",
        zIndex: 1900,
        padding: 20,
      }}
    >
      <div
        className="fade-in-up"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          boxShadow: "var(--shadow-pop)",
          width: "min(960px, 100%)",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid var(--border-soft)" }}>
          <div style={{ fontSize: 15, fontWeight: 700 }}>All customers &amp; call history{total > 0 ? ` (${total})` : ""}</div>
          <button onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
            <X size={18} />
          </button>
        </div>

        <div style={{ overflowY: "auto", padding: 16, flex: 1 }}>
          {loading ? (
            <Skeleton height={320} />
          ) : rows.length === 0 ? (
            <EmptyChart message="No customers match the current filters." />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <div
                className="mono"
                style={{
                  display: "grid",
                  gridTemplateColumns: "20px 1.6fr 1.1fr 70px 1fr 1.2fr 1fr",
                  gap: 8,
                  padding: "0 12px 6px",
                  fontSize: 11,
                  fontFamily: "var(--font-body)",
                  fontWeight: 700,
                  color: "var(--text-faint)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                <span />
                <span>Customer</span>
                <span>Phone</span>
                <span>Calls</span>
                <span>Last call</span>
                <span>Latest vehicle</span>
                <span>Budget</span>
              </div>

              {rows.map((r) => {
                const isOpen = expandedId === r.customerId;
                const calls = callsByCustomer[r.customerId] ?? [];
                return (
                  <div key={r.customerId} style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", overflow: "hidden" }}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpand(r.customerId)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") toggleExpand(r.customerId);
                      }}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "20px 1.6fr 1.1fr 70px 1fr 1.2fr 1fr",
                        alignItems: "center",
                        gap: 8,
                        padding: "10px 12px",
                        cursor: "pointer",
                        fontSize: 13,
                        background: isOpen ? "var(--paper)" : "transparent",
                      }}
                    >
                      <span style={{ color: "var(--text-faint)", display: "flex" }}>
                        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                      <span style={{ fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {r.name ?? <span style={{ color: "var(--text-faint)", fontWeight: 600 }}>Unnamed caller</span>}
                      </span>
                      <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{r.phoneNumber}</span>
                      <span className="mono" style={{ color: "var(--text-soft)" }}>{r.callCount}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{formatDate(r.lastCallDate)}</span>
                      <span style={{ color: "var(--text-soft)", fontSize: 12.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[r.latestCarMake, r.latestCarModel].filter(Boolean).join(" ") || "—"}
                      </span>
                      <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                        {r.totalBudget > 0 ? formatCurrency(r.totalBudget) : "—"}
                      </span>
                    </div>

                    {isOpen && (
                      <div className="expand-row-anim" style={{ background: "var(--paper)", padding: "6px 12px 12px 38px", borderTop: "1px solid var(--border-soft)" }}>
                        {callsLoading === r.customerId ? (
                          <p style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 0" }}>Loading calls…</p>
                        ) : calls.length === 0 ? (
                          <p style={{ fontSize: 12.5, color: "var(--text-faint)", padding: "8px 0" }}>No calls logged yet.</p>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                            {calls.map((call) => (
                              <button
                                key={call.id}
                                onClick={() => navigate(`/calls/${call.id}`)}
                                style={{
                                  display: "grid",
                                  gridTemplateColumns: "110px auto 1fr auto",
                                  alignItems: "center",
                                  gap: 12,
                                  padding: "8px 10px",
                                  background: "var(--paper-raised)",
                                  border: "1px solid var(--border-soft)",
                                  borderRadius: "var(--radius-sm)",
                                  textAlign: "left",
                                  fontSize: 12.5,
                                }}
                              >
                                <span className="mono" style={{ color: "var(--text-soft)", fontSize: 11.5 }}>
                                  {formatDateTime(call.callDate)}
                                </span>
                                <CategoryBadge category={call.businessCategory} />
                                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-soft)" }}>
                                  {call.extraction?.summary ?? "No summary yet"}
                                </span>
                                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                  <span className="mono" style={{ fontSize: 11.5, color: "var(--text-soft)" }}>
                                    {formatDuration(call.durationSeconds)}
                                  </span>
                                  <CallStatusBadge status={call.status} />
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderTop: "1px solid var(--border-soft)", fontSize: 12.5 }}>
            <span style={{ color: "var(--text-faint)" }}>
              Page {page} of {totalPages}
            </span>
            <div style={{ display: "flex", gap: 6 }}>
              <button onClick={() => setPage((p) => p - 1)} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
                Previous
              </button>
              <button onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} style={pagerButtonStyle(page >= totalPages)}>
                Next
              </button>
            </div>
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
