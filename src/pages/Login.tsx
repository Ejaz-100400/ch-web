import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Lock, Mail, ArrowRight } from "lucide-react";
import { Waveform } from "../components/ui/Waveform";
import { Logo } from "../components/ui/Logo";
import { ThemeToggle } from "../components/ui/ThemeToggle";
import { useAuth } from "../lib/auth-context";

function backgroundWave(seed: number, len: number) {
  const out: number[] = [];
  let x = seed;
  for (let i = 0; i < len; i++) {
    x = (x * 9301 + 49297) % 233280;
    out.push(0.1 + (x / 233280) * 0.9);
  }
  return out;
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { session, loading, signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!loading && session) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/customers";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Enter your email and password to continue.");
      return;
    }
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate("/customers");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed. Check your credentials and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      {/* Left: brand + signature waveform panel */}
      <div
        className="login-brand-panel"
        style={{
          background: "var(--ink)",
          color: "var(--text-inverse)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "48px 56px",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", opacity: 0.35 }}>
          <div style={{ display: "flex", gap: 5, padding: "0 56px", flexWrap: "wrap", width: "100%" }}>
            {Array.from({ length: 9 }).map((_, row) => (
              <Waveform key={row} data={backgroundWave(row * 13 + 3, 40)} height={30} color="var(--brand)" barWidth={3} gap={3} />
            ))}
          </div>
        </div>

        <div style={{ position: "relative", zIndex: 1, display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Logo size={18} color="var(--on-brand)" />
          </div>
          <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.05 }}>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 16, letterSpacing: "0.01em" }}>CUSTOM</span>
            <span style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 11.5, color: "var(--text-inverse-soft)", letterSpacing: "0.06em" }}>
              HEADLIGHTS
            </span>
          </span>
        </div>

        <div style={{ position: "relative", zIndex: 1, maxWidth: 380 }}>
          <h1 style={{ fontSize: 32, lineHeight: 1.15, marginBottom: 14 }}>
            Every enquiry,<br />on the record.
          </h1>
          <p style={{ color: "var(--text-inverse-soft)", fontSize: 14.5, lineHeight: 1.6 }}>
            Search customers, review call transcripts and AI extractions, and track follow-ups
            across your Car Glasses and Car Modifications lines from one place.
          </p>
        </div>

        <p style={{ position: "relative", zIndex: 1, color: "var(--text-inverse-soft)", fontSize: 12.5 }}>
          © 2026 Custom Headlights. All calls are recorded for quality and training.
        </p>
      </div>

      {/* Right: login form */}
      <div style={{ flex: "1 1 54%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--paper)", position: "relative" }}>
        <div style={{ position: "absolute", top: 20, right: 24 }}>
          <ThemeToggle />
        </div>
        <form onSubmit={handleSubmit} style={{ width: "100%", maxWidth: 360, padding: "0 24px" }} className="fade-in-up">
          <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Sign in</h2>
          <p style={{ color: "var(--text-soft)", fontSize: 13.5, marginBottom: 28 }}>
            Use your Custom Headlights workspace credentials.
          </p>

          {error && (
            <div
              role="alert"
              style={{
                background: "var(--coral-soft)",
                color: "var(--coral)",
                fontSize: 13,
                fontWeight: 600,
                padding: "10px 12px",
                borderRadius: "var(--radius-sm)",
                marginBottom: 16,
              }}
            >
              {error}
            </div>
          )}

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>
            Work email
          </label>
          <div style={{ position: "relative", marginBottom: 18 }}>
            <Mail size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              style={{
                width: "100%",
                padding: "11px 12px 11px 36px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--paper-raised)",
                fontSize: 14,
              }}
            />
          </div>

          <label style={{ display: "block", fontSize: 12.5, fontWeight: 600, color: "var(--text-soft)", marginBottom: 6 }}>
            Password
          </label>
          <div style={{ position: "relative", marginBottom: 22 }}>
            <Lock size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-faint)" }} />
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              style={{
                width: "100%",
                padding: "11px 12px 11px 36px",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-sm)",
                background: "var(--paper-raised)",
                fontSize: 14,
              }}
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
              transition: "opacity 150ms ease, transform 100ms ease",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
            {!submitting && <ArrowRight size={16} />}
          </button>

          <p style={{ textAlign: "center", fontSize: 12.5, color: "var(--text-faint)", marginTop: 20 }}>
            New here? Ask an admin to create your account in Supabase Auth.
          </p>
        </form>
      </div>
    </div>
  );
}
