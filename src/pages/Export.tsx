import { useEffect, useState, type ReactNode } from "react";
import { FileSpreadsheet, FileText, Download, ShieldAlert } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterSelect } from "../components/ui/FilterBar";
import { api, ApiError, downloadBlob, type CallsQuery } from "../lib/api";
import { useAuth, canManage } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { formatDateTime } from "../lib/format";
import type { AuditLogEntry, Employee } from "../types";

type ExportFormat = "xlsx" | "pdf";

function summarizeFilters(filters: Record<string, unknown> | undefined, employees: Employee[]): string {
  if (!filters) return "All calls";
  const parts: string[] = [];
  if (filters.category) parts.push(filters.category === "car_glasses" ? "Car Glasses" : "Car Modifications");
  if (filters.employeeId) parts.push(employees.find((e) => e.id === filters.employeeId)?.name ?? "employee");
  if (filters.dateFrom || filters.dateTo) parts.push(`${filters.dateFrom ?? "…"} – ${filters.dateTo ?? "…"}`);
  return parts.length ? parts.join(", ") : "All calls";
}

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const FORMATS: { value: ExportFormat; label: string; icon: typeof FileText; description: string }[] = [
  { value: "xlsx", label: "Excel", icon: FileSpreadsheet, description: "Spreadsheet with one row per call" },
  { value: "pdf", label: "PDF", icon: FileText, description: "Formatted report table" },
];

export default function Export() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [category, setCategory] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
      category: category || undefined,
      employeeId: employeeId || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
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
            <FilterSelect label="Category" value={category} onChange={setCategory} options={CATEGORY_OPTIONS} />
            <FilterSelect label="Employee" value={employeeId} onChange={setEmployeeId} options={employeeOptions} />
            <div style={{ display: "flex", gap: 10 }}>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>From</label>
                <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={fieldLabelStyle}>To</label>
                <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
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
            <Download size={16} className={generating ? "spin" : undefined} />
            {generating ? "Generating…" : "Generate & download"}
          </button>
        </div>

        {/* Recent exports -- who exported what, so it's traceable across the team */}
        <div style={cardStyle}>
          <SectionLabel>Recent exports</SectionLabel>
          {historyLoading ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>Loading…</p>
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
