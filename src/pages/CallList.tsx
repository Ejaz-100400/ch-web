import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PhoneCall } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { CategoryBadge, CallStatusBadge, SentimentBadge, ImportedBadge } from "../components/ui/StatusBadge";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { formatDuration, formatDateTime } from "../lib/format";
import type { Call, Employee } from "../types";

const PAGE_SIZE = 20;

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

export default function CallList() {
  const navigate = useNavigate();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [carModel, setCarModel] = useState("");
  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [calls, setCalls] = useState<Call[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [carModel, category, employeeId, dateFrom, dateTo]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.calls
      .list({
        search: debouncedSearch || undefined,
        carModel: carModel || undefined,
        category: category || undefined,
        employeeId: employeeId || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        page,
        pageSize: PAGE_SIZE,
      })
      .then((res) => {
        if (!active) return;
        setCalls(res.items);
        setTotal(res.total);
      })
      .catch((err) => {
        if (active) toast.show(err instanceof ApiError ? err.message : "Failed to load calls", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedSearch, carModel, category, employeeId, dateFrom, dateTo, page]);

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));
  const hasActiveFilters = Boolean(search || carModel || category || employeeId || dateFrom || dateTo);

  function clearFilters() {
    setSearch("");
    setCarModel("");
    setCategory("");
    setEmployeeId("");
    setDateFrom("");
    setDateTo("");
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div>
      <PageHeader
        eyebrow="Calls"
        title="Call log"
        description="Every inbound enquiry across both lines, with AI-extracted vehicle details, sentiment, and processing status."
      />

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search customer name or summary" />
        <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
        <FilterSelect label="Employee" value={employeeId} onChange={setEmployeeId} options={employeeOptions} />
        <input
          type="text"
          value={carModel}
          onChange={(e) => setCarModel(e.target.value)}
          placeholder="Car model"
          style={{ padding: "9px 12px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13.5, width: 130 }}
        />
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          aria-label="From date"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          aria-label="To date"
          style={{ padding: "8px 10px", border: "1px solid var(--border)", borderRadius: "var(--radius-sm)", background: "var(--paper)", fontSize: 13 }}
        />
        {hasActiveFilters && <ClearFiltersButton onClick={clearFilters} />}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? "Loading…" : `${total} call${total === 1 ? "" : "s"}`}
      </div>

      <div
        style={{
          background: "var(--paper-raised)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          overflow: "hidden",
          boxShadow: "var(--shadow-card)",
        }}
      >
      <div className="table-scroll">
        <div style={{ minWidth: 820 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "130px 1fr 1.4fr 1fr 90px 1fr 1.2fr",
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
          <span>Date</span>
          <span>Category</span>
          <span>Customer</span>
          <span>Employee</span>
          <span>Duration</span>
          <span>Status</span>
          <span>Sentiment</span>
        </div>

        {loading && <SkeletonRows rows={8} />}

        {!loading &&
          calls.map((call) => (
            <button
              key={call.id}
              onClick={() => navigate(`/calls/${call.id}`)}
              style={{
                width: "100%",
                display: "grid",
                gridTemplateColumns: "130px 1fr 1.4fr 1fr 90px 1fr 1.2fr",
                alignItems: "center",
                padding: "12px 18px",
                background: "transparent",
                border: "none",
                borderBottom: "1px solid var(--border-soft)",
                textAlign: "left",
                fontSize: 13,
                transition: "background 120ms ease",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--paper)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12 }}>
                {formatDateTime(call.callDate)}
              </span>
              <CategoryBadge category={call.businessCategory} />
              <span style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden" }}>
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {call.customer?.name ?? call.extraction?.customerName ?? (
                    <span style={{ color: "var(--text-faint)" }}>{call.customer?.phoneNumber ?? "Unknown"}</span>
                  )}
                </span>
                {call.extraction?.extractedByModel === "manual_import" && <ImportedBadge />}
              </span>
              <span style={{ color: "var(--text-soft)" }}>{call.employee?.name ?? "Unassigned"}</span>
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>
                {formatDuration(call.durationSeconds)}
              </span>
              <CallStatusBadge status={call.status} />
              {call.extraction?.sentiment ? <SentimentBadge sentiment={call.extraction.sentiment} /> : <span style={{ color: "var(--text-faint)" }}>—</span>}
            </button>
          ))}
        </div>
      </div>

        {!loading && calls.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <PhoneCall size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No calls match these filters</p>
            <p style={{ fontSize: 13 }}>Try different filters, or clear them to see every call.</p>
          </div>
        )}
      </div>

      {!loading && totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, marginTop: 18 }}>
          <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1} style={pagerButtonStyle(page <= 1)}>
            Previous
          </button>
          <span style={{ fontSize: 12.5, color: "var(--text-soft)" }}>
            Page {page} of {totalPages}
          </span>
          <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages} style={pagerButtonStyle(page >= totalPages)}>
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function pagerButtonStyle(disabled: boolean) {
  return {
    padding: "7px 14px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--paper-raised)",
    fontSize: 12.5,
    fontWeight: 600,
    color: disabled ? "var(--text-faint)" : "var(--text)",
    opacity: disabled ? 0.6 : 1,
  } as const;
}
