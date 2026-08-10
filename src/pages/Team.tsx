import { useEffect, useState } from "react";
import { Mail, Pencil, Plus, Save, ShieldAlert, UserRoundCheck, UserRoundX, X } from "lucide-react";
import { PageHeader } from "../components/ui/PageHeader";
import { SkeletonRows } from "../components/ui/Skeleton";
import { api, ApiError } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { useToast } from "../components/ui/Toast";
import { LoadingText } from "../components/ui/Spinner";
import type { AppUser, UserRole } from "../types";

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "viewer", label: "Viewer" },
];

const EMPTY_FORM = { name: "", email: "", role: "viewer" as UserRole };

export default function Team() {
  const { appUser } = useAuth();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<AppUser[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [inviting, setInviting] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function load() {
    setLoading(true);
    api.team
      .list()
      .then(setMembers)
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load team members", "error"))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (appUser && appUser.role !== "admin") {
    return (
      <div>
        <PageHeader eyebrow="Team" title="Team access" />
        <div style={{ ...cardStyle, textAlign: "center", padding: 40, color: "var(--text-faint)" }}>
          <ShieldAlert size={22} style={{ marginBottom: 8, opacity: 0.6 }} />
          <p style={{ fontWeight: 600, color: "var(--text-soft)" }}>Team access requires admin access</p>
          <p style={{ fontSize: 13 }}>Ask an admin if you need someone added.</p>
        </div>
      </div>
    );
  }

  async function handleInvite() {
    if (!form.name.trim() || !form.email.trim()) {
      toast.show("Name and email are required.", "error");
      return;
    }
    setInviting(true);
    try {
      await api.team.invite({
        name: form.name.trim(),
        email: form.email.trim(),
        role: form.role,
        redirectTo: `${window.location.origin}/set-password`,
      });
      toast.show(`Invite sent to ${form.email.trim()}.`, "success");
      setForm(EMPTY_FORM);
      setFormOpen(false);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to send invite", "error");
    } finally {
      setInviting(false);
    }
  }

  async function handleRoleChange(member: AppUser, role: UserRole) {
    setUpdatingId(member.id);
    try {
      await api.team.update(member.id, { role });
      toast.show(`${member.name}'s role updated to ${role}.`, "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update role", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  function startEditName(member: AppUser) {
    setEditingId(member.id);
    setEditName(member.name);
  }

  async function handleSaveName(member: AppUser) {
    if (!editName.trim()) {
      toast.show("Name can't be empty.", "error");
      return;
    }
    setUpdatingId(member.id);
    try {
      await api.team.update(member.id, { name: editName.trim() });
      toast.show("Name updated.", "success");
      setEditingId(null);
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update name", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleToggleActive(member: AppUser) {
    setUpdatingId(member.id);
    try {
      await api.team.update(member.id, { active: !member.active });
      toast.show(member.active ? `${member.name} deactivated.` : `${member.name} reactivated.`, "success");
      load();
    } catch (err) {
      toast.show(err instanceof ApiError ? err.message : "Failed to update", "error");
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div>
      <PageHeader
        eyebrow="Team"
        title="Team access"
        description="Who can sign in to this dashboard, and what they can do once they're in."
        actions={
          <button onClick={() => setFormOpen((v) => !v)} style={primaryButtonStyle}>
            <Plus size={15} /> Invite team member
          </button>
        }
      />

      {formOpen && (
        <div className="fade-in-up" style={{ ...cardStyle, marginBottom: 18, padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700 }}>Invite team member</div>
            <button onClick={() => setFormOpen(false)} aria-label="Close" style={{ background: "none", border: "none", color: "var(--text-faint)", display: "flex" }}>
              <X size={15} />
            </button>
          </div>
          <p style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 14 }}>
            They'll get an email with a link to set their own password and sign in.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 16 }}>
            <label style={fieldLabelStyle}>
              Name
              <input style={inputStyle} value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Email
              <input type="email" style={inputStyle} value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </label>
            <label style={fieldLabelStyle}>
              Role
              <select style={inputStyle} value={form.role} onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}>
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={handleInvite} disabled={inviting} style={primaryButtonStyle}>
              <Mail size={14} /> {inviting ? "Sending…" : "Send invite"}
            </button>
            <button onClick={() => setFormOpen(false)} style={secondaryButtonStyle}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={{ fontSize: 12.5, color: "var(--text-faint)", marginBottom: 10 }}>
        {loading ? <LoadingText /> : `${members.length} team member${members.length === 1 ? "" : "s"}`}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "var(--shadow-card)" }}>
        <div className="table-scroll">
          <div style={{ minWidth: 700 }}>
            <div
              className="mono"
              style={{
                display: "grid",
                gridTemplateColumns: "1.6fr 1.8fr 1fr 1fr 116px",
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
              <span>Role</span>
              <span>Status</span>
              <span>Actions</span>
            </div>

            {loading && <SkeletonRows rows={5} />}

            {!loading &&
              members.map((m) => {
                const isEditing = editingId === m.id;
                return (
                  <div
                    key={m.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.6fr 1.8fr 1fr 1fr 116px",
                      alignItems: "center",
                      padding: "12px 18px",
                      borderBottom: "1px solid var(--border-soft)",
                      fontSize: 13,
                    }}
                  >
                    {isEditing ? (
                      <input
                        autoFocus
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleSaveName(m);
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        style={{ ...inputStyle, padding: "5px 8px", fontSize: 13 }}
                      />
                    ) : (
                      <span style={{ fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.name}</span>
                    )}
                    <span style={{ color: "var(--text-soft)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</span>
                    <select
                      value={m.role}
                      disabled={updatingId === m.id || m.id === appUser?.id}
                      onChange={(e) => handleRoleChange(m, e.target.value as UserRole)}
                      title={m.id === appUser?.id ? "You can't change your own role" : "Change role"}
                      style={{ ...inputStyle, width: "auto", padding: "5px 8px", fontSize: 12.5 }}
                    >
                      {ROLE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                    <span style={{ fontSize: 12, fontWeight: 600, color: m.active ? "var(--brand-strong)" : "var(--text-faint)" }}>
                      {m.active ? "Active" : "Inactive"}
                    </span>
                    <span style={{ display: "flex", gap: 4 }}>
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => handleSaveName(m)}
                            disabled={updatingId === m.id}
                            aria-label={`Save ${m.name}`}
                            title="Save"
                            style={{ ...iconButtonStyle, color: "var(--brand-strong)" }}
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            disabled={updatingId === m.id}
                            aria-label="Cancel"
                            title="Cancel"
                            style={{ ...iconButtonStyle, color: "var(--text-faint)" }}
                          >
                            <X size={14} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => startEditName(m)}
                            disabled={updatingId === m.id}
                            aria-label={`Edit ${m.name}`}
                            title="Edit name"
                            style={{ ...iconButtonStyle, color: "var(--text-faint)" }}
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleActive(m)}
                            disabled={updatingId === m.id || m.id === appUser?.id}
                            aria-label={m.active ? `Deactivate ${m.name}` : `Reactivate ${m.name}`}
                            title={m.id === appUser?.id ? "You can't deactivate yourself" : m.active ? "Deactivate" : "Reactivate"}
                            style={{ ...iconButtonStyle, color: m.active ? "var(--coral)" : "var(--brand-strong)" }}
                          >
                            {m.active ? <UserRoundX size={14} /> : <UserRoundCheck size={14} />}
                          </button>
                        </>
                      )}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>

        {!loading && members.length === 0 && (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "var(--text-faint)" }}>
            <p style={{ fontWeight: 600, color: "var(--text-soft)", marginBottom: 4 }}>No team members yet</p>
            <p style={{ fontSize: 13 }}>Invite your first teammate above.</p>
          </div>
        )}
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
} as const;
