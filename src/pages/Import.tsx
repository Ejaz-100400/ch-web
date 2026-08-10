import { useEffect, useRef, useState } from "react";
import {
  Download,
  FileSpreadsheet,
  Upload,
  AlertTriangle,
  CheckCircle2,
  History,
  Camera,
  X,
  ScanLine,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import {
  api,
  ApiError,
  downloadBlob,
  type CommitPhotoRowInput,
  type ImportedRowSummary,
  type ImportResult,
  type ParsedExcelRow,
} from "../lib/api";
import { useToast } from "../components/ui/Toast";
import { Spinner, LoadingText } from "../components/ui/Spinner";
import { ProgressOverlay } from "../components/ui/ProgressOverlay";
import { formatDate, formatDateTime } from "../lib/format";
import type { AuditLogEntry, BusinessCategory, Employee, ExtractedEntry, SentimentType } from "../types";

type Tab = "excel" | "photos";

const CATEGORY_OPTIONS: { value: BusinessCategory; label: string }[] = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
  { value: "unknown", label: "Unknown" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(CATEGORY_OPTIONS.map((o) => [o.value, o.label]));

// Rows are committed in small batches (rather than all at once) purely so the
// UI can show real progress -- each batch is a real round-trip, not a fake timer.
const BATCH_SIZE = 15;

async function commitRowsInBatches(
  rows: CommitPhotoRowInput[],
  rowNumbers: number[],
  source: "excel" | "photo_ocr",
  onProgress: (done: number, total: number) => void,
): Promise<ImportResult> {
  const total = rows.length;
  let imported = 0;
  let skipped = 0;
  const errors: { row: number; reason: string }[] = [];
  const importedRows: ImportedRowSummary[] = [];

  for (let i = 0; i < total; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const res = await api.import.commitPhotoRows(batch);
    imported += res.imported;
    skipped += res.skipped;
    for (const e of res.errors) {
      const globalIndex = i + (e.row - 1);
      errors.push({ row: rowNumbers[globalIndex] ?? e.row, reason: e.reason });
    }
    importedRows.push(...res.importedRows);
    onProgress(Math.min(i + BATCH_SIZE, total), total);
  }

  if (imported > 0 || skipped > 0) {
    // Non-critical -- the rows are already safely persisted either way.
    await api.import.recordHistory({ source, imported, skipped, errors, rows: importedRows }).catch(() => {});
  }

  return { imported, skipped, errors };
}

function excelRowToCommitInput(r: ParsedExcelRow): CommitPhotoRowInput {
  return {
    phoneNumber: r.phoneNumber,
    businessCategory: r.businessCategory,
    callDate: r.callDate,
    customerName: r.customerName,
    employeeId: r.employeeId,
    durationSeconds: r.durationSeconds,
    carMake: r.carMake,
    carModel: r.carModel,
    carVariant: r.carVariant,
    location: r.location,
    productsDiscussed: r.productsDiscussed,
    customerRequirements: r.customerRequirements,
    budget: r.budget,
    followUpRequired: r.followUpRequired,
    followUpDate: r.followUpDate,
    summary: r.summary,
    sentiment: r.sentiment,
  };
}

const SENTIMENT_OPTIONS: { value: SentimentType; label: string }[] = [
  { value: "interested", label: "Interested" },
  { value: "not_interested", label: "Not interested" },
  { value: "needs_follow_up", label: "Needs follow-up" },
];

export default function Import() {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("excel");
  const [history, setHistory] = useState<AuditLogEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);

  useEffect(() => {
    loadHistory();
  }, []);

  function loadHistory() {
    setHistoryLoading(true);
    return api.import
      .history()
      .then(setHistory)
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Import historical data"
        description="Bulk-load past customer calls from a spreadsheet or photos of handwritten notes — they'll show up in Calls, Reports, and Follow-ups right alongside calls that came in live through the AI pipeline."
      />

      <div style={{ display: "flex", gap: 8, marginBottom: 18 }}>
        <TabButton active={tab === "excel"} onClick={() => setTab("excel")} icon={FileSpreadsheet} label="Spreadsheet" />
        <TabButton active={tab === "photos"} onClick={() => setTab("photos")} icon={Camera} label="Photo scan" />
      </div>

      {tab === "excel" ? (
        <ExcelImportPanel toast={toast} onImported={loadHistory} />
      ) : (
        <PhotoImportPanel toast={toast} onImported={loadHistory} />
      )}

      {/* Who imported what, so it's traceable across the team */}
      <div style={{ ...cardStyle, marginTop: 20 }}>
        <SectionLabel>Recent imports</SectionLabel>
        {historyLoading ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}><LoadingText /></p>
        ) : history.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No imports yet.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 420, overflowY: "auto", paddingRight: 4 }}>
            {history.map((h) => {
              const imported = (h.details?.imported as number | undefined) ?? 0;
              const skipped = (h.details?.skipped as number | undefined) ?? 0;
              const source = h.details?.source === "photo_ocr" ? "Photo scan" : "Spreadsheet";
              const rows = (h.details?.rows as ImportedRowSummary[] | undefined) ?? [];
              const isOpen = expandedHistoryId === h.id;
              return (
                <div key={h.id} className="fade-in-up" style={{ border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)" }}>
                  <button
                    onClick={() => setExpandedHistoryId(isOpen ? null : h.id)}
                    disabled={rows.length === 0}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      gap: 14,
                      padding: "12px 14px",
                      background: "transparent",
                      border: "none",
                      textAlign: "left",
                      cursor: rows.length === 0 ? "default" : "pointer",
                    }}
                  >
                    <span style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 8, background: "var(--brand-soft)", flexShrink: 0 }}>
                      <History size={16} color="var(--brand-strong)" />
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 700 }}>
                        {imported} imported{skipped > 0 ? `, ${skipped} skipped` : ""}
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-faint)", marginTop: 2 }}>
                        {source} · {h.user?.name ?? "Unknown user"} · {formatDateTime(h.createdAt)}
                      </div>
                    </div>
                    {rows.length > 0 && (
                      <span style={{ color: "var(--text-faint)", flexShrink: 0, display: "flex" }}>
                        {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                      </span>
                    )}
                  </button>

                  {isOpen && rows.length > 0 && (
                    <div className="expand-row-anim" style={{ padding: "0 14px 12px 60px", display: "flex", flexDirection: "column", gap: 6 }}>
                      {rows.map((r, i) => (
                        <div
                          key={i}
                          style={{
                            fontSize: 12.5,
                            padding: "8px 10px",
                            border: "1px solid var(--border-soft)",
                            borderRadius: "var(--radius-sm)",
                            background: "var(--paper)",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "4px 10px",
                          }}
                        >
                          <span style={{ fontWeight: 700 }}>{r.customerName || r.phoneNumber}</span>
                          {r.customerName && <span style={{ color: "var(--text-faint)" }}>{r.phoneNumber}</span>}
                          <span style={{ color: "var(--text-faint)" }}>· {CATEGORY_LABELS[r.businessCategory] ?? r.businessCategory}</span>
                          <span style={{ color: "var(--text-faint)" }}>· {formatDate(r.callDate)}</span>
                          {r.location && <span style={{ color: "var(--text-faint)" }}>· {r.location}</span>}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, label }: { active: boolean; onClick: () => void; icon: typeof Camera; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 7,
        padding: "9px 16px",
        border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
        background: active ? "var(--brand-soft)" : "var(--paper-raised)",
        color: active ? "var(--brand-strong)" : "var(--text-soft)",
        borderRadius: "var(--radius-sm)",
        fontSize: 13.5,
        fontWeight: 700,
      }}
    >
      <Icon size={15} />
      {label}
    </button>
  );
}

type Toast = ReturnType<typeof useToast>;

function ExcelImportPanel({ toast, onImported }: { toast: Toast; onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function handleDownloadTemplate() {
    setDownloadingTemplate(true);
    try {
      const blob = await api.import.template();
      downloadBlob(blob, "historical-calls-template.xlsx");
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Could not download the template", "error");
    } finally {
      setDownloadingTemplate(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setProgress(null);
    try {
      const parsed = await api.import.parseExcel(file);
      if (parsed.rows.length === 0) {
        setResult({ imported: 0, skipped: 0, errors: parsed.errors });
        toast.show("No rows were imported — check the errors below.", "error");
        return;
      }

      setProgress({ done: 0, total: parsed.rows.length });
      const commitRes = await commitRowsInBatches(
        parsed.rows.map(excelRowToCommitInput),
        parsed.rows.map((r) => r.sourceRow),
        "excel",
        (done, total) => setProgress({ done, total }),
      );
      const combined: ImportResult = {
        imported: commitRes.imported,
        skipped: commitRes.skipped + parsed.errors.length,
        errors: [...parsed.errors, ...commitRes.errors],
      };
      setResult(combined);
      toast.show(
        combined.imported > 0 ? `Imported ${combined.imported} call${combined.imported === 1 ? "" : "s"}.` : "No rows were imported — check the errors below.",
        combined.imported > 0 ? "success" : "error",
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Import failed", "error");
    } finally {
      setUploading(false);
      setProgress(null);
    }
  }

  return (
    <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
      <div style={cardStyle}>
        <SectionLabel>1. Get the template</SectionLabel>
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>
          Download the Excel template, fill in one row per historical call, then upload it below. Column headers just need to roughly
          match the template (e.g. any header containing "phone" is read as the phone number) — order doesn't matter.
        </p>
        <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} style={secondaryButtonStyle}>
          {downloadingTemplate ? <Spinner size={15} /> : <Download size={15} />}
          {downloadingTemplate ? "Preparing…" : "Download template (.xlsx)"}
        </button>

        <div style={{ height: 1, background: "var(--border-soft)", margin: "22px 0" }} />

        <SectionLabel>2. Upload your filled-in file</SectionLabel>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "26px 16px",
            border: "1.5px dashed var(--border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            textAlign: "center",
            background: "var(--paper)",
          }}
        >
          <FileSpreadsheet size={22} color="var(--text-faint)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>{file ? file.name : "Choose an .xlsx file"}</span>
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Up to 1,000 rows per file, 5MB max</span>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} style={{ display: "none" }} />
        </label>

        <button
          onClick={handleUpload}
          disabled={!file || uploading}
          style={{ ...primaryButtonStyle, marginTop: 14, opacity: !file || uploading ? 0.6 : 1 }}
        >
          {uploading ? <Spinner size={16} color="var(--on-brand)" trackColor="rgba(255,255,255,0.35)" /> : <Upload size={16} />}
          {progress ? `Importing… (${progress.done}/${progress.total})` : uploading ? "Reading file…" : "Upload & import"}
        </button>
      </div>
      <ProgressOverlay open={progress !== null} title="Importing calls…" done={progress?.done ?? 0} total={progress?.total ?? 0} />

      <div style={cardStyle}>
        <SectionLabel>Result</SectionLabel>
        {!result ? (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
            Nothing imported yet this session. Rows are matched to customers by phone number and to products by name — same
            matching logic the live AI pipeline uses — so imported calls show up correctly in Reports and product analytics too.
          </p>
        ) : (
          <ImportResultView result={result} />
        )}
      </div>
    </div>
  );
}

function ImportResultView({ result }: { result: ImportResult }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 12 }}>
        <StatPill icon={CheckCircle2} color="var(--success, #1a7f37)" label="Imported" value={result.imported} />
        <StatPill icon={AlertTriangle} color="var(--danger, #c0392b)" label="Skipped" value={result.skipped} />
      </div>

      {result.errors.length > 0 && (
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-soft)", marginBottom: 8 }}>Row issues</div>
          <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
            {result.errors.map((e, i) => (
              <div
                key={i}
                style={{ fontSize: 12.5, padding: "8px 10px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)", background: "var(--paper)" }}
              >
                <span style={{ fontWeight: 700 }}>Row {e.row}:</span> {e.reason}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

interface DraftRow {
  key: string;
  sourceFile: string;
  rawNoteText: string;
  customerName: string;
  phoneNumber: string;
  businessCategory: BusinessCategory | "";
  callDate: string;
  employeeId: string;
  carMake: string;
  carModel: string;
  carVariant: string;
  location: string;
  productsDiscussed: string;
  customerRequirements: string;
  budget: string;
  followUpRequired: boolean;
  followUpDate: string;
  summary: string;
  sentiment: SentimentType | "";
}

let draftKeySeq = 0;

function toDraftRow(sourceFile: string, entry: ExtractedEntry, employees: Employee[]): DraftRow {
  const matchedEmployee = entry.employeeName
    ? employees.find((e) => e.name.toLowerCase() === entry.employeeName!.trim().toLowerCase())
    : undefined;
  const safeDate = (value: string | null) => {
    if (!value) return "";
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
  };
  return {
    key: `draft-${draftKeySeq++}`,
    sourceFile,
    rawNoteText: entry.rawNoteText,
    customerName: entry.customerName ?? "",
    phoneNumber: entry.phoneNumber ?? "",
    businessCategory: entry.businessCategory ?? "",
    callDate: safeDate(entry.callDate),
    employeeId: matchedEmployee?.id ?? "",
    carMake: entry.carMake ?? "",
    carModel: entry.carModel ?? "",
    carVariant: entry.carVariant ?? "",
    location: entry.location ?? "",
    productsDiscussed: entry.productsDiscussed.join(", "),
    customerRequirements: entry.customerRequirements ?? "",
    budget: entry.budget != null ? String(entry.budget) : "",
    followUpRequired: entry.followUpRequired,
    followUpDate: safeDate(entry.followUpDate),
    summary: entry.summary ?? "",
    sentiment: entry.sentiment ?? "",
  };
}

function PhotoImportPanel({ toast, onImported }: { toast: Toast; onImported: () => void }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [scanning, setScanning] = useState(false);
  const [scanErrors, setScanErrors] = useState<{ sourceFile: string; error: string }[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [committing, setCommitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);

  useEffect(() => {
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
  }, []);

  function handleFilesChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFiles(Array.from(e.target.files ?? []));
  }

  async function handleScan() {
    if (files.length === 0) return;
    setScanning(true);
    setResult(null);
    setDrafts([]);
    setScanErrors([]);
    try {
      const results = await api.import.extractPhotos(files);
      const newDrafts: DraftRow[] = [];
      const errors: { sourceFile: string; error: string }[] = [];
      for (const r of results) {
        if (r.error) {
          errors.push({ sourceFile: r.sourceFile, error: r.error });
          continue;
        }
        for (const entry of r.entries) newDrafts.push(toDraftRow(r.sourceFile, entry, employees));
      }
      setDrafts(newDrafts);
      setScanErrors(errors);
      if (newDrafts.length === 0) {
        toast.show("No entries were recognized in these photos.", "error");
      } else {
        toast.show(`Recognized ${newDrafts.length} entr${newDrafts.length === 1 ? "y" : "ies"} — review before importing.`, "success");
      }
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Scan failed", "error");
    } finally {
      setScanning(false);
    }
  }

  function updateDraft(key: string, patch: Partial<DraftRow>) {
    setDrafts((prev) => prev.map((d) => (d.key === key ? { ...d, ...patch } : d)));
  }

  function removeDraft(key: string) {
    setDrafts((prev) => prev.filter((d) => d.key !== key));
  }

  const invalidCount = drafts.filter((d) => !d.phoneNumber.trim()).length;

  async function handleCommit() {
    if (drafts.length === 0) return;
    if (invalidCount > 0) {
      toast.show(`${invalidCount} row${invalidCount === 1 ? "" : "s"} still need${invalidCount === 1 ? "s" : ""} a phone number before importing.`, "error");
      return;
    }
    setCommitting(true);
    setProgress({ done: 0, total: drafts.length });
    try {
      const rows: CommitPhotoRowInput[] = drafts.map((d) => ({
        phoneNumber: d.phoneNumber.trim(),
        businessCategory: d.businessCategory || undefined,
        callDate: d.callDate || undefined,
        customerName: d.customerName.trim() || undefined,
        employeeId: d.employeeId || undefined,
        carMake: d.carMake.trim() || undefined,
        carModel: d.carModel.trim() || undefined,
        carVariant: d.carVariant.trim() || undefined,
        location: d.location.trim() || undefined,
        productsDiscussed: d.productsDiscussed.split(",").map((p) => p.trim()).filter(Boolean),
        customerRequirements: d.customerRequirements.trim() || undefined,
        budget: d.budget ? Number(d.budget) : undefined,
        followUpRequired: d.followUpRequired,
        followUpDate: d.followUpDate || undefined,
        summary: d.summary.trim() || undefined,
        sentiment: d.sentiment || undefined,
      }));
      const res = await commitRowsInBatches(
        rows,
        rows.map((_, i) => i + 1),
        "photo_ocr",
        (done, total) => setProgress({ done, total }),
      );
      setResult(res);
      toast.show(res.imported > 0 ? `Imported ${res.imported} call${res.imported === 1 ? "" : "s"}.` : "Nothing was imported — check the errors below.", res.imported > 0 ? "success" : "error");
      setDrafts([]);
      setFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onImported();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Import failed", "error");
    } finally {
      setCommitting(false);
      setProgress(null);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      <div style={cardStyle}>
        <SectionLabel>1. Upload photos of your notes</SectionLabel>
        <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>
          Photograph each note page (single entries or ledger-style pages with several entries both work) and upload them here.
          Claude reads the handwriting and pulls out structured fields — anything illegible is left blank for you to fill in or
          mark Unknown. Nothing is saved until you review and confirm below.
        </p>
        <label
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            padding: "26px 16px",
            border: "1.5px dashed var(--border)",
            borderRadius: "var(--radius-sm)",
            cursor: "pointer",
            textAlign: "center",
            background: "var(--paper)",
          }}
        >
          <Camera size={22} color="var(--text-faint)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            {files.length > 0 ? `${files.length} photo${files.length === 1 ? "" : "s"} selected` : "Choose photos"}
          </span>
          <span style={{ fontSize: 11.5, color: "var(--text-faint)" }}>Up to 30 photos per batch, 10MB each</span>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handleFilesChange} style={{ display: "none" }} />
        </label>

        <button onClick={handleScan} disabled={files.length === 0 || scanning} style={{ ...primaryButtonStyle, marginTop: 14, opacity: files.length === 0 || scanning ? 0.6 : 1 }}>
          {scanning ? <Spinner size={16} color="var(--on-brand)" trackColor="rgba(255,255,255,0.35)" /> : <ScanLine size={16} />}
          {scanning ? `Scanning ${files.length} photo${files.length === 1 ? "" : "s"}… this can take a minute` : "Scan photos"}
        </button>
      </div>

      {scanErrors.length > 0 && (
        <div style={{ ...cardStyle, borderColor: "var(--coral)" }}>
          <SectionLabel>Couldn't read {scanErrors.length} photo{scanErrors.length === 1 ? "" : "s"}</SectionLabel>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {scanErrors.map((e, i) => (
              <div key={i} style={{ fontSize: 12.5, color: "var(--coral)" }}>
                <span style={{ fontWeight: 700 }}>{e.sourceFile}:</span> {e.error}
              </div>
            ))}
          </div>
        </div>
      )}

      {drafts.length > 0 && (
        <div style={cardStyle}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
            <SectionLabel>2. Review {drafts.length} recognized entr{drafts.length === 1 ? "y" : "ies"}</SectionLabel>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 16 }}>
            Compare each card's fields against the original note (the quoted text is Claude's raw reading) and fix anything wrong.
            <strong> A phone number is required</strong> to import a row — everything else, including category and date, can stay Unknown.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {drafts.map((d) => (
              <DraftCard key={d.key} draft={d} employees={employees} onChange={(patch) => updateDraft(d.key, patch)} onRemove={() => removeDraft(d.key)} />
            ))}
          </div>

          <button
            onClick={handleCommit}
            disabled={committing}
            style={{ ...primaryButtonStyle, marginTop: 18, opacity: committing ? 0.7 : 1 }}
          >
            {committing ? <Spinner size={16} color="var(--on-brand)" trackColor="rgba(255,255,255,0.35)" /> : <Upload size={16} />}
            {progress ? `Importing… (${progress.done}/${progress.total})` : `Import ${drafts.length} row${drafts.length === 1 ? "" : "s"}`}
            {invalidCount > 0 && !committing ? ` (${invalidCount} need attention)` : ""}
          </button>
        </div>
      )}
      <ProgressOverlay open={progress !== null} title="Importing calls…" done={progress?.done ?? 0} total={progress?.total ?? 0} />

      {result && (
        <div style={cardStyle}>
          <SectionLabel>Result</SectionLabel>
          <ImportResultView result={result} />
        </div>
      )}
    </div>
  );
}

function DraftCard({
  draft,
  employees,
  onChange,
  onRemove,
}: {
  draft: DraftRow;
  employees: Employee[];
  onChange: (patch: Partial<DraftRow>) => void;
  onRemove: () => void;
}) {
  const needsAttention = !draft.phoneNumber.trim();
  return (
    <div
      className="fade-in-up"
      style={{
        border: `1px solid ${needsAttention ? "var(--amber)" : "var(--border)"}`,
        borderRadius: "var(--radius-sm)",
        padding: 14,
        background: "var(--paper)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10, gap: 10 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontSize: 11.5, color: "var(--text-faint)", marginBottom: 2 }}>{draft.sourceFile}</div>
          {draft.rawNoteText && (
            <div style={{ fontSize: 12, color: "var(--text-soft)", fontStyle: "italic", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
              "{draft.rawNoteText}"
            </div>
          )}
        </div>
        <button onClick={onRemove} aria-label="Remove this entry" style={{ background: "none", border: "none", color: "var(--text-faint)", flexShrink: 0, padding: 4 }}>
          <X size={15} />
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 10 }}>
        <Field label="Customer name">
          <input style={inputStyle} value={draft.customerName} onChange={(e) => onChange({ customerName: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Phone *">
          <input style={{ ...inputStyle, borderColor: !draft.phoneNumber.trim() ? "var(--amber)" : "var(--border)" }} value={draft.phoneNumber} onChange={(e) => onChange({ phoneNumber: e.target.value })} placeholder="Required" />
        </Field>
        <Field label="Category">
          <select style={inputStyle} value={draft.businessCategory} onChange={(e) => onChange({ businessCategory: e.target.value as BusinessCategory })}>
            <option value="">Unknown</option>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
        <Field label="Call date">
          <input type="date" style={inputStyle} value={draft.callDate} onChange={(e) => onChange({ callDate: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Employee">
          <select style={inputStyle} value={draft.employeeId} onChange={(e) => onChange({ employeeId: e.target.value })}>
            <option value="">Unassigned</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>{emp.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Car make">
          <input style={inputStyle} value={draft.carMake} onChange={(e) => onChange({ carMake: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Car model">
          <input style={inputStyle} value={draft.carModel} onChange={(e) => onChange({ carModel: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Variant">
          <input style={inputStyle} value={draft.carVariant} onChange={(e) => onChange({ carVariant: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Location">
          <input style={inputStyle} value={draft.location} onChange={(e) => onChange({ location: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Budget (₹)">
          <input type="number" style={inputStyle} value={draft.budget} onChange={(e) => onChange({ budget: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Sentiment">
          <select style={inputStyle} value={draft.sentiment} onChange={(e) => onChange({ sentiment: e.target.value as SentimentType })}>
            <option value="">Unknown</option>
            {SENTIMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </Field>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 10, marginTop: 10 }}>
        <Field label="Products discussed (comma-separated)">
          <input style={inputStyle} value={draft.productsDiscussed} onChange={(e) => onChange({ productsDiscussed: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Customer requirements">
          <input style={inputStyle} value={draft.customerRequirements} onChange={(e) => onChange({ customerRequirements: e.target.value })} placeholder="Unknown" />
        </Field>
        <Field label="Summary">
          <input style={inputStyle} value={draft.summary} onChange={(e) => onChange({ summary: e.target.value })} placeholder="Unknown" />
        </Field>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 12 }}>
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)" }}>
          <input type="checkbox" checked={draft.followUpRequired} onChange={(e) => onChange({ followUpRequired: e.target.checked })} style={{ accentColor: "var(--brand)" }} />
          Follow-up required
        </label>
        {draft.followUpRequired && (
          <input type="date" style={{ ...inputStyle, width: "auto" }} value={draft.followUpDate} onChange={(e) => onChange({ followUpDate: e.target.value })} />
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 11.5, fontWeight: 600, color: "var(--text-faint)", minWidth: 0 }}>
      {label}
      {children}
    </label>
  );
}

function StatPill({ icon: Icon, color, label, value }: { icon: typeof CheckCircle2; color: string; label: string; value: number }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", border: "1px solid var(--border-soft)", borderRadius: "var(--radius-sm)" }}>
      <Icon size={18} color={color} />
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{value}</div>
        <div style={{ fontSize: 11.5, color: "var(--text-faint)" }}>{label}</div>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
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

const primaryButtonStyle = {
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
} as const;

const secondaryButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  padding: "10px 16px",
  background: "var(--paper)",
  color: "var(--text-soft)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 700,
} as const;

const inputStyle = {
  width: "100%",
  padding: "7px 9px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper-raised)",
  fontSize: 12.5,
} as const;
