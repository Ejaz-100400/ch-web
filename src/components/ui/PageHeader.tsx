import type { ReactNode } from "react";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  alignActions = "flex-end",
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
  /** "flex-start" lines the actions block up with the top of the title instead of the bottom -- for tall actions content (e.g. a widget stacked above the usual buttons) that should start level with the eyebrow, not hang below it. */
  alignActions?: "flex-start" | "flex-end";
}) {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: alignActions,
        gap: 24,
        marginBottom: 28,
        flexWrap: "wrap",
      }}
    >
      <div>
        {eyebrow && (
          <div
            style={{
              fontSize: 12,
              fontWeight: 700,
              color: "var(--brand-strong)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: 6,
            }}
          >
            {eyebrow}
          </div>
        )}
        <h1 style={{ fontSize: 25, fontWeight: 700 }}>{title}</h1>
        {description && (
          <p style={{ color: "var(--text-soft)", fontSize: 13.5, marginTop: 6, maxWidth: 560 }}>{description}</p>
        )}
      </div>
      {actions && <div style={{ display: "flex", gap: 10, flexShrink: 0 }}>{actions}</div>}
    </div>
  );
}
