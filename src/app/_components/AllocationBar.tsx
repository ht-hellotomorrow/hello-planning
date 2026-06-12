"use client";

import { ChevronLeft, ChevronRight, User } from "lucide-react";
import { projectColor, isPersonal } from "@/lib/colors";
import {
  LANE_GAP,
  LANE_HEIGHT,
  RESIZE_HANDLE,
  WEEK_WIDTH,
  WEEKS_TOTAL,
} from "@/lib/timeline-layout";
import type { AllocationSegment, Project } from "@/lib/timeline-types";
import { parseISO, weeksBetween } from "@/lib/weeks";

type Props = {
  segment: AllocationSegment;
  laneIndex: number;
  project: Project;
  rangeStart: Date;
  dragging: boolean;
  label: string;
  onStartMove: (clientX: number) => void;
  onStartResize: (edge: "left" | "right", clientX: number) => void;
  onDelete: () => void;
  onSplit: (clientX: number) => void;
  onEdit: () => void;
};

export function AllocationBar({
  segment,
  laneIndex,
  project,
  rangeStart,
  dragging,
  label,
  onStartMove,
  onStartResize,
  onDelete,
  onSplit,
  onEdit,
}: Props) {
  const segStart = parseISO(segment.startWeek);
  const segEnd = parseISO(segment.endWeek);
  const startIdx = weeksBetween(rangeStart, segStart);
  const endIdx = weeksBetween(rangeStart, segEnd);
  const clampedStart = Math.max(0, startIdx);
  const clampedEnd = Math.min(WEEKS_TOTAL - 1, endIdx);
  if (clampedEnd < 0 || clampedStart >= WEEKS_TOTAL) return null;

  const left = clampedStart * WEEK_WIDTH + 4;
  const width = (clampedEnd - clampedStart + 1) * WEEK_WIDTH - 8;
  const overflowsLeft = startIdx < 0;
  const overflowsRight = endIdx > WEEKS_TOTAL - 1;
  const top = LANE_GAP + laneIndex * (LANE_HEIGHT + LANE_GAP);

  const color = projectColor(project);
  const personal = isPersonal(project);
  const isArchived = project.visibility === "archived";

  function onBarMouseDown(e: React.MouseEvent) {
    if (isArchived) return;
    if (e.button !== 0) return;
    e.stopPropagation();
    if (e.shiftKey) {
      onSplit(e.clientX);
      return;
    }
    onStartMove(e.clientX);
  }

  function onResizeEdgeMouseDown(
    e: React.MouseEvent,
    edge: "left" | "right",
  ) {
    if (isArchived) return;
    if (e.button !== 0) return;
    onStartResize(edge, e.clientX);
    e.stopPropagation();
  }

  function onContextMenu(e: React.MouseEvent) {
    e.preventDefault();
    if (isArchived) return;
    if (window.confirm(`Delete schedule on ${project.name}?`)) {
      onDelete();
    }
  }

  return (
    <div
      onMouseDown={onBarMouseDown}
      onContextMenu={onContextMenu}
      onDoubleClick={(e) => {
        if (isArchived) return;
        e.stopPropagation();
        onEdit();
      }}
      className={`absolute rounded-md px-2 text-xs font-medium overflow-hidden flex items-center gap-1 group ${
        isArchived
          ? "text-zinc-700 cursor-default"
          : personal
            ? "text-zinc-800 cursor-grab active:cursor-grabbing"
            : "text-white cursor-grab active:cursor-grabbing"
      } ${personal ? "border-2 border-dashed border-zinc-500" : ""} ${
        dragging ? "ring-2 ring-brand opacity-90 z-20 shadow-lg" : "z-10"
      }`}
      style={{
        top,
        height: LANE_HEIGHT,
        left,
        width,
        backgroundColor: color,
        opacity: isArchived ? 0.6 : dragging ? 0.9 : 1,
      }}
      title={`${label}\nDouble-click to edit · Shift+click to split · Right-click to delete`}
    >
      {!isArchived && (
        <div
          onMouseDown={(e) => onResizeEdgeMouseDown(e, "left")}
          className="absolute left-0 top-0 bottom-0 cursor-ew-resize z-10 hover:bg-black/10"
          style={{ width: RESIZE_HANDLE }}
        />
      )}

      {overflowsLeft && (
        <ChevronLeft size={12} className="opacity-60 shrink-0" aria-hidden />
      )}
      {personal && <User size={12} className="shrink-0" aria-hidden />}
      <span className="truncate flex-1 pointer-events-none">{label}</span>

      {overflowsRight && (
        <ChevronRight size={12} className="opacity-60 shrink-0" aria-hidden />
      )}

      {!isArchived && (
        <div
          onMouseDown={(e) => onResizeEdgeMouseDown(e, "right")}
          className="absolute right-0 top-0 bottom-0 cursor-ew-resize z-10 hover:bg-black/10"
          style={{ width: RESIZE_HANDLE }}
        />
      )}
    </div>
  );
}
