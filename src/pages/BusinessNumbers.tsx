import { useEffect, useState } from "react";
import { Phone, Pencil, Plus, Trash2, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { CategoryBadge } from "../components/ui/StatusBadge";
import { Skeleton } from "../components/ui/Skeleton";
import { api, ApiError, type BusinessNumberInput } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import type { BusinessNumber } from "../types";

const CATEGORY_OPTIONS = [
  { value: "car_glasses", label: "Car Glasses" },
  { value: "car_modifications", label: "Car Modifications" },
];

const EMPTY_FORM: BusinessNumberInput = { phoneNumber: "", exophoneNumber: "", whatsappPhoneNumberId: "", category: "car_glasses", label: "" };

export default function BusinessNumbers() {
  const { appUser } = useAuth();
  const isAdmin = appUser?.role === "admin";
  const toast = useToast();

  const [numbers, setNumbers] = useState<BusinessNumber[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<BusinessNumber | null>(null);
  const [form, setForm] = useState<BusinessNumberInput>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  function load() {
    api.businessNumbers
      .list()
      .then(setNumbers)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load business numbers", "error"));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setFormOpen(true);
  }

  function openEdit(n: BusinessNumber) {
    setEditing(n);
    setForm({
      phoneNumber: n.number,
      exophoneNumber: n.exophoneNumber ?? "",
      whatsappPhoneNumberId: n.whatsappPhoneNumberId ?? "",
      category: n.category === "unknown" ? "car_glasses" : n.category,
      label: n.label,
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.phoneNumber.trim() || !form.label.trim()) {
      toast.show("Phone number and label are required.", "error");
      return;
    }
    setSaving(true);
    const dto: BusinessNumberInput = {
      phoneNumber: form.phoneNumber.trim(),
      exophoneNumber: form.exophoneNumber?.trim() || undefined,
      whatsappPhoneNumberId: form.whatsappPhoneNumberId?.trim() || undefined,
      category: form.category,
      label: form.label.trim(),
    };
    try {
      if (editing) {
        await api.businessNumbers.update(editing.id, dto);
        toast.show("Business number updated.", "success");
      } else {
        await api.businessNumbers.create(dto);
        toast.show("Business number added.", "success");
      }
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to save business number", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(n: BusinessNumber) {
    if (!window.confirm(`Remove ${n.number} (${n.label})? Calls to this number will stop being tagged with a category.`)) return;
    setDeletingId(n.id);
    try {
      await api.businessNumbers.remove(n.id);
      toast.show("Business number removed.", "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to remove business number", "error");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Settings"
        title="Business phone numbers"
        description="The lines inbound calls are routed through, and which category each one resolves to."
        actions={
          isAdmin ? (
            <button onClick={openCreate} style={primaryButtonStyle}>
              <Plus size={15} /> New number
            </button>
          ) : undefined
        }
      />

      {formOpen && (
        <BusinessNumberForm form={form} setForm={setForm} editing={Boolean(editing)} saving={saving} onSave={handleSave} onCancel={() => setFormOpen(false)} />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 560 }}>
        {numbers === null &&
          Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} height={64} />)}

        {numbers?.map((n) => (
          <div
            key={n.id}
            className="fade-in-up"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: "16px 18px",
              background: "var(--paper-raised)",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <span
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                width: 38,
                height: 38,
                borderRadius: "50%",
                background: "var(--brand-soft)",
                flexShrink: 0,
              }}
            >
              <Phone size={17} color="var(--brand-strong)" />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="mono" style={{ fontSize: 15, fontWeight: 700 }}>{n.number}</div>
              <div style={{ fontSize: 12.5, color: "var(--text-soft)" }}>{n.label}</div>
              {n.exophoneNumber && (
                <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  ExoPhone: {n.exophoneNumber}
                </div>
              )}
              {n.whatsappPhoneNumberId && (
                <div className="mono" style={{ fontSize: 11, color: "var(--text-faint)", marginTop: 2 }}>
                  WhatsApp Phone Number ID: {n.whatsappPhoneNumberId}
                </div>
              )}
            </div>
            <CategoryBadge category={n.category} />
            {isAdmin && (
              <span style={{ display: "flex", gap: 4 }}>
                <button onClick={() => openEdit(n)} aria-label={`Edit ${n.label}`} title="Edit" style={iconButtonStyle}>
                  <Pencil size={14} />
                </button>
                <button
                  onClick={() => handleDelete(n)}
                  disabled={deletingId === n.id}
                  aria-label={`Delete ${n.label}`}
                  title="Delete"
                  style={{ ...iconButtonStyle, color: "var(--coral)" }}
                >
                  <Trash2 size={14} />
                </button>
              </span>
            )}
          </div>
        ))}

        {numbers?.length === 0 && (
          <p style={{ fontSize: 13, color: "var(--text-faint)" }}>No business numbers configured.</p>
        )}
      </div>
    </div>
  );
}

function BusinessNumberForm({
  form,
  setForm,
  editing,
  saving,
  onSave,
  onCancel,
}: {
  form: BusinessNumberInput;
  setForm: (updater: (f: BusinessNumberInput) => BusinessNumberInput) => void;
  editing: boolean;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16, maxWidth: 560 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{editing ? "Edit business number" : "New business number"}</div>
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
            placeholder="+918428280106"
          />
        </label>
        <label style={fieldLabelStyle}>
          Category
          <select style={inputStyle} value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as BusinessNumberInput["category"] }))}>
            {CATEGORY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
        Label
        <input style={inputStyle} value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Car Modifications" />
      </label>
      <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
        ExoPhone number (used for call routing/category, not shown to customers)
        <input
          style={inputStyle}
          value={form.exophoneNumber ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, exophoneNumber: e.target.value }))}
          placeholder="04447614996"
        />
      </label>
      <label style={{ ...fieldLabelStyle, marginBottom: 16 }}>
        WhatsApp Phone Number ID (from WhatsApp Manager &gt; API Setup, for tracking WhatsApp calls)
        <input
          style={inputStyle}
          value={form.whatsappPhoneNumberId ?? ""}
          onChange={(e) => setForm((f) => ({ ...f, whatsappPhoneNumberId: e.target.value }))}
          placeholder="123456789012345"
        />
      </label>
      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={onSave} disabled={saving} style={primaryButtonStyle}>
          {saving ? "Saving…" : editing ? "Save changes" : "Add number"}
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
