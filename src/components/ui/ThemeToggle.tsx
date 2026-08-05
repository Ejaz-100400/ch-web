import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../lib/theme-context";

export function ThemeToggle({ inverse = false }: { inverse?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Switch to light theme" : "Switch to dark theme"}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: 32,
        height: 32,
        borderRadius: "var(--radius-sm)",
        border: `1px solid ${inverse ? "var(--ink-border)" : "var(--border)"}`,
        background: inverse ? "var(--surface-1)" : "var(--paper-raised)",
        color: inverse ? "var(--text-inverse)" : "var(--text)",
        flexShrink: 0,
      }}
    >
      {isDark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}
