import { useEffect, useState } from "react";
import { Phone, Clock, ShieldAlert, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError, type CoverageInput } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import type { Employee, NumberCoverage } from "../types";

const EMPTY_FORM: CoverageInput = { phoneNumber: "", employeeId: "", startHour: undefined, endHour: undefined, isBackup: false };

function pad(h: number) {
  return String(h).padStart(2, "0") + ":00";
}

function windowLabel(row: NumberCoverage): string {
  if (row.isBackup) return "Backup";
  if (row.startHour === null || row.endHour === null) return "Always";
  const wraps = row.endHour < row.startHour;
  return `${pad(row.startHour)} – ${pad(row.endHour)} IST${wraps ? " (next day)" : ""}`;
}

export default function TeamCoverage() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const toast = useToast();

  const [rows, setRows] = useState<NumberCoverage[] | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<NumberCoverage | null>(null);
  const [form, setForm] = useState<CoverageInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    api.coverage
      .list()
      .then(setRows)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load team coverage", "error"));
  }

  useEffect(() => {
    load();
    api.employees.list().then(setEmployees).catch(() => setEmployees([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(row: NumberCoverage) {
    setEditing(row);
    setForm({
      phoneNumber: row.phoneNumber,
      employeeId: row.employeeId,
      startHour: row.startHour ?? undefined,
      endHour: row.endHour ?? undefined,
      isBackup: row.isBackup,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.phoneNumber.trim() || !form.employeeId) {
      toast.show("Phone number and employee are required.", "error");
      return;
    }
    setSaving(true);
    const dto: CoverageInput = {
      phoneNumber: form.phoneNumber.trim(),
      employeeId: form.employeeId,
      startHour: form.isBackup ? undefined : form.startHour,
      endHour: form.isBackup ? undefined : form.endHour,
      isBackup: form.isBackup,
    };
    try {
      if (editing) {
        await api.coverage.update(editing.id, dto);
        toast.show("Coverage updated.", "success");
      } else {
        await api.coverage.create(dto);
        toast.show("Coverage added.", "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save coverage", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(row: NumberCoverage) {
    if (!window.confirm(`Remove ${row.employee.name} from ${row.phoneNumber}?`)) return;
    setDeletingId(row.id);
    try {
      await api.coverage.remove(row.id);
      toast.show("Coverage removed.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to remove coverage", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const groups = new Map<string, NumberCoverage[]>();
  for (const row of rows ?? []) {
    const list = groups.get(row.phoneNumber) ?? [];
    list.push(row);
    groups.set(row.phoneNumber, list);
  }
  // Primary/scheduled rows before backup rows within each number.
  for (const list of groups.values()) {
    list.sort((a, b) => Number(a.isBackup) - Number(b.isBackup) || (a.startHour ?? -1) - (b.startHour ?? -1));
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Team coverage"
        description="Who handles each line, and when -- so it's clear who a call routes to before anyone has to guess."
        actions={
          isAdmin ? (
            <button onClick={openCreate} style={primaryButtonStyle}>
              <Plus size={15} /> New coverage
            </button>
          ) : undefined
        }
      />

      {formOpen && (
        <CoverageForm
          form={form}
          setForm={setForm}
          employees={employees}
          editing={Boolean(editing)}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16, maxWidth: 640 }}>
        {rows === null && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={110} />)}

        {rows !== null && groups.size === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No coverage configured yet.</p>
        )}

        {[...groups.entries()].map(([phoneNumber, list]) => (
          <div key={phoneNumber} className="fade-in-up" style={cardStyle}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderBottom: "1px solid var(--border-soft)" }}>
              <Phone size={15} color="var(--brand-strong)" />
              <span className="mono" style={{ fontSize: 14, fontWeight: 700 }}>{phoneNumber}</span>
            </div>
            <div>
              {list.map((row) => (
                <div
                  key={row.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 18px",
                    borderBottom: "1px solid var(--border-soft)",
                  }}
                >
                  {row.isBackup ? (
                    <ShieldAlert size={14} color="var(--amber)" />
                  ) : (
                    <Clock size={14} color="var(--text-faint)" />
                  )}
                  <span style={{ flex: 1, fontSize: 13.5, fontWeight: 600 }}>{row.employee.name}</span>
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 600,
                      color: row.isBackup ? "var(--amber)" : "var(--text-soft)",
                    }}
                  >
                    {windowLabel(row)}
                  </span>
                  {isAdmin && (
                    <span style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => openEdit(row)} aria-label={`Edit ${row.employee.name}`} title="Edit" style={iconButtonStyle}>
                        <Pencil size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(row)}
                        disabled={deletingId === row.id}
                        aria-label={`Remove ${row.employee.name}`}
                        title="Remove"
                        style={{ ...iconButtonStyle, color: "var(--coral)" }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CoverageForm({
  form,
  setForm,
  employees,
  editing,
  saving,
  onSave,
  onCancel,
}: {
  form: CoverageInput;
  setForm: (updater: (f: CoverageInput) => CoverageInput) => void;
  employees: Employee[];
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit coverage" : "New coverage"}</div>
        <button onClick={onCancel} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
        <label style={fieldLabelStyle}>
          Phone number
          <input
            style={inputStyle}
            value={form.phoneNumber}
            onChange={(e) => setForm((f) => ({ ...f, phoneNumber: e.target.value }))}
            placeholder="+918428280104"
          />
        </label>
        <label style={fieldLabelStyle}>
          Employee
          <select style={inputStyle} value={form.employeeId} onChange={(e) => setForm((f) => ({ ...f, employeeId: e.target.value }))}>
            <option value="">Select…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 600, marginBottom: 16 }}>
        <input
          type="checkbox"
          checked={form.isBackup ?? false}
          onChange={(e) => setForm((f) => ({ ...f, isBackup: e.target.checked }))}
          style={{ accentColor: "var(--brand)" }}
        />
        Backup only (not auto-assigned -- shown for staff to call manually)
      </label>
      {!form.isBackup && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <label style={fieldLabelStyle}>
            Start hour (IST, 0-23)
            <input
              type="number"
              min={0}
              max={23}
              style={inputStyle}
              value={form.startHour ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, startHour: e.target.value === "" ? undefined : Number(e.target.value) }))}
              placeholder="Leave blank for always"
            />
          </label>
          <label style={fieldLabelStyle}>
            End hour (IST, 0-23)
            <input
              type="number"
              min={0}
              max={23}
              style={inputStyle}
              value={form.endHour ?? ""}
              onChange={(e) => setForm((f) => ({ ...f, endHour: e.target.value === "" ? undefined : Number(e.target.value) }))}
              placeholder="Leave blank for always"
            />
          </label>
        </div>
      )}
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add coverage"}
        </button>
        <button onClick={onCancel} style={secondaryButtonStyle}>
          Cancel
        </button>
      </div>
    </div>
  );
}

const cardStyle = {
  background: "var(--paper-raised)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-md)",
  boxShadow: "var(--shadow-card)",
  overflow: "hidden",
} as const;

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
  minWidth: 0,
} as const;

const inputStyle = {
  width: "100%",
  padding: "8px 10px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper)",
  fontSize: 13,
  fontWeight: 400,
} as const;

const primaryButtonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  padding: "9px 15px",
  background: "var(--brand)",
  color: "var(--on-brand)",
  border: "none",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 700,
} as const;

const secondaryButtonStyle = {
  padding: "9px 15px",
  background: "var(--paper)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  fontSize: 13.5,
  fontWeight: 600,
} as const;

const iconButtonStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: 26,
  height: 26,
  background: "none",
  border: "none",
  borderRadius: 6,
  color: "var(--text-soft)",
} as const;
