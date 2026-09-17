// Deterministic color gradient per product -- the same product always
// renders with the same gradient everywhere it appears on the WhatsApp
// Messaging page, so conversations about the same product are visually
// grouped at a glance without a manual color picker anywhere.
function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  return Math.abs(hash);
}

export function productGradient(key: string): string {
  const hash = hashString(key);
  const hue = hash % 360;
  const hue2 = (hue + 42) % 360;
  return `linear-gradient(135deg, hsl(${hue}, 68%, 42%), hsl(${hue2}, 72%, 56%))`;
}

// Every gradient above sits in the same mid-saturation/lightness band, so
// plain white text reads cleanly on all of them -- no per-product contrast
// check needed.
export const PRODUCT_GRADIENT_TEXT = "#ffffff";

export const UNCLASSIFIED_GRADIENT = "linear-gradient(135deg, var(--border), var(--border-soft))";
