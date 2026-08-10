interface SpinnerProps {
  size?: number;
  thickness?: number;
  color?: string;
  trackColor?: string;
}

// A ring-style spinner, used everywhere the app shows a loading state --
// buttons, inline list loaders, and the full-page loader -- instead of
// spinning an icon glyph in place.
export function Spinner({ size = 16, thickness = 2, color = "var(--brand)", trackColor = "var(--border-soft)" }: SpinnerProps) {
  return (
    <span
      role="status"
      aria-label="Loading"
      style={{
        display: "inline-block",
        width: size,
        height: size,
        border: `${thickness}px solid ${trackColor}`,
        borderTopColor: color,
        borderRadius: "50%",
        animation: "spin 700ms linear infinite",
        flexShrink: 0,
      }}
    />
  );
}

export function LoadingText({ label = "Loading…", size = 12 }: { label?: string; size?: number }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
      <Spinner size={size} thickness={2} />
      {label}
    </span>
  );
}
