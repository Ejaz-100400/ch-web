import { useState } from "react";
import { CalendarHeatmap } from "./CalendarHeatmap";
import { DayLineChart } from "./DayLineChart";

interface CalendarTabProps {
  month: string;
  category: string[];
  employeeId: string[];
  carMake: string[];
  carModel: string[];
  sentiment: string[];
  productId: string[];
}

function shiftDay(iso: string, delta: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + delta);
  return d.toISOString().slice(0, 10);
}

export function CalendarTab(props: CalendarTabProps) {
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <CalendarHeatmap {...props} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      <DayLineChart
        day={selectedDay}
        onPrevDay={() => setSelectedDay((d) => shiftDay(d, -1))}
        onNextDay={() => setSelectedDay((d) => shiftDay(d, 1))}
        category={props.category}
        employeeId={props.employeeId}
        carMake={props.carMake}
        carModel={props.carModel}
        sentiment={props.sentiment}
        productId={props.productId}
      />
    </div>
  );
}
