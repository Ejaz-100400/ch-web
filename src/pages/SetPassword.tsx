import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, ArrowRight } from "lucide-react";
import { Logo } from "../components/ui/Logo";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { supabase } from "../lib/supabase";

export default function SetPassword() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      navigate("/customers");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Couldn't set your password -- the invite link may have expired. Ask an admin to resend it.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, right: 24 }}>
        <ThemeToggle />
      </div>
      <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360, padding: "0 24px" }} className="fade-in-up">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 28 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Logo size={18} color="var(--on-brand)" />
          </div>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 15 }}>Custom Headlights</span>
        </div>

        <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Welcome aboard</h2>
        <p style={{ color: "var(--text-soft)", fontSize: 13.5, marginBottom: 28 }}>Set a password to finish setting up your account.</p>

        {error && (
          <div role="alert" style={{ background: "var(--coral-soft)", color: "var(--coral)", fontSize: 13, fontWeight: 600, padding: "10px 12px", borderRadius: "var(--radius-sm)", marginBottom: 16 }}>
            {error}
          </div>
        )}

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>New password</label>
        <div style={{ position: "relative", marginBottom: 18 }}>
          <Lock size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            style={inputStyle}
          />
        </div>

        <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>Confirm password</label>
        <div style={{ position: "relative", marginBottom: 22 }}>
          <Lock size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
          <input
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            style={inputStyle}
          />
        </div>

        <button
          type="submit"
          disabled={submitting}
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
            fontSize: 14.5,
            fontWeight: 700,
            opacity: submitting ? 0.7 : 1,
          }}
        >
          {submitting ? "Saving…" : "Set password & continue"}
          {!submitting && <ArrowRight size={16} />}
        </button>
      </form>
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "11px 12px 11px 36px",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius-sm)",
  background: "var(--paper-raised)",
  fontSize: 14,
} as const;
