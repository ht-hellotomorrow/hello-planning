"use client";

import { ChevronDown, ChevronRight, GripVertical } from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { ProjectTimelineRow } from "./ProjectTimelineRow";
import { assignLanes } from "@/lib/lanes";
import {
  formatTotal,
  PERSON_ROW_HEIGHT,
  PROJECT_ROW_DRAG,
  projectRowHeight,
  SIDEBAR_WIDTH,
  SIDEBAR_Z_INDEX,
  WEEK_WIDTH,
  WEEKS_TOTAL,
} from "@/lib/timeline-layout";
import type {
  AllocationSegment,
  DragState,
  Person,
  Project,
} from "@/lib/timeline-types";
import {
  totalPlannedDays,
  weeklyTotalsForSegments,
} from "@/lib/timeline-rows";

type Props = {
  people: Person[];
  projectById: Record<string, Project>;
  optimisticSegments: AllocationSegment[];
  weekISOs: string[];
  todayWeekIndex: number;
  rangeStart: Date;
  collapsedPeople: Set<string>;
  dragOverProjectId: string | null;
  hoveredRowKey: string | null;
  drag: DragState;
  getProjectOrder: (personId: string, projectIds: string[]) => string[];
  onTogglePerson: (personId: string) => void;
  onSetDragOverProjectId: (id: string | null) => void;
  onReorderProjects: (
    personId: string,
    fromId: string,
    toId: string,
  ) => void;
  onSetHoveredRowKey: (key: string | null) => void;
  onOpenCreateForPerson: (
    personId: string,
    personName: string,
    defaultProjectId?: string,
  ) => void;
  onStartCreateDrag: (
    personId: string,
    projectId: string | undefined,
    clientX: number,
  ) => void;
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

export function PeopleView({
  people,
  projectById,
  optimisticSegments,
  weekISOs,
  todayWeekIndex,
  rangeStart,
  collapsedPeople,
  dragOverProjectId,
  hoveredRowKey,
  drag,
  getProjectOrder,
  onTogglePerson,
  onSetDragOverProjectId,
  onReorderProjects,
  onSetHoveredRowKey,
  onOpenCreateForPerson,
  onStartCreateDrag,
  onStartMove,
  onStartResize,
  onDelete,
  onSplit,
  onEdit,
}: Props) {
  return (
    <>
      {people.map((p, personIndex) => {
        const personSegs = optimisticSegments.filter(
          (s) => s.personId === p.id,
        );
        const projectIds = getProjectOrder(
          p.id,
          personSegs.map((s) => s.projectId),
        );
        const expanded = !collapsedPeople.has(p.id);
        const countableSegs = personSegs.filter(
          (s) => projectById[s.projectId]?.category !== "personal",
        );
        const weeklyTotals = weeklyTotalsForSegments(
          countableSegs,
          weekISOs,
        );

        return (
          <div
            key={p.id}
            className={
              personIndex < people.length - 1 ? "border-b border-grid-line" : ""
            }
          >
            <div
              role="button"
              tabIndex={0}
              aria-expanded={expanded}
              aria-label={`${p.firstName} ${p.lastName}`}
              className="flex cursor-pointer hover:bg-muted-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand/30"
              style={{ height: PERSON_ROW_HEIGHT }}
              onClick={() => onTogglePerson(p.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onTogglePerson(p.id);
                }
              }}
            >
              <PersonSidebarHeader person={p} expanded={expanded} />
              <PersonWeeklyTotalsRow
                weeklyTotals={weeklyTotals}
                capacity={p.capacityDaysPerWeek}
                weekISOs={weekISOs}
              />
            </div>

            {expanded &&
              projectIds.map((projectId) => {
                const project = projectById[projectId];
                if (!project) return null;
                const projSegs = personSegs.filter(
                  (s) => s.projectId === projectId,
                );
                const { laned, count: laneCount } = assignLanes(projSegs);
                const rowHeight = projectRowHeight(laneCount);
                const totalDays = totalPlannedDays(
                  projSegs,
                  rangeStart,
                  WEEKS_TOTAL,
                );
                const rowKey = `${p.id}:${projectId}`;
                const highlighted = hoveredRowKey === rowKey;

                return (
                  <div
                    key={rowKey}
                    className={`flex ${highlighted ? "bg-muted-hover" : ""}`}
                    style={{ height: rowHeight }}
                    onMouseEnter={() => onSetHoveredRowKey(rowKey)}
                    onMouseLeave={() => onSetHoveredRowKey(null)}
                  >
                    <ProjectSidebarRow
                      project={project}
                      totalDays={totalDays}
                      personId={p.id}
                      projectId={projectId}
                      highlighted={highlighted}
                      isDragOver={dragOverProjectId === projectId}
                      onDragOver={(e) => {
                        if (
                          !e.dataTransfer.types.includes(PROJECT_ROW_DRAG)
                        )
                          return;
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        onSetDragOverProjectId(projectId);
                      }}
                      onDragLeave={() => {
                        if (dragOverProjectId === projectId) {
                          onSetDragOverProjectId(null);
                        }
                      }}
                      onDrop={(fromProjectId) => {
                        onSetDragOverProjectId(null);
                        onReorderProjects(p.id, fromProjectId, projectId);
                      }}
                      onAssign={() =>
                        onOpenCreateForPerson(p.id, p.firstName, projectId)
                      }
                    />
                    <ProjectTimelineRow
                      personId={p.id}
                      projectId={projectId}
                      rowHeight={rowHeight}
                      segments={laned}
                      project={project}
                      weekISOs={weekISOs}
                      rangeStart={rangeStart}
                      drag={drag}
                      highlighted={highlighted}
                      barLabel={(s) => {
                        const proj = projectById[s.projectId];
                        return proj?.code ?? proj?.name ?? "";
                      }}
                      onMouseEnter={() => onSetHoveredRowKey(rowKey)}
                      onMouseLeave={() => onSetHoveredRowKey(null)}
                      onStartCreate={(clientX) =>
                        onStartCreateDrag(p.id, projectId, clientX)
                      }
                      onStartMove={onStartMove}
                      onStartResize={onStartResize}
                      onDelete={onDelete}
                      onSplit={onSplit}
                      onEdit={onEdit}
                    />
                  </div>
                );
              })}
          </div>
        );
      })}
    </>
  );
}

function PersonSidebarHeader({
  person,
  expanded,
}: {
  person: Person;
  expanded: boolean;
}) {
  const initials = `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`;
  const fullName = `${person.firstName} ${person.lastName}`.trim();

  return (
    <div
      className="shrink-0 flex items-center gap-1 pl-2 pr-2 border-r border-border sticky left-0 bg-background pointer-events-none"
      style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
    >
      <span className="p-0.5 text-muted-foreground" aria-hidden>
        {expanded ? (
          <ChevronDown size={16} />
        ) : (
          <ChevronRight size={16} />
        )}
      </span>
      <div
        className="flex items-center gap-2 min-w-0 flex-1"
        title={fullName}
      >
        {person.propicUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={person.propicUrl}
            alt=""
            className="w-7 h-7 rounded-full object-cover shrink-0"
          />
        ) : (
          <span className="w-7 h-7 rounded-full bg-background border border-border text-xs font-semibold flex items-center justify-center shrink-0">
            {initials}
          </span>
        )}
        <span className="text-sm font-medium truncate">{fullName}</span>
      </div>
    </div>
  );
}

function ProjectSidebarRow({
  project,
  totalDays,
  personId,
  projectId,
  highlighted,
  isDragOver,
  onDragOver,
  onDragLeave,
  onDrop,
  onAssign,
}: {
  project: Project;
  totalDays: number;
  personId: string;
  projectId: string;
  highlighted: boolean;
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (fromProjectId: string) => void;
  onAssign: () => void;
}) {
  const label = project.code ?? project.name;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(
          PROJECT_ROW_DRAG,
          JSON.stringify({ personId, projectId }),
        );
        e.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        const raw = e.dataTransfer.getData(PROJECT_ROW_DRAG);
        if (!raw) return;
        e.preventDefault();
        try {
          const data = JSON.parse(raw) as {
            personId: string;
            projectId: string;
          };
          if (data.personId !== personId) return;
          onDrop(data.projectId);
        } catch {
          /* ignore */
        }
      }}
      className={`shrink-0 flex items-center gap-1 pl-1 pr-3 border-r border-border sticky left-0 cursor-grab active:cursor-grabbing ${
        isDragOver
          ? "bg-brand-soft"
          : highlighted
            ? "bg-muted-hover"
            : "bg-background"
      }`}
      style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
    >
      <GripVertical
        size={14}
        className="shrink-0 text-muted-foreground/50"
        aria-hidden
      />
      <CategoryBadge category={project.category} />
      <button
        type="button"
        onClick={onAssign}
        className="text-sm truncate flex-1 text-left hover:underline min-w-0"
        title={label}
      >
        {label}
      </button>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatTotal(totalDays)}
      </span>
    </div>
  );
}

function PersonWeeklyTotalsRow({
  weeklyTotals,
  capacity,
  weekISOs,
}: {
  weeklyTotals: number[];
  capacity: number;
  weekISOs: string[];
}) {
  return (
    <div
      className="grid bg-muted pointer-events-none"
      style={{
        gridTemplateColumns: `repeat(${weekISOs.length}, ${WEEK_WIDTH}px)`,
        height: PERSON_ROW_HEIGHT,
      }}
    >
      {weeklyTotals.map((total, i) => {
        const over = total > capacity;
        const empty = total === 0;
        return (
          <div
            key={weekISOs[i]}
            title={
              empty
                ? undefined
                : `${formatTotal(total)} / ${capacity} d/wk${over ? " · overbooked" : ""}`
            }
            className={`flex items-center justify-center text-xs tabular-nums border-r border-grid-line last:border-r-0 ${
              empty
                ? "text-transparent"
                : over
                  ? "text-red-600 font-semibold"
                  : "text-muted-foreground"
            }`}
          >
            {formatTotal(total)}
          </div>
        );
      })}
    </div>
  );
}
