import { useEffect, useMemo, useState } from "react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Skeleton } from "../../components/ui/Skeleton";
import type { CallsByPeriodPoint, DailyRatePoint, SentimentType } from "../../types";

type CountMetric = "total" | "glasses" | "mods";
type RateMetric = "interestedRate" | "callToSaleRate" | "followUpCompletionRate" | "socialMediaToSaleRate";
type Metric = CountMetric | RateMetric;

const COUNT_OPTIONS: { value: CountMetric; label: string }[] = [
  { value: "total", label: "Total calls" },
  { value: "glasses", label: "Car Glasses" },
  { value: "mods", label: "Car Modifications" },
];

const RATE_OPTIONS: { value: RateMetric; label: string }[] = [
  { value: "interestedRate", label: "Interested rate" },
  { value: "callToSaleRate", label: "Call → Sale rate" },
  { value: "followUpCompletionRate", label: "Follow-up completed" },
  { value: "socialMediaToSaleRate", label: "Social media → Sales rate" },
];

function isRateMetric(metric: Metric): metric is RateMetric {
  return (
    metric === "interestedRate" ||
    metric === "callToSaleRate" ||
    metric === "followUpCompletionRate" ||
    metric === "socialMediaToSaleRate"
  );
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// A heatmap intensity step derived from the site's own brand yellow, mixed
// against the page background, rather than an unrelated chart palette --
// color-mix keeps this in sync with --brand/--paper automatically (light
// and dark mode alike), no hardcoded hex per mode needed.
const STEP_OPACITIES = [15, 28, 42, 58, 76, 100];

function dayCellStyle(step: number): React.CSSProperties {
  if (step === 0) {
    return { background: "var(--paper)", border: "1px solid var(--border-soft)" };
  }
  return {
    background: `color-mix(in srgb, var(--brand) ${STEP_OPACITIES[step - 1]}%, var(--paper))`,
    border: "1px solid var(--border-soft)",
  };
}

function bucket(value: number, max: number): number {
  if (value <= 0) return 0;
  return Math.min(6, Math.max(1, Math.ceil((value / max) * 6)));
}

interface CalendarHeatmapProps {
  month: string; // "YYYY-MM"
  category: string[];
  employeeId: string[];
  carMake: string[];
  carModel: string[];
  sentiment: string[];
  productId: string[];
  selectedDay: string; // "YYYY-MM-DD"
  onSelectDay: (day: string) => void;
}

export function CalendarHeatmap({ month, category, employeeId, carMake, carModel, sentiment, productId, selectedDay, onSelectDay }: CalendarHeatmapProps) {
  const toast = useToast();
  const [metric, setMetric] = useState<Metric>("total");
  const [points, setPoints] = useState<CallsByPeriodPoint[]>([]);
  const [ratePoints, setRatePoints] = useState<DailyRatePoint[]>([]);
  const [loading, setLoading] = useState(true);

  const [year, monthNum] = month.split("-").map(Number);
  const daysInMonth = new Date(year, monthNum, 0).getDate();
  const firstWeekday = new Date(year, monthNum - 1, 1).getDay();

  const filters = useMemo(
    () => ({
      category: category.length ? category : undefined,
      employeeId: employeeId.length ? employeeId : undefined,
      carMake: carMake.length ? carMake : undefined,
      carModel: carModel.length ? carModel : undefined,
      sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
      productId: productId.length ? productId : undefined,
      dateFrom: `${month}-01`,
      dateTo: `${month}-${String(daysInMonth).padStart(2, "0")}`,
    }),
    [month, category, employeeId, carMake, carModel, sentiment, productId, daysInMonth],
  );

  // Both the counts (for the Total calls/Car Glasses/Car Modifications row)
  // and the rates (for the Interested rate/Call → Sale rate/Follow-up
  // completed row) load together on every filter change -- switching
  // between the two button rows is then instant, no re-fetch/flash needed.
  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([api.reports.callsByPeriod("daily", filters), api.reports.dailyRates(filters)])
      .then(([counts, rates]) => {
        if (!active) return;
        setPoints(counts);
        setRatePoints(rates);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load calendar data", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const byDayCount = new Map<number, { total: number; glasses: number; mods: number }>();
  for (const p of points) {
    const day = new Date(p.period).getDate();
    byDayCount.set(day, {
      total: p.carGlasses + p.carModifications + p.unknown,
      glasses: p.carGlasses,
      mods: p.carModifications,
    });
  }
  const byDayRate = new Map<number, DailyRatePoint>();
  for (const p of ratePoints) {
    byDayRate.set(new Date(p.period).getDate(), p);
  }

  const rateActive = isRateMetric(metric);
  const dayValue = (day: number): number | null =>
    rateActive ? (byDayRate.get(day)?.[metric] ?? null) : (byDayCount.get(day)?.[metric as CountMetric] ?? 0);

  const values = Array.from({ length: daysInMonth }, (_, i) => dayValue(i + 1) ?? 0);
  const max = Math.max(...values, 1);

  const cells: { day: number | null }[] = [
    ...Array.from({ length: firstWeekday }, () => ({ day: null })),
    ...Array.from({ length: daysInMonth }, (_, i) => ({ day: i + 1 })),
  ];
  const rows = Math.ceil(cells.length / 7);

  const monthLabel = new Date(year, monthNum - 1, 1).toLocaleString("en-US", { month: "long", year: "numeric" });

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", gap: 6, marginBottom: 8, flexWrap: "wrap" }}>
        {COUNT_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMetric(opt.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${metric === opt.value ? "var(--brand)" : "var(--border)"}`,
              background: metric === opt.value ? "var(--brand-soft)" : "var(--paper-raised)",
              color: metric === opt.value ? "var(--brand-strong)" : "var(--text)",
              fontSize: 13,
              fontWeight: metric === opt.value ? 700 : 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", gap: 6, marginBottom: 16, flexWrap: "wrap" }}>
        {RATE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setMetric(opt.value)}
            style={{
              padding: "8px 14px",
              borderRadius: "var(--radius-sm)",
              border: `1px solid ${metric === opt.value ? "var(--violet)" : "var(--border)"}`,
              background: metric === opt.value ? "var(--violet-soft)" : "var(--paper-raised)",
              color: metric === opt.value ? "var(--violet)" : "var(--text)",
              fontSize: 13,
              fontWeight: metric === opt.value ? 700 : 600,
              cursor: "pointer",
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: 18 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 14 }}>{monthLabel}</div>

        {loading ? (
          <Skeleton height={320} />
        ) : (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "32px repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 4 }}>
              <div />
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} style={{ textAlign: "center", fontSize: 11, fontWeight: 700, color: "var(--text-faint)", padding: "2px 0" }}>
                  {w}
                </div>
              ))}
            </div>

            {Array.from({ length: rows }, (_, r) => (
              <div key={r} style={{ display: "grid", gridTemplateColumns: "32px repeat(7, minmax(0, 1fr))", gap: 4, marginBottom: 4 }}>
                <div style={{ fontSize: 10, color: "var(--text-faint)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  W{r + 1}
                </div>
                {cells.slice(r * 7, r * 7 + 7).map((cell, i) => {
                  if (cell.day === null) return <div key={i} />;
                  const raw = dayValue(cell.day);
                  // Rate metrics bucket against a fixed 0-100% scale (a 51%
                  // day always looks the same shade regardless of what else
                  // is on the calendar) -- count metrics keep bucketing
                  // relative to this month's own busiest day, unchanged.
                  const step = rateActive ? bucket(raw ?? 0, 100) : bucket(raw ?? 0, max);
                  const iso = `${month}-${String(cell.day).padStart(2, "0")}`;
                  const isSelected = iso === selectedDay;
                  const displayValue = raw == null ? null : rateActive ? `${raw}%` : raw;
                  return (
                    <button
                      key={i}
                      onClick={() => onSelectDay(iso)}
                      aria-pressed={isSelected}
                      aria-label={`View ${iso}, ${displayValue ?? "no data"}`}
                      style={{
                        minHeight: 52,
                        borderRadius: 6,
                        padding: "5px 7px",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        textAlign: "left",
                        cursor: "pointer",
                        boxShadow: isSelected ? "0 0 0 2px var(--paper-raised), 0 0 0 4px var(--text)" : "none",
                        ...dayCellStyle(step),
                      }}
                    >
                      <span style={{ fontSize: 11, color: "var(--text-soft)" }}>{cell.day}</span>
                      {displayValue != null && <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>{displayValue}</span>}
                    </button>
                  );
                })}
              </div>
            ))}

            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 14, fontSize: 11.5, color: "var(--text-soft)" }}>
              <span>Fewer</span>
              <span style={{ display: "flex", gap: 2 }}>
                {STEP_OPACITIES.map((op) => (
                  <span
                    key={op}
                    style={{ width: 18, height: 11, borderRadius: 2, background: `color-mix(in srgb, var(--brand) ${op}%, var(--paper))`, border: "1px solid var(--border-soft)" }}
                  />
                ))}
              </span>
              <span>More</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
