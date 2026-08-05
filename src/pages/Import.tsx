import { useRef, useState } from "react";
import { Download, FileSpreadsheet, Upload, AlertTriangle, CheckCircle2 } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { api, ApiError, downloadBlob, type ImportResult } from "../lib/api";
import { useToast } from "../components/ui/Toast";

export default function Import() {
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
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
    try {
      const res = await api.import.calls(file);
      setResult(res);
      toast.show(
        res.imported > 0 ? `Imported ${res.imported} call${res.imported === 1 ? "" : "s"}.` : "No rows were imported — check the errors below.",
        res.imported > 0 ? "success" : "error",
      );
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Import failed", "error");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Import"
        title="Import historical data"
        description="Bulk-load past customer calls from a spreadsheet — they'll show up in Calls, Reports, and Follow-ups right alongside calls that came in live through the AI pipeline."
      />

      <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "1fr 1.3fr", gap: 20, alignItems: "start" }}>
        <div style={cardStyle}>
          <SectionLabel>1. Get the template</SectionLabel>
          <p style={{ fontSize: 13, color: "var(--text-faint)", marginBottom: 14 }}>
            Download the Excel template, fill in one row per historical call, then upload it below. Column headers just need to roughly
            match the template (e.g. any header containing "phone" is read as the phone number) — order doesn't matter.
          </p>
          <button onClick={handleDownloadTemplate} disabled={downloadingTemplate} style={secondaryButtonStyle}>
            <Download size={15} className={downloadingTemplate ? "spin" : undefined} />
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
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
          </label>

          <button
            onClick={handleUpload}
            disabled={!file || uploading}
            style={{ ...primaryButtonStyle, marginTop: 14, opacity: !file || uploading ? 0.6 : 1 }}
          >
            <Upload size={16} className={uploading ? "spin" : undefined} />
            {uploading ? "Importing…" : "Upload & import"}
          </button>
        </div>

        <div style={cardStyle}>
          <SectionLabel>Result</SectionLabel>
          {!result ? (
            <p style={{ fontSize: 13, color: "var(--text-faint)" }}>
              Nothing imported yet this session. Rows are matched to customers by phone number and to products by name — same
              matching logic the live AI pipeline uses — so imported calls show up correctly in Reports and product analytics too.
            </p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", gap: 12 }}>
                <StatPill icon={CheckCircle2} color="var(--success, #1a7f37)" label="Imported" value={result.imported} />
                <StatPill icon={AlertTriangle} color="var(--danger, #c0392b)" label="Skipped" value={result.skipped} />
              </div>

              {result.errors.length > 0 && (
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text-soft)", marginBottom: 8 }}>
                    Row issues
                  </div>
                  <div style={{ maxHeight: 320, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                    {result.errors.map((e, i) => (
                      <div
                        key={i}
                        style={{
                          fontSize: 12.5,
                          padding: "8px 10px",
                          border: "1px solid var(--border-soft)",
                          borderRadius: "var(--radius-sm)",
                          background: "var(--paper)",
                        }}
                      >
                        <span style={{ fontWeight: 700 }}>Row {e.row}:</span> {e.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
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
