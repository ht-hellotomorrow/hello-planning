import { SIDEBAR_WIDTH, WEEK_WIDTH } from "@/lib/timeline-layout";
import { TodayLine } from "./TodayLine";

type Props = {
  todayWeekIndex: number;
};

export function TodayMarker({ todayWeekIndex }: Props) {
  return (
    <TodayLine
      className="inset-y-0"
      style={{ left: SIDEBAR_WIDTH + todayWeekIndex * WEEK_WIDTH }}
    />
  );
}
