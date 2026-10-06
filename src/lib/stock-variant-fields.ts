// Which extra spec fields to show on the stock item form, based on the
// selected catalog subcategory (Product) name. Stored generically in
// StockItem.attributes (a JSON blob) rather than dedicated columns, since
// each product type needs a different set and new types will keep adding
// more -- see the schema comment on StockItem.attributes.

export interface VariantField {
  key: string;
  label: string;
  placeholder: string;
  // Default is a plain text input. The suggest variants are a text input
  // that offers existing car makes/models from call history but still
  // accepts anything typed.
  input?: "text" | "suggest-make" | "suggest-model";
}

const LED_FIELDS: VariantField[] = [
  { key: "watts", label: "Watts", placeholder: "e.g. 200W" },
  { key: "temperature", label: "Temperature", placeholder: "e.g. 6000K" },
  { key: "version", label: "Version", placeholder: "e.g. V2" },
];

const RING_FIELDS: VariantField[] = [
  { key: "colorType", label: "Color type", placeholder: "e.g. WRGB" },
  { key: "size", label: "Size", placeholder: "e.g. 90mm" },
  { key: "shape", label: "Shape", placeholder: "e.g. Round" },
];

// Car glass is vehicle-specific. A headlight glass is also side-specific, but
// that isn't a spec field here: the left and right glass are separate parts
// with separate stock, so the form creates one item per side (see
// SIDED_PRODUCT_SIDES) and records which one in the item's `side` attribute.
const HEADLIGHT_GLASS_FIELDS: VariantField[] = [
  { key: "carMake", label: "Car make", placeholder: "Pick or type a make", input: "suggest-make" },
  { key: "carModel", label: "Car model", placeholder: "Pick or type a model", input: "suggest-model" },
  { key: "modelYear", label: "Model year", placeholder: "e.g. 2018 or 2018-2021" },
];

export const SIDED_PRODUCT_SIDES = ["Left", "Right"] as const;
export type ProductSide = (typeof SIDED_PRODUCT_SIDES)[number];

/** Products stocked as separate Left/Right items rather than one. */
export function isSidedProduct(productName: string | undefined | null): boolean {
  return productName?.trim().toLowerCase() === "headlight glass";
}

// Exact match for "LED" (not substring -- "Bi LED Projector" is a
// different, unrelated product) and startsWith for "5D Ring" (there are
// multiple variants in the catalog, e.g. "5D Ring (W/Y)", "5D Ring (WRGB)").
export function variantFieldsForProduct(productName: string | undefined | null): VariantField[] | null {
  if (!productName) return null;
  const normalized = productName.trim().toLowerCase();
  if (normalized === "led") return LED_FIELDS;
  if (normalized.startsWith("5d ring")) return RING_FIELDS;
  if (normalized === "headlight glass") return HEADLIGHT_GLASS_FIELDS;
  return null;
}
