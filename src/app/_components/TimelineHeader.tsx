"use client";

import {
  ChevronsDownUp,
  ChevronsUpDown,
  Info,
} from "lucide-react";
import { SidebarTabs } from "./SidebarTabs";
import { TodayLine } from "./TodayLine";
import {
  HEADER_HEIGHT,
  SIDEBAR_WIDTH,
  SIDEBAR_Z_INDEX,
  WEEK_WIDTH,
  WEEKS_TOTAL,
} from "@/lib/timeline-layout";
import type { ViewMode } from "@/lib/timeline-types";
import { isoDate, weekDayLabel } from "@/lib/weeks";

type MonthGroup = { label: string; count: number };

type Props = {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onToggleExpandAll: () => void;
  allExpanded: boolean;
  expandDisabled: boolean;
  onOpenShortcuts: () => void;
  months: MonthGroup[];
  weeks: Date[];
  todayWeekIndex: number;
  totalGridWidth: number;
};

export function TimelineHeader({
  viewMode,
  onViewModeChange,
  onToggleExpandAll,
  allExpanded,
  expandDisabled,
  onOpenShortcuts,
  months,
  weeks,
  todayWeekIndex,
  totalGridWidth,
}: Props) {
  const weekGridStyle = {
    gridTemplateColumns: `repeat(${WEEKS_TOTAL}, ${WEEK_WIDTH}px)`,
  } as const;

  return (
    <div
      className="sticky top-0 z-20 flex bg-background border-b border-grid-line"
      style={{ height: HEADER_HEIGHT }}
    >
      <div
        className="shrink-0 px-2 flex flex-col justify-end gap-2 pb-2 border-r border-border sticky left-0 bg-background"
        style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
      >
        <SidebarTabs value={viewMode} onChange={onViewModeChange} />
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleExpandAll}
            disabled={expandDisabled}
            title={allExpanded ? "Collapse all" : "Expand all"}
            aria-label={allExpanded ? "Collapse all" : "Expand all"}
            className="p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-brand/30"
          >
            {allExpanded ? (
              <ChevronsDownUp size={16} aria-hidden />
            ) : (
              <ChevronsUpDown size={16} aria-hidden />
            )}
          </button>
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="p-1 rounded hover:bg-muted text-muted-foreground focus:outline-none focus:ring-2 focus:ring-brand/30"
            aria-label="Keyboard shortcuts"
            title="Shortcuts"
          >
            <Info size={16} aria-hidden />
          </button>
        </div>
      </div>
      <div className="relative bg-muted" style={{ width: totalGridWidth }}>
        <TodayLine style={{ left: todayWeekIndex * WEEK_WIDTH }} />
        <div className="grid" style={{ ...weekGridStyle, height: 32 }}>
          {months.map((m, i) => (
            <div
              key={`${m.label}-${i}`}
              className="px-2 py-2 text-xs font-semibold text-muted-foreground border-r border-grid-line last:border-r-0 truncate"
              style={{ gridColumn: `span ${m.count}` }}
            >
              {m.label}
            </div>
          ))}
        </div>
        <div
          className="grid border-t border-grid-line"
          style={{ ...weekGridStyle, height: 32 }}
        >
          {weeks.map((w, i) => {
            const isToday = i === todayWeekIndex;
            return (
              <div
                key={isoDate(w)}
                className={`px-2 py-2 text-xs tabular-nums border-r border-grid-line last:border-r-0 ${
                  isToday
                    ? "text-foreground font-semibold"
                    : "text-muted-foreground"
                }`}
              >
                {weekDayLabel(w)}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
