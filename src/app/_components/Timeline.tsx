"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
  type RefObject,
} from "react";
import {
  addWeeks,
  firstMondayOfMonthOffset,
  groupByMonth,
  isoDate,
  parseISO,
  toMonday,
  weekRange,
  weeksBetween,
} from "@/lib/weeks";
import { assignLanes } from "@/lib/lanes";
import { sortProjectIds } from "@/lib/timeline-rows";
import {
  createSegment,
  deleteSegment,
  splitSegment,
  updateSegment,
} from "@/app/actions/allocations";
import { savePersonProjectOrder } from "@/app/actions/person-project-order";
import { type Category } from "@/lib/categories";
import {
  SIDEBAR_WIDTH,
  WEEK_WIDTH,
  WEEKS_BEFORE_TODAY,
  WEEKS_TOTAL,
} from "@/lib/timeline-layout";
import type {
  AllocationSegment,
  DragState,
  OptimisticAction,
  Person,
  Project,
  ProjectOrderEntry,
  ViewMode,
} from "@/lib/timeline-types";
import {
  CreateSegmentModal,
  type CreateSegmentConfirmInput,
  type CreateSegmentDraft,
} from "./CreateSegmentModal";
import { PeopleView } from "./PeopleView";
import { ProjectsView } from "./ProjectsView";
import { markShortcutsSeen, shortcutsAlreadySeen, ShortcutsModal } from "./ShortcutsModal";
import { TimelineHeader } from "./TimelineHeader";
import { TodayMarker } from "./TodayMarker";

export type TimelineProps = {
  scrollRef: RefObject<HTMLDivElement | null>;
  people: Person[];
  projects: Project[];
  segments: AllocationSegment[];
  projectOrder: ProjectOrderEntry[];
  todayISO: string;
};

function optimisticReducer(
  current: AllocationSegment[],
  action: OptimisticAction,
): AllocationSegment[] {
  switch (action.type) {
    case "create":
      return [...current, action.segment];
    case "update":
      return current.map((s) =>
        s.id === action.id ? { ...s, ...action.patch } : s,
      );
    case "delete":
      return current.filter((s) => s.id !== action.id);
  }
}

export function Timeline({
  scrollRef,
  people,
  projects,
  segments,
  projectOrder,
  todayISO,
}: TimelineProps) {
  const today = useMemo(() => parseISO(todayISO), [todayISO]);
  const todayMonday = useMemo(() => toMonday(today), [today]);
  const rangeStart = useMemo(
    () => addWeeks(todayMonday, -WEEKS_BEFORE_TODAY),
    [todayMonday],
  );
  const weeks = useMemo(
    () => weekRange(rangeStart, WEEKS_TOTAL),
    [rangeStart],
  );
  const weekISOs = useMemo(() => weeks.map(isoDate), [weeks]);
  const months = useMemo(() => groupByMonth(weeks), [weeks]);
  const projectById = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p])),
    [projects],
  );
  const projectNameById = useMemo(
    () =>
      Object.fromEntries(
        projects.map((p) => [p.id, p.code ?? p.name]),
      ),
    [projects],
  );
  const todayWeekIndex = WEEKS_BEFORE_TODAY;

  const serverOrderByPerson = useMemo(() => {
    const map = new Map<string, string[]>();
    const grouped = new Map<string, ProjectOrderEntry[]>();
    for (const row of projectOrder) {
      const list = grouped.get(row.personId) ?? [];
      list.push(row);
      grouped.set(row.personId, list);
    }
    for (const [personId, rows] of grouped) {
      map.set(
        personId,
        [...rows]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((r) => r.projectId),
      );
    }
    return map;
  }, [projectOrder]);

  const [viewMode, setViewMode] = useState<ViewMode>("people");
  const [orderOverrides, setOrderOverrides] = useState<
    Record<string, string[]>
  >({});
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedCategories, setCollapsedCategories] = useState<
    Set<Category>
  >(() => new Set());
  const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
    () => new Set(),
  );
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(
    null,
  );
  const [hoveredRowKey, setHoveredRowKey] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(() => !shortcutsAlreadySeen());

  const [optimisticSegments, applyOptimistic] = useOptimistic(
    segments,
    optimisticReducer,
  );
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  function notifyError(scope: string, err: unknown) {
    const msg =
      err instanceof Error ? err.message : `${scope} failed unexpectedly`;
    setActionError(msg);
    console.error(scope, err);
  }

  useEffect(() => {
    if (!actionError) return;
    const t = setTimeout(() => setActionError(null), 5000);
    return () => clearTimeout(t);
  }, [actionError]);

  const [drag, setDrag] = useState<DragState>(null);
  const [pendingCreate, setPendingCreate] =
    useState<CreateSegmentDraft | null>(null);
  const dragRef = useRef<DragState>(null);
  dragRef.current = drag;

  const initialScrollLeft = useMemo(() => {
    const target = firstMondayOfMonthOffset(today, -1);
    const idx = weeksBetween(rangeStart, target);
    return Math.max(0, idx) * WEEK_WIDTH;
  }, [today, rangeStart]);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!scrollRef.current || initialized) return;
    scrollRef.current.scrollLeft = initialScrollLeft;
    setInitialized(true);
  }, [initialScrollLeft, initialized, scrollRef]);

  const allPeopleExpanded =
    people.length > 0 && collapsedPeople.size === 0;

  const allProjectsExpanded =
    collapsedCategories.size === 0 && collapsedProjects.size === 0;

  function toggleAllExpanded() {
    if (viewMode === "people") {
      if (allPeopleExpanded) {
        setCollapsedPeople(new Set(people.map((p) => p.id)));
      } else {
        setCollapsedPeople(new Set());
      }
      return;
    }
    if (allProjectsExpanded) {
      const allCategories = new Set<Category>([
        "ht_internal",
        "ht_client",
        "personal",
      ]);
      const allProjectIds = new Set(
        projects.map((p) => p.id),
      );
      setCollapsedCategories(allCategories);
      setCollapsedProjects(allProjectIds);
    } else {
      setCollapsedCategories(new Set());
      setCollapsedProjects(new Set());
    }
  }

  function getProjectOrder(personId: string, projectIds: string[]): string[] {
    const override = orderOverrides[personId];
    const server = serverOrderByPerson.get(personId);
    return sortProjectIds(
      projectIds,
      override ?? server,
      projectNameById,
    );
  }

  const reorderProjects = useCallback(
    (personId: string, fromId: string, toId: string) => {
      if (fromId === toId) return;
      const segs = optimisticSegments.filter((s) => s.personId === personId);
      const ids = [...new Set(segs.map((s) => s.projectId))];
      const current = sortProjectIds(
        ids,
        orderOverrides[personId] ?? serverOrderByPerson.get(personId),
        projectNameById,
      );
      const fromIdx = current.indexOf(fromId);
      const toIdx = current.indexOf(toId);
      if (fromIdx < 0 || toIdx < 0) return;
      const next = [...current];
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, fromId);
      setOrderOverrides((prev) => ({ ...prev, [personId]: next }));
      startTransition(async () => {
        try {
          await savePersonProjectOrder(personId, next);
        } catch (err) {
          notifyError("Reorder", err);
        }
      });
    },
    [
      optimisticSegments,
      orderOverrides,
      serverOrderByPerson,
      projectNameById,
    ],
  );

  useEffect(() => {
    if (!drag) return;

    function clientToWeekIdx(clientX: number): number {
      const scroller = scrollRef.current;
      if (!scroller) return 0;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller =
        clientX - scRect.left + scroller.scrollLeft - SIDEBAR_WIDTH;
      return Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
    }

    function onMove(e: MouseEvent) {
      const idx = clientToWeekIdx(e.clientX);
      setDrag((prev) => {
        if (!prev) return prev;
        if (prev.kind === "create") return { ...prev, currentIdx: idx };
        if (prev.kind === "move") return { ...prev, currentMouseIdx: idx };
        if (prev.kind === "resize") return { ...prev, currentIdx: idx };
        return prev;
      });
    }

    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      if (d.kind === "create") {
        const start = Math.min(d.anchorIdx, d.currentIdx);
        const end = Math.max(d.anchorIdx, d.currentIdx);
        const person = people.find((p) => p.id === d.personId);
        setPendingCreate({
          personId: d.personId,
          personName: person?.firstName ?? "",
          startWeek: weekISOs[start],
          endWeek: weekISOs[end],
          defaultProjectId: d.projectId,
          datesFromDrag: true,
        });
      } else if (d.kind === "move") {
        const offset = d.currentMouseIdx - d.mouseAnchorIdx;
        if (offset !== 0) {
          const newStart = d.originalStartIdx + offset;
          const newEnd = d.originalEndIdx + offset;
          if (newStart >= 0 && newEnd < WEEKS_TOTAL) {
            const startISO = weekISOs[newStart];
            const endISO = weekISOs[newEnd];
            startTransition(async () => {
              applyOptimistic({
                type: "update",
                id: d.segmentId,
                patch: { startWeek: startISO, endWeek: endISO },
              });
              try {
                await updateSegment(d.segmentId, {
                  startWeek: startISO,
                  endWeek: endISO,
                });
              } catch (err) {
                notifyError("Move", err);
              }
            });
          }
        }
      } else if (d.kind === "resize") {
        let newStart = d.originalStartIdx;
        let newEnd = d.originalEndIdx;
        if (d.edge === "left") {
          newStart = Math.min(d.currentIdx, d.originalEndIdx);
        } else {
          newEnd = Math.max(d.currentIdx, d.originalStartIdx);
        }
        if (
          newStart !== d.originalStartIdx ||
          newEnd !== d.originalEndIdx
        ) {
          const startISO = weekISOs[newStart];
          const endISO = weekISOs[newEnd];
          startTransition(async () => {
            applyOptimistic({
              type: "update",
              id: d.segmentId,
              patch: { startWeek: startISO, endWeek: endISO },
            });
            try {
              await updateSegment(d.segmentId, {
                startWeek: startISO,
                endWeek: endISO,
              });
            } catch (err) {
              notifyError("Resize", err);
            }
          });
        }
      }
      setDrag(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, applyOptimistic, weekISOs, people]);

  const startCreateDrag = useCallback(
    (personId: string, projectId: string | undefined, clientX: number) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller =
        clientX - scRect.left + scroller.scrollLeft - SIDEBAR_WIDTH;
      const idx = Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
      setDrag({
        kind: "create",
        personId,
        projectId,
        anchorIdx: idx,
        currentIdx: idx,
      });
    },
    [],
  );

  const startMoveDrag = useCallback(
    (segment: AllocationSegment, clientX: number) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller =
        clientX - scRect.left + scroller.scrollLeft - SIDEBAR_WIDTH;
      const mouseIdx = Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
      const startIdx = weeksBetween(rangeStart, parseISO(segment.startWeek));
      const endIdx = weeksBetween(rangeStart, parseISO(segment.endWeek));
      setDrag({
        kind: "move",
        segmentId: segment.id,
        personId: segment.personId,
        originalStartIdx: startIdx,
        originalEndIdx: endIdx,
        mouseAnchorIdx: mouseIdx,
        currentMouseIdx: mouseIdx,
      });
    },
    [rangeStart],
  );

  const startResizeDrag = useCallback(
    (
      segment: AllocationSegment,
      edge: "left" | "right",
      clientX: number,
    ) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller =
        clientX - scRect.left + scroller.scrollLeft - SIDEBAR_WIDTH;
      const idx = Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
      const startIdx = weeksBetween(rangeStart, parseISO(segment.startWeek));
      const endIdx = weeksBetween(rangeStart, parseISO(segment.endWeek));
      setDrag({
        kind: "resize",
        segmentId: segment.id,
        personId: segment.personId,
        edge,
        originalStartIdx: startIdx,
        originalEndIdx: endIdx,
        currentIdx: idx,
      });
    },
    [rangeStart],
  );

  async function onConfirmCreate(input: CreateSegmentConfirmInput) {
    if (!pendingCreate) return;
    const draft = pendingCreate;
    setPendingCreate(null);

    if (draft.mode === "edit" && draft.segmentId) {
      const segId = draft.segmentId;
      startTransition(async () => {
        applyOptimistic({
          type: "update",
          id: segId,
          patch: {
            startWeek: input.startWeek,
            endWeek: input.endWeek,
            daysPerWeek: input.daysPerWeek,
          },
        });
        try {
          await updateSegment(segId, {
            startWeek: input.startWeek,
            endWeek: input.endWeek,
            daysPerWeek: input.daysPerWeek,
          });
        } catch (err) {
          notifyError("Edit", err);
        }
      });
      return;
    }

    const effectivePersonId = input.personId ?? draft.personId;
    if (!effectivePersonId) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const tempSegment: AllocationSegment = {
      id: tempId,
      personId: effectivePersonId,
      projectId: input.projectId,
      startWeek: input.startWeek,
      endWeek: input.endWeek,
      daysPerWeek: input.daysPerWeek,
    };
    startTransition(async () => {
      applyOptimistic({ type: "create", segment: tempSegment });
      try {
        await createSegment({
          personId: effectivePersonId,
          projectId: input.projectId,
          startWeek: input.startWeek,
          endWeek: input.endWeek,
          daysPerWeek: input.daysPerWeek,
        });
      } catch (err) {
        notifyError("Create", err);
      }
    });
  }

  const onEditSeg = useCallback(
    (segment: AllocationSegment) => {
      const person = people.find((p) => p.id === segment.personId);
      const project = projectById[segment.projectId];
      if (!person || !project) return;
      setPendingCreate({
        mode: "edit",
        segmentId: segment.id,
        personId: segment.personId,
        personName: person.firstName,
        startWeek: segment.startWeek,
        endWeek: segment.endWeek,
        initialDays: segment.daysPerWeek,
        lockedProject: {
          id: project.id,
          name: project.name,
          code: project.code,
          category: project.category,
        },
      });
    },
    [people, projectById],
  );

  function openCreateForPerson(
    personId: string,
    personName: string,
    defaultProjectId?: string,
  ) {
    const startDate = todayMonday;
    const endDate = addWeeks(startDate, 3);
    setPendingCreate({
      personId,
      personName,
      startWeek: isoDate(startDate),
      endWeek: isoDate(endDate),
      defaultProjectId,
    });
  }

  function openCreateForProject(projectId: string) {
    const project = projectById[projectId];
    if (!project) return;
    const startDate = todayMonday;
    const endDate = addWeeks(startDate, 3);
    setPendingCreate({
      startWeek: isoDate(startDate),
      endWeek: isoDate(endDate),
      lockedProject: {
        id: project.id,
        name: project.name,
        code: project.code,
        category: project.category,
      },
    });
  }

  const onDeleteSeg = useCallback(
    (segId: string) => {
      startTransition(async () => {
        applyOptimistic({ type: "delete", id: segId });
        try {
          await deleteSegment(segId);
        } catch (err) {
          notifyError("Delete", err);
        }
      });
    },
    [applyOptimistic],
  );

  const onSplitSeg = useCallback(
    (segment: AllocationSegment, clientX: number) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller =
        clientX - scRect.left + scroller.scrollLeft - SIDEBAR_WIDTH;
      const splitIdx = Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
      const splitISO = weekISOs[splitIdx];
      if (splitISO <= segment.startWeek || splitISO > segment.endWeek) return;
      if (splitIdx === 0) return;

      const newEndForOriginal = weekISOs[splitIdx - 1];
      const tempId = `temp-${crypto.randomUUID()}`;

      startTransition(async () => {
        applyOptimistic({
          type: "update",
          id: segment.id,
          patch: { endWeek: newEndForOriginal },
        });
        applyOptimistic({
          type: "create",
          segment: {
            id: tempId,
            personId: segment.personId,
            projectId: segment.projectId,
            startWeek: splitISO,
            endWeek: segment.endWeek,
            daysPerWeek: segment.daysPerWeek,
          },
        });
        try {
          await splitSegment({ id: segment.id, splitAtWeek: splitISO });
        } catch (err) {
          notifyError("Split", err);
        }
      });
    },
    [applyOptimistic, weekISOs],
  );

  const totalGridWidth = WEEKS_TOTAL * WEEK_WIDTH;
  const totalContentWidth = SIDEBAR_WIDTH + totalGridWidth;

  const expandAll =
    viewMode === "people" ? allPeopleExpanded : allProjectsExpanded;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div
        className={`relative h-0.5 overflow-hidden shrink-0 transition-opacity ${
          isPending ? "opacity-100" : "opacity-0"
        }`}
        aria-hidden
      >
        <div className="absolute inset-y-0 w-1/3 bg-brand animate-[indeterminate_1.2s_ease-in-out_infinite]" />
      </div>

      {actionError && (
        <div className="px-6 py-2 bg-red-50 text-red-700 text-sm shrink-0 border-b border-red-100">
          {actionError}
        </div>
      )}

      <div className="flex-1 overflow-hidden min-h-0">
        <div ref={scrollRef} className="h-full overflow-x-auto overflow-y-auto bg-muted">
          <div className="relative" style={{ minWidth: totalContentWidth }}>
            <TimelineHeader
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              onToggleExpandAll={toggleAllExpanded}
              allExpanded={expandAll}
              expandDisabled={
                viewMode === "people"
                  ? people.length === 0
                  : projects.length === 0
              }
              onOpenShortcuts={() => setShortcutsOpen(true)}
              months={months}
              weeks={weeks}
              todayWeekIndex={todayWeekIndex}
              totalGridWidth={totalGridWidth}
            />

            {people.length === 0 ? (
              <div
                className="sticky left-0 bg-background"
                style={{ width: "100%" }}
              >
                <div className="mx-auto max-w-md text-center py-16 px-6">
                  <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-brand-soft text-brand mb-4">
                    <Plus size={28} aria-hidden />
                  </div>
                  <h2 className="text-lg font-semibold mb-1">
                    No people yet
                  </h2>
                  <p className="text-sm text-muted-foreground mb-5">
                    Add your team to start scheduling work.
                  </p>
                  <Link
                    href="/people"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition"
                  >
                    <Plus size={16} aria-hidden />
                    Add your first person
                  </Link>
                </div>
              </div>
            ) : viewMode === "people" ? (
              <PeopleView
                people={people}
                projectById={projectById}
                optimisticSegments={optimisticSegments}
                weekISOs={weekISOs}
                todayWeekIndex={todayWeekIndex}
                rangeStart={rangeStart}
                collapsedPeople={collapsedPeople}
                dragOverProjectId={dragOverProjectId}
                hoveredRowKey={hoveredRowKey}
                drag={drag}
                getProjectOrder={getProjectOrder}
                onTogglePerson={(personId) =>
                  setCollapsedPeople((prev) => {
                    const next = new Set(prev);
                    if (next.has(personId)) next.delete(personId);
                    else next.add(personId);
                    return next;
                  })
                }
                onSetDragOverProjectId={setDragOverProjectId}
                onReorderProjects={reorderProjects}
                onSetHoveredRowKey={setHoveredRowKey}
                onOpenCreateForPerson={openCreateForPerson}
                onStartCreateDrag={startCreateDrag}
                onStartMove={startMoveDrag}
                onStartResize={startResizeDrag}
                onDelete={onDeleteSeg}
                onSplit={onSplitSeg}
                onEdit={onEditSeg}
              />
            ) : (
              <ProjectsView
                people={people}
                projects={projects}
                optimisticSegments={optimisticSegments}
                weekISOs={weekISOs}
                todayWeekIndex={todayWeekIndex}
                rangeStart={rangeStart}
                collapsedCategories={collapsedCategories}
                collapsedProjects={collapsedProjects}
                hoveredRowKey={hoveredRowKey}
                drag={drag}
                onToggleCategory={(category) =>
                  setCollapsedCategories((prev) => {
                    const next = new Set(prev);
                    if (next.has(category)) next.delete(category);
                    else next.add(category);
                    return next;
                  })
                }
                onToggleProject={(projectId) =>
                  setCollapsedProjects((prev) => {
                    const next = new Set(prev);
                    if (next.has(projectId)) next.delete(projectId);
                    else next.add(projectId);
                    return next;
                  })
                }
                onSetHoveredRowKey={setHoveredRowKey}
                onOpenCreateForPerson={openCreateForPerson}
                onOpenCreateForProject={openCreateForProject}
                onStartCreateDrag={startCreateDrag}
                onStartMove={startMoveDrag}
                onStartResize={startResizeDrag}
                onDelete={onDeleteSeg}
                onSplit={onSplitSeg}
                onEdit={onEditSeg}
              />
            )}
            <TodayMarker todayWeekIndex={todayWeekIndex} />
          </div>
        </div>
      </div>

      {pendingCreate && (
        <CreateSegmentModal
          draft={pendingCreate}
          projects={projects}
          people={people}
          onCancel={() => setPendingCreate(null)}
          onConfirm={onConfirmCreate}
        />
      )}

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => { markShortcutsSeen(); setShortcutsOpen(false); }}
      />
    </div>
  );
}
