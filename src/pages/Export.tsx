import { useEffect, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Download, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { MultiSelectFilter } from "../components/ui/FilterBar";
import { DateInput } from "../components/ui/DateInput";
import { api, ApiError, downloadBlob, type CallsQuery } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { Spinner, LoadingText } from "../components/ui/Spinner";
import { formatDateTime } from "../lib/format";
import type { AuditLogEntry, Employee } from "../types";

type ExportFormat = "xlsx" | "pdf";

const CATEGORY_LABELS: Record<string, string> = {
  car_glasses: "Car Glasses",
  car_modifications: "Car Modifications",
  unknown: "Unknown",
};

// filters.category/employeeId may be a plain string on older audit log
// entries logged before these became multi-select arrays -- normalize
// either shape to an array so old history still renders correctly.
function asArray(value: unknown): string[] {
  if (Array.isArray(value)) return value as string[];
  if (typeof value === "string" && value) return [value];
  return [];
}

function summarizeFilters(filters: Record<string, unknown> | undefined, employees: Employee[]): string {
  if (!filters) return "All calls";
  const parts: string[] = [];
  const categories = asArray(filters.category);
  if (categories.length) parts.push(categories.map((c) => CATEGORY_LABELS[c] ?? c).join(" or "));
  const employeeIds = asArray(filters.employeeId);
  if (employeeIds.length) {
    parts.push(employeeIds.map((id) => employees.find((e) => e.id === id)?.name ?? "employee").join(", "));
  }
  if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom ?? "…"} – ${filters.dateTo ?? "…"}`);
  return parts.length ? parts.join(", ") : "All calls";
}

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const STATUS_OPTIONS = [
  { value: "pending", label: "Pending" },
  { value: "processing", label: "Processing" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const FORMATS: { value: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet, description: "Spreadsheet with one row per call" },
  { value: "pdf", label: "PDF", icon: FileText, description: "Formatted report table" },
];

export default function Export() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState<string[]>([]);
  const [status, setStatus] = useState<string[]>([]);
  const [employeeId, setEmployeeId] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [timeFrom, setTimeFrom] = useState("");
  const [timeTo, setTimeTo] = useState("");
  const [format, setFormat] = useState<ExportFormat>("xlsx");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
    loadHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadHistory() {
    setHistoryLoading(true);
    return api.export
      .history()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  if (!canManage(appUser?.role)) {
    return (
      <div>
        <PageHeader eyebrow="Export" title="Export data" />
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
    const query: CallsQuery = {
      category: category.length ? category : undefined,
      status: status.length ? status : undefined,
      employeeId: employeeId.length ? employeeId : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      timeFrom: dateFrom && timeFrom ? timeFrom : undefined,
      timeTo: dateTo && timeTo ? timeTo : undefined,
    };
    try {
      const blob = await api.export.calls(format, query);
      const dateStamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, `calls-export-${dateStamp}.${format}`);
      toast.show(`${format.toUpperCase()} export downloaded.`, "success");
      await loadHistory();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Export failed", "error");
    } finally {
      setGenerating(false);
    }
  }

  const employeeOptions = employees.map((e) => ({ value: e.id, label: e.name }));

  return (
    <div>
      <PageHeader
        eyebrow="Export"
        title="Export calls"
        description="Generate an Excel or PDF report of calls matching your filters, straight from the live data — same filters as the Calls page."
      />

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
        {/* Configuration */}
        <div style={cardStyle}>
          <SectionLabel>1. Filter which calls</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 22 }}>
            <MultiSelectFilter label="Category" values={category} onChange={setCategory} options={CATEGORY_OPTIONS} triggerStyle={{ width: "100%" }} />
            <MultiSelectFilter label="Status" values={status} onChange={setStatus} options={STATUS_OPTIONS} triggerStyle={{ width: "100%" }} />
            <MultiSelectFilter label="Employee" values={employeeId} onChange={setEmployeeId} options={employeeOptions} triggerStyle={{ width: "100%" }} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>From</label>
                <DateInput value={dateFrom} onChange={setDateFrom} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>To</label>
                <DateInput value={dateTo} onChange={setDateTo} style={inputStyle} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>From time</label>
                <input
                  type="time"
                  value={timeFrom}
                  onChange={(e) => setTimeFrom(e.target.value)}
                  disabled={!dateFrom}
                  style={{ ...inputStyle, opacity: dateFrom ? 1 : 0.5 }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>To time</label>
                <input
                  type="time"
                  value={timeTo}
                  onChange={(e) => setTimeTo(e.target.value)}
                  disabled={!dateTo}
                  style={{ ...inputStyle, opacity: dateTo ? 1 : 0.5 }}
                />
              </div>
            </div>
          </div>

          <SectionLabel>2. File format</SectionLabel>
          <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
            {FORMATS.map((f) => {
              const Icon = f.icon;
              const active = format === f.value;
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
                    border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                    background: active ? "var(--brand-soft)" : "var(--paper)",
                    color: active ? "var(--brand-strong)" : "var(--text-soft)",
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
                        {summarizeFilters(h.details?.filters as Record<string, unknown> | undefined, employees)}
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
