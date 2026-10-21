// Appointments are booked in IST, whatever timezone the browser happens to be
// in -- so every conversion here is explicit about +05:30 instead of leaning
// on the browser's local zone (same reason the backend never trusts
// `new Date("2026-08-10")`).
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const IST = "Asia/Kolkata";

/** Today's calendar date in IST, "YYYY-MM-DD". */
export function todayIstDate(): string {
  return new Date(Date.now() + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** An IST date ("YYYY-MM-DD") and time ("HH:mm") as the real instant, ISO string. */
export function istDateTimeToIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00+05:30`).toISOString();
}

/** The reverse -- an instant split into its IST date and time, for filling the edit form. */
export function isoToIstParts(iso: string): { date: string; time: string } {
  // sv-SE formats as "YYYY-MM-DD HH:mm:ss" in any browser.
  const s = new Date(iso).toLocaleString("sv-SE", { timeZone: IST, hour12: false });
  return { date: s.slice(0, 10), time: s.slice(11, 16) };
}

/** "3:30 PM" in IST. */
export function formatIstTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: IST });
}

function span(totalMinutes: number): string {
  const days = Math.floor(totalMinutes / 1440);
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"}`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h >= 1) return m ? `${h}h ${m}m` : `${h}h`;
  return `${m} min`;
}

/**
 * How far an appointment is from `now`: "in 40 min", "Due now", "15 min late".
 * `soon` is the same one-hour window the site-wide alert uses; `overdue`
 * means the booked time has passed and it's still not marked arrived.
 */
export function relativeToAppointment(iso: string, now: number): { label: string; soon: boolean; overdue: boolean } {
  const diffMin = Math.round((new Date(iso).getTime() - now) / 60_000);
  if (diffMin > 1) return { label: `in ${span(diffMin)}`, soon: diffMin <= 60, overdue: false };
  if (diffMin >= -1) return { label: "Due now", soon: true, overdue: false };
  return { label: `${span(-diffMin)} late`, soon: false, overdue: true };
}
