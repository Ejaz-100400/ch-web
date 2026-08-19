import { useEffect, useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import { TrendingUp, Clock, PieChart as PieIcon } from "lucide-react";
import { api, ApiError } from "../../lib/api";
import { useToast } from "../../components/ui/Toast";
import { Skeleton } from "../../components/ui/Skeleton";
import type { CallsByPeriodPoint, SentimentType } from "../../types";

const HOUR_LABELS = Array.from({ length: 24 }, (_, h) => {
  const period = h < 12 ? "AM" : "PM";
  const display = h % 12 === 0 ? 12 : h % 12;
  return `${display} ${period}`;
});

interface DayLineChartProps {
  day: string; // "YYYY-MM-DD"
  category: string[];
  employeeId: string[];
  carMake: string[];
  carModel: string[];
  sentiment: string[];
  productId: string[];
}

export function DayLineChart({ day, category, employeeId, carMake, carModel, sentiment, productId }: DayLineChartProps) {
  const toast = useToast();
  const [points, setPoints] = useState<CallsByPeriodPoint[]>([]);
  const [loading, setLoading] = useState(true);

  const filters = useMemo(
    () => ({
      category: category.length ? category : undefined,
      employeeId: employeeId.length ? employeeId : undefined,
      carMake: carMake.length ? carMake : undefined,
      carModel: carModel.length ? carModel : undefined,
      sentiment: sentiment.length ? (sentiment as SentimentType[]) : undefined,
      productId: productId.length ? productId : undefined,
      dateFrom: day,
      dateTo: day,
    }),
    [day, category, employeeId, carMake, carModel, sentiment, productId],
  );

  useEffect(() => {
    let active = true;
    setLoading(true);
    api.reports
      .callsByPeriod("hourly", filters)
      .then((res) => {
        if (active) setPoints(res);
      })
      .catch((err) => toast.show(err instanceof ApiError ? err.message : "Failed to load the day's hourly breakdown", "error"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const byHour = new Map<number, { glasses: number; modifications: number }>();
  for (const p of points) {
    const hour = new Date(p.period).getHours();
    byHour.set(hour, { glasses: p.carGlasses, modifications: p.carModifications + p.unknown });
  }

  const data = Array.from({ length: 24 }, (_, hour) => {
    const entry = byHour.get(hour) ?? { glasses: 0, modifications: 0 };
    return { hour, label: HOUR_LABELS[hour], glasses: entry.glasses, modifications: entry.modifications, overall: entry.glasses + entry.modifications };
  });

  const totalCalls = data.reduce((sum, d) => sum + d.overall, 0);
  const totalGlasses = data.reduce((sum, d) => sum + d.glasses, 0);
  const totalModifications = data.reduce((sum, d) => sum + d.modifications, 0);
  const peak = data.reduce((best, d) => (d.overall > best.overall ? d : best), data[0]);
  const activeHours = data.filter((d) => d.overall > 0).length;

  const dayLabel = new Date(`${day}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
  const isToday = day === new Date().toISOString().slice(0, 10);

  return (
    <div style={{ background: "var(--paper-raised)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-card)", padding: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 4 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>{dayLabel}</div>
        {isToday && (
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--brand-strong)", background: "var(--brand-soft)", padding: "2px 8px", borderRadius: 999 }}>
            Today
          </span>
        )}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-faint)", marginBottom: 16 }}>Hourly call volume, split by category</div>

      {loading ? (
        <Skeleton height={280} />
      ) : totalCalls === 0 ? (
        <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-faint)", fontSize: 13 }}>No calls on this day.</div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10, marginBottom: 18 }}>
            <InsightTile
              icon={TrendingUp}
              label="Total calls"
              value={String(totalCalls)}
              detail={`across ${activeHours} active hour${activeHours === 1 ? "" : "s"}`}
            />
            <InsightTile
              icon={Clock}
              label="Busiest hour"
              value={peak.overall > 0 ? peak.label : "—"}
              detail={peak.overall > 0 ? `${peak.overall} call${peak.overall === 1 ? "" : "s"}` : "no calls yet"}
            />
            <InsightTile
              icon={PieIcon}
              label="Category split"
              value={totalCalls > 0 ? `${Math.round((totalGlasses / totalCalls) * 100)}% Glasses` : "—"}
              detail={totalCalls > 0 ? `${Math.round((totalModifications / totalCalls) * 100)}% Modifications` : ""}
            />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data} margin={{ left: -20, right: 8, top: 8 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} interval={2} />
              <YAxis tick={{ fontSize: 12, fill: "var(--text-faint)" }} axisLine={false} tickLine={false} width={28} allowDecimals={false} />
              <Tooltip contentStyle={{ borderRadius: 8, borderColor: "var(--border)", fontSize: 13 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconType="plainline" iconSize={16} />
              <Line type="monotone" name="Overall" dataKey="overall" stroke="var(--text)" strokeWidth={2} strokeDasharray="4 3" dot={false} />
              <Line type="monotone" name="Glasses" dataKey="glasses" stroke="#17967f" strokeWidth={2.5} dot={{ r: 2 }} />
              <Line type="monotone" name="Modifications" dataKey="modifications" stroke="#6a63d1" strokeWidth={2.5} dot={{ r: 2 }} />
            </LineChart>
          </ResponsiveContainer>
        </>
      )}
    </div>
  );
}

function InsightTile({ icon: Icon, label, value, detail }: { icon: typeof TrendingUp; label: string; value: string; detail: string }) {
  return (
    <div style={{ background: "var(--paper)", borderRadius: "var(--radius-sm)", padding: "10px 12px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
        <Icon size={13} color="var(--text-faint)" />
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-faint)", textTransform: "uppercase", letterSpacing: "0.03em" }}>{label}</span>
      </div>
      <div style={{ fontSize: 16, fontWeight: 700 }}>{value}</div>
      {detail && <div style={{ fontSize: 11.5, color: "var(--text-soft)" }}>{detail}</div>}
    </div>
  );
}
