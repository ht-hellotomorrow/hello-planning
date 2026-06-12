"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import {
  ChevronDown,
  ChevronRight,
  Plus,
} from "lucide-react";
import { CategoryBadge } from "./CategoryBadge";
import { ProjectTimelineRow } from "./ProjectTimelineRow";
import {
  type Category,
  CATEGORY_LABEL,
  CATEGORY_ORDER,
} from "@/lib/categories";
import { assignLanes } from "@/lib/lanes";
import {
  formatTotal,
  PERSON_ROW_HEIGHT,
  projectRowHeight,
  SELECT_PROJECT_ROW_HEIGHT,
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
import { totalPlannedDays } from "@/lib/timeline-rows";

type Props = {
  people: Person[];
  projects: Project[];
  optimisticSegments: AllocationSegment[];
  weekISOs: string[];
  todayWeekIndex: number;
  rangeStart: Date;
  collapsedCategories: Set<Category>;
  collapsedProjects: Set<string>;
  hoveredRowKey: string | null;
  drag: DragState;
  onToggleCategory: (category: Category) => void;
  onToggleProject: (projectId: string) => void;
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

export function ProjectsView({
  people,
  projects,
  optimisticSegments,
  weekISOs,
  todayWeekIndex,
  rangeStart,
  collapsedCategories,
  collapsedProjects,
  hoveredRowKey,
  drag,
  onToggleCategory,
  onToggleProject,
  onSetHoveredRowKey,
  onOpenCreateForPerson,
  onStartCreateDrag,
  onStartMove,
  onStartResize,
  onDelete,
  onSplit,
  onEdit,
}: Props) {
  const totalGridWidth = WEEKS_TOTAL * WEEK_WIDTH;

  const personById = useMemo(
    () => Object.fromEntries(people.map((p) => [p.id, p])),
    [people],
  );

  const tree = useMemo(() => {
    const projectPersonMap = new Map<string, Set<string>>();
    for (const seg of optimisticSegments) {
      const set = projectPersonMap.get(seg.projectId) ?? new Set();
      set.add(seg.personId);
      projectPersonMap.set(seg.projectId, set);
    }

    return CATEGORY_ORDER.map((category) => {
      const categoryProjects = projects
        .filter((p) => p.category === category)
        .filter((p) => projectPersonMap.has(p.id))
        .sort((a, b) =>
          a.name.localeCompare(b.name, "en", {
            numeric: true,
            sensitivity: "base",
          }),
        );

      const projectNodes = categoryProjects.map((project) => {
        const personIds = [...(projectPersonMap.get(project.id) ?? [])].sort(
          (a, b) => {
            const pa = personById[a];
            const pb = personById[b];
            const ai = people.findIndex((p) => p.id === a);
            const bi = people.findIndex((p) => p.id === b);
            if (ai !== bi) return ai - bi;
            return (pa?.firstName ?? "").localeCompare(
              pb?.firstName ?? "",
              "en",
              { numeric: true, sensitivity: "base" },
            );
          },
        );
        return { project, personIds };
      });

      return { category, projects: projectNodes };
    }).filter((g) => g.projects.length > 0);
  }, [optimisticSegments, projects, personById, people]);

  return (
    <>
      {tree.map(({ category, projects: categoryProjects }, catIndex) => {
        const categoryExpanded = !collapsedCategories.has(category);
        const isLastCategory = catIndex === tree.length - 1;

        return (
          <div
            key={category}
            className={!isLastCategory ? "border-b border-grid-line" : ""}
          >
            <div className="flex" style={{ height: PERSON_ROW_HEIGHT }}>
              <button
                type="button"
                onClick={() => onToggleCategory(category)}
                className="shrink-0 flex items-center gap-2 pl-2 pr-3 border-r border-border sticky left-0 bg-background text-left w-full focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/30"
                style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
              >
                {categoryExpanded ? (
                  <ChevronDown size={16} className="text-muted-foreground shrink-0" aria-hidden />
                ) : (
                  <ChevronRight size={16} className="text-muted-foreground shrink-0" aria-hidden />
                )}
                <CategoryBadge category={category} />
                <span className="text-sm font-semibold truncate">
                  {CATEGORY_LABEL[category]}
                </span>
              </button>
              <div
                className="bg-muted"
                style={{ width: totalGridWidth }}
              />
            </div>

            {categoryExpanded &&
              categoryProjects.map(({ project, personIds }) => {
                const projectExpanded = !collapsedProjects.has(project.id);
                const projectSegs = optimisticSegments.filter(
                  (s) => s.projectId === project.id,
                );
                const projectTotal = totalPlannedDays(
                  projectSegs,
                  rangeStart,
                  WEEKS_TOTAL,
                );

                return (
                  <div key={project.id}>
                    <div className="flex" style={{ height: PERSON_ROW_HEIGHT }}>
                      <button
                        type="button"
                        onClick={() => onToggleProject(project.id)}
                        className="shrink-0 flex items-center gap-2 pl-6 pr-3 border-r border-border sticky left-0 bg-background text-left focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand/30"
                        style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
                      >
                        {projectExpanded ? (
                          <ChevronDown size={14} className="text-muted-foreground shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground shrink-0" aria-hidden />
                        )}
                        <span className="text-sm font-medium truncate flex-1">
                          {project.code ?? project.name}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {formatTotal(projectTotal)}
                        </span>
                      </button>
                      <div
                        className="bg-muted"
                        style={{ width: totalGridWidth }}
                      />
                    </div>

                    {projectExpanded &&
                      personIds.map((personId) => {
                        const person = personById[personId];
                        if (!person) return null;
                        const projSegs = optimisticSegments.filter(
                          (s) =>
                            s.projectId === project.id &&
                            s.personId === personId,
                        );
                        const { laned, count: laneCount } =
                          assignLanes(projSegs);
                        const rowHeight = projectRowHeight(laneCount);
                        const totalDays = totalPlannedDays(
                          projSegs,
                          rangeStart,
                          WEEKS_TOTAL,
                        );
                        const rowKey = `${project.id}:${personId}`;
                        const highlighted = hoveredRowKey === rowKey;
                        const fullName =
                          `${person.firstName} ${person.lastName}`.trim();

                        return (
                          <div
                            key={rowKey}
                            className={`flex ${highlighted ? "bg-muted-hover" : ""}`}
                            style={{ height: rowHeight }}
                            onMouseEnter={() => onSetHoveredRowKey(rowKey)}
                            onMouseLeave={() => onSetHoveredRowKey(null)}
                          >
                            <PersonUnderProjectSidebar
                              person={person}
                              totalDays={totalDays}
                              highlighted={highlighted}
                            />
                            <ProjectTimelineRow
                              personId={personId}
                              projectId={project.id}
                              rowHeight={rowHeight}
                              segments={laned}
                              project={project}
                              weekISOs={weekISOs}
                              rangeStart={rangeStart}
                              drag={drag}
                              highlighted={highlighted}
                              barLabel={() => fullName}
                              onMouseEnter={() => onSetHoveredRowKey(rowKey)}
                              onMouseLeave={() => onSetHoveredRowKey(null)}
                              onStartCreate={(clientX) =>
                                onStartCreateDrag(
                                  personId,
                                  project.id,
                                  clientX,
                                )
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

                    {projectExpanded && (
                      <AssignPersonRow
                        people={people}
                        assignedPersonIds={personIds}
                        projectId={project.id}
                        onAssign={onOpenCreateForPerson}
                        totalGridWidth={totalGridWidth}
                      />
                    )}
                  </div>
                );
              })}
          </div>
        );
      })}
    </>
  );
}

function AssignPersonRow({
  people,
  assignedPersonIds,
  projectId,
  onAssign,
  totalGridWidth,
}: {
  people: Person[];
  assignedPersonIds: string[];
  projectId: string;
  onAssign: (
    personId: string,
    personName: string,
    defaultProjectId?: string,
  ) => void;
  totalGridWidth: number;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [open]);

  const candidates = people;

  return (
    <div className="flex" style={{ height: SELECT_PROJECT_ROW_HEIGHT }}>
      <div
        ref={rootRef}
        className="shrink-0 pl-12 pr-3 flex items-center sticky left-0 bg-background border-r border-border relative"
        style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full border border-border rounded-md px-3 py-1.5 text-sm font-medium hover:bg-muted flex items-center justify-center gap-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30"
        >
          <Plus size={14} aria-hidden />
          Assign person
        </button>
        {open && (
          <ul className="absolute left-12 right-3 top-full mt-1 z-50 py-1 rounded-md border border-border bg-background shadow-lg max-h-48 overflow-y-auto">
            {candidates.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onAssign(p.id, p.firstName, projectId);
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                >
                  {p.firstName} {p.lastName}
                  {assignedPersonIds.includes(p.id) && (
                    <span className="text-muted-foreground text-xs ml-1">
                      (assigned)
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="bg-muted" style={{ width: totalGridWidth }} />
    </div>
  );
}

function PersonUnderProjectSidebar({
  person,
  totalDays,
  highlighted,
}: {
  person: Person;
  totalDays: number;
  highlighted: boolean;
}) {
  const initials = `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`;
  const fullName = `${person.firstName} ${person.lastName}`.trim();

  return (
    <div
      className={`shrink-0 flex items-center gap-2 pl-10 pr-3 border-r border-border sticky left-0 ${
        highlighted ? "bg-muted-hover" : "bg-background"
      }`}
      style={{ width: SIDEBAR_WIDTH, zIndex: SIDEBAR_Z_INDEX }}
    >
      {person.propicUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={person.propicUrl}
          alt=""
          className="w-6 h-6 rounded-full object-cover shrink-0"
        />
      ) : (
        <span className="w-6 h-6 rounded-full bg-muted border border-border text-[10px] font-semibold flex items-center justify-center shrink-0">
          {initials}
        </span>
      )}
      <span className="text-sm truncate flex-1">{fullName}</span>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatTotal(totalDays)}
      </span>
    </div>
  );
}
