export function formatDuration(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function formatPhone(raw: string): string {
  return raw;
}

// This business and its staff are all IST -- pin dates/times to Asia/Kolkata
// explicitly rather than the viewer's browser timezone/locale, so a call
// logged at 11pm IST doesn't display as the next day (or vice versa) for
// anyone whose machine happens to be set to a different timezone.
const IST_TIMEZONE = "Asia/Kolkata";

export function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: IST_TIMEZONE });
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: IST_TIMEZONE });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST_TIMEZONE });
  return `${date}, ${time}`;
}

export function relativeDay(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0);
  const diffDays = Math.round(diffMs / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays} days ago`;
  return formatDate(iso);
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount);
}

export function initials(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
