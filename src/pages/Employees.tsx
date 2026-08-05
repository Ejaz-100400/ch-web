import { useEffect, useState } from "react";
import { Pencil, Plus, ShieldAlert, Trash2, UserRound, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { FilterBar, SearchInput, FilterSelect, ClearFiltersButton } from "../components/ui/FilterBar";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError, type EmployeeInput } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import type { Employee } from "../types";

const STATUS_OPTIONS = [
  { value: "true", label: "Active" },
  { value: "false", label: "Inactive" },
];

const EMPTY_FORM: EmployeeInput = { name: "", email: "", phone: "", role: "", active: true };

export default function Employees() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [form, setForm] = useState<EmployeeInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.employees
      .list(statusFilter === "" ? undefined : statusFilter === "true")
      .then(setEmployees)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load employees", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  if (appUser && appUser.role !== "admin") {
    return (
      <div>
        <PageHeader eyebrow="Employees" title="Employee management" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Employee management requires admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin to change your role if you need this.</p>
        </div>
      </div>
    );
  }

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setForm({
      name: employee.name,
      email: employee.email ?? "",
      phone: employee.phone ?? "",
      role: employee.role ?? "",
      active: employee.active,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.show("Name is required.", "error");
      return;
    }
    setSaving(true);
    const dto: EmployeeInput = {
      name: form.name.trim(),
      email: form.email?.trim() || undefined,
      phone: form.phone?.trim() || undefined,
      role: form.role?.trim() || undefined,
      active: form.active,
    };
    try {
      if (editing) {
        await api.employees.update(editing.id, dto);
        toast.show("Employee updated.", "success");
      } else {
        await api.employees.create(dto);
        toast.show("Employee added.", "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save employee", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(employee: Employee) {
    if (!window.confirm(`Delete ${employee.name}? This can't be undone.`)) return;
    setDeletingId(employee.id);
    try {
      await api.employees.remove(employee.id);
      toast.show("Employee deleted.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to delete employee", "error");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = employees.filter((e) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return (
      e.name.toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.phone ?? "").toLowerCase().includes(q)
    );
  });

  const hasActiveFilters = Boolean(search || statusFilter);

  return (
    <div>
      <PageHeader
        eyebrow="Employees"
        title="Employee management"
        description="Manage the sales team members calls and follow-ups get assigned to."
        actions={
          <button onClick={openCreate} style={primaryButtonStyle}>
            <Plus size={15} /> New employee
          </button>
        }
      />

      {formOpen && (
        <EmployeeForm
          form={form}
          setForm={setForm}
          editing={Boolean(editing)}
          saving={saving}
          onSave={handleSave}
          onCancel={() => setFormOpen(false)}
        />
      )}

      <FilterBar>
        <SearchInput value={search} onChange={setSearch} placeholder="Search by name, email or phone" />
        <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={STATUS_OPTIONS} />
        {hasActiveFilters && (
          <ClearFiltersButton
            onClick={() => {
              setSearch("");
              setStatusFilter("");
            }}
          />
        )}
      </FilterBar>

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? "Loading…" : `${filtered.length} employee${filtered.length === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
      <div className="table-scroll">
        <div style={{ minWidth: 680 }}>
        <div
          className="mono"
          style={{
            display: "grid",
            gridTemplateColumns: "1.6fr 1.6fr 1.2fr 1fr 90px 80px",
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
          <span>Name</span>
          <span>Email</span>
          <span>Phone</span>
          <span>Role</span>
          <span>Status</span>
          <span>Actions</span>
        </div>

        {loading && <SkeletonRows rows={5} />}

        {!loading &&
          filtered.map((e) => (
            <div
              key={e.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1.6fr 1.2fr 1fr 90px 80px",
                alignItems: "center",
                padding: "12px 18px",
                borderBottom: "1px solid var(--border-soft)",
                fontSize: 13,
              }}
            >
              <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
              <span style={{ color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.email ?? "—"}</span>
              <span className="mono" style={{ color: "var(--text-soft)", fontSize: 12.5 }}>{e.phone ?? "—"}</span>
              <span style={{ color: "var(--text-soft)" }}>{e.role ?? "—"}</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: e.active ? "var(--brand-strong)" : "var(--text-faint)" }}>
                {e.active ? "Active" : "Inactive"}
              </span>
              <span style={{ display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(e)} aria-label={`Edit ${e.name}`} title="Edit" style={iconButtonStyle}>
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(e)}
                  disabled={deletingId === e.id}
                  aria-label={`Delete ${e.name}`}
                  title="Delete"
                  style={{ ...iconButtonStyle, color: "var(--coral)" }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            </div>
          ))}
        </div>
      </div>

        {!loading && filtered.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <UserRound size={22} style={{ marginBottom: 8, opacity: 0.5 }} />
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No employees match this search</p>
            <p style={{ fontSize: 13 }}>Try different filters, or add a new employee.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function EmployeeForm({
  form,
  setForm,
  editing,
  saving,
  onSave,
  onCancel,
}: {
  form: EmployeeInput;
  setForm: (updater: (f: EmployeeInput) => EmployeeInput) => void;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit employee" : "New employee"}</div>
        <button onClick={onCancel} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
          <X size={15} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
        <label style={fieldLabelStyle}>
          Name
          <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
        </label>
        <label style={fieldLabelStyle}>
          Role
          <input style={inputStyle} placeholder="e.g. sales" value={form.role ?? ""} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))} />
        </label>
        <label style={fieldLabelStyle}>
          Email
          <input type="email" style={inputStyle} value={form.email ?? ""} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
        </label>
        <label style={fieldLabelStyle}>
          Phone
          <input style={inputStyle} value={form.phone ?? ""} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
        </label>
      </div>
      <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-soft)", marginBottom: 16 }}>
        <input type="checkbox" checked={form.active ?? true} onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))} style={{ accentColor: "var(--brand)" }} />
        Active
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add employee"}
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
} as const;

const fieldLabelStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 5,
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-soft)",
} as const;

const inputStyle = {
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
