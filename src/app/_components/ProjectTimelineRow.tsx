"use client";

import { useRef } from "react";
import { AllocationBar } from "./AllocationBar";
import { WEEK_WIDTH, WEEKS_TOTAL } from "@/lib/timeline-layout";
import type {
  AllocationSegment,
  DragState,
  Project,
} from "@/lib/timeline-types";

type Props = {
  personId: string;
  projectId: string;
  rowHeight: number;
  segments: Array<AllocationSegment & { lane: number }>;
  project: Project;
  weekISOs: string[];
  rangeStart: Date;
  drag: DragState;
  barLabel: (segment: AllocationSegment) => string;
  highlighted: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onStartCreate: (clientX: number) => void;
  onStartMove: (segment: AllocationSegment, clientX: number) => void;
  onStartResize: (
    segment: AllocationSegment,
    edge: "left" | "right",
    clientX: number,
  ) => void;
  onDelete: (segId: string) => void;
  onSplit: (segment: AllocationSegment, clientX: number) => void;
  onEdit: (segment: AllocationSegment) => void;
};

export function ProjectTimelineRow({
  personId,
  projectId,
  rowHeight,
  segments,
  project,
  weekISOs,
  rangeStart,
  drag,
  barLabel,
  highlighted,
  onMouseEnter,
  onMouseLeave,
  onStartCreate,
  onStartMove,
  onStartResize,
  onDelete,
  onSplit,
  onEdit,
}: Props) {
  const rowRef = useRef<HTMLDivElement>(null);

  function onRowMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    onStartCreate(e.clientX);
  }

  const createPreview =
    drag?.kind === "create" &&
    drag.personId === personId &&
    drag.projectId === projectId
      ? (() => {
          const start = Math.min(drag.anchorIdx, drag.currentIdx);
          const end = Math.max(drag.anchorIdx, drag.currentIdx);
          return { start, end };
        })()
      : null;

  return (
    <div
      ref={rowRef}
      onMouseDown={onRowMouseDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      className={`relative transition-colors cursor-crosshair select-none ${
        highlighted ? "bg-muted-hover" : "bg-muted"
      }`}
      style={{ width: weekISOs.length * WEEK_WIDTH, height: rowHeight }}
    >
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{
          gridTemplateColumns: `repeat(${weekISOs.length}, ${WEEK_WIDTH}px)`,
        }}
      >
        {weekISOs.map((iso) => (
          <div
            key={iso}
            className="border-r border-grid-line last:border-r-0"
          />
        ))}
      </div>

      {segments.map((s) => {
        let startISO = s.startWeek;
        let endISO = s.endWeek;
        let dragging = false;
        if (drag?.kind === "move" && drag.segmentId === s.id) {
          const offset = drag.currentMouseIdx - drag.mouseAnchorIdx;
          const newStartIdx = Math.max(
            0,
            Math.min(WEEKS_TOTAL - 1, drag.originalStartIdx + offset),
          );
          const newEndIdx = Math.max(
            0,
            Math.min(WEEKS_TOTAL - 1, drag.originalEndIdx + offset),
          );
          startISO = weekISOs[newStartIdx];
          endISO = weekISOs[newEndIdx];
          dragging = true;
        } else if (drag?.kind === "resize" && drag.segmentId === s.id) {
          let newStart = drag.originalStartIdx;
          let newEnd = drag.originalEndIdx;
          if (drag.edge === "left") {
            newStart = Math.min(drag.currentIdx, drag.originalEndIdx);
          } else {
            newEnd = Math.max(drag.currentIdx, drag.originalStartIdx);
          }
          startISO = weekISOs[newStart];
          endISO = weekISOs[newEnd];
          dragging = true;
        }

        const seg = { ...s, startWeek: startISO, endWeek: endISO };

        return (
          <AllocationBar
            key={s.id}
            segment={seg}
            laneIndex={s.lane}
            project={project}
            rangeStart={rangeStart}
            dragging={dragging}
            label={barLabel(s)}
            onStartMove={(clientX) => onStartMove(seg, clientX)}
            onStartResize={(edge, clientX) =>
              onStartResize(seg, edge, clientX)
            }
            onDelete={() => onDelete(s.id)}
            onSplit={(clientX) => onSplit(s, clientX)}
            onEdit={() => onEdit(s)}
          />
        );
      })}

      {createPreview && (
        <div
          className="absolute top-1 bottom-1 rounded-md bg-brand/30 border-2 border-brand pointer-events-none flex items-center justify-center text-xs font-medium text-brand"
          style={{
            left: createPreview.start * WEEK_WIDTH + 4,
            width:
              (createPreview.end - createPreview.start + 1) * WEEK_WIDTH - 8,
          }}
        >
          {createPreview.end - createPreview.start + 1} sett.
        </div>
      )}
    </div>
  );
}
