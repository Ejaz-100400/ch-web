// Deterministic color per box number -- the same box always renders in the
// same color everywhere it appears, so items sharing a physical box are
// visually grouped at a glance without needing a separate color picker.
const PALETTE = [
  { fg: "var(--amber)", bg: "var(--amber-soft)" },
  { fg: "var(--violet)", bg: "var(--violet-soft)" },
  { fg: "var(--success)", bg: "var(--success-soft)" },
  { fg: "var(--info)", bg: "var(--info-soft)" },
  { fg: "var(--coral)", bg: "var(--coral-soft)" },
];

export function boxColor(boxNumber: string): { fg: string; bg: string } {
  let hash = 0;
  for (let i = 0; i < boxNumber.length; i++) hash = (hash * 31 + boxNumber.charCodeAt(i)) | 0;
  return PALETTE[Math.abs(hash) % PALETTE.length];
}
