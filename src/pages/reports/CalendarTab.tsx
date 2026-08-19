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

export function CalendarTab(props: CalendarTabProps) {
  const [selectedDay, setSelectedDay] = useState(() => new Date().toISOString().slice(0, 10));

  return (
    <div className="grid-responsive-2" style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: 16, alignItems: "start" }}>
      <CalendarHeatmap {...props} selectedDay={selectedDay} onSelectDay={setSelectedDay} />
      <DayLineChart
        day={selectedDay}
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
