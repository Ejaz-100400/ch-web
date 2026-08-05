/**
 * Custom Headlights mark: a car roofline swoosh over a headlight glyph,
 * ringed like a badge. Drop into a colored square (see Sidebar/Login) the
 * same way the old icon-in-a-box pattern worked.
 */
export function Logo({ size = 18, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" role="img" aria-label="Custom Headlights logo">
      <circle cx="16" cy="16" r="13.5" stroke={color} strokeWidth="2" />
      <path d="M5 13c4.5-4 17.5-4 22 0" stroke={color} strokeWidth="2" strokeLinecap="round" fill="none" />
      <ellipse cx="16" cy="19.5" rx="6.5" ry="4" fill={color} />
      <circle cx="13.6" cy="18.6" r="0.9" fill="#fff" opacity="0.55" />
      <circle cx="17.4" cy="17.7" r="0.6" fill="#fff" opacity="0.55" />
    </svg>
  );
}
