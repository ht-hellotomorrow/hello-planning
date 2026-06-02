"use client";

import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  GripVertical,
  Plus,
  User,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  addWeeks,
  dayMonth,
  firstMondayOfMonthOffset,
  groupByMonth,
  isoDate,
  parseISO,
  toMonday,
  weekRange,
  weeksBetween,
} from "@/lib/weeks";
import { projectColor, isPersonal } from "@/lib/colors";
import { assignLanes } from "@/lib/lanes";
import {
  sortProjectIds,
  totalPlannedDays,
  weeklyTotalsForSegments,
} from "@/lib/timeline-rows";
import {
  createSegment,
  deleteSegment,
  splitSegment,
  updateSegment,
} from "@/app/actions/allocations";
import { savePersonProjectOrder } from "@/app/actions/person-project-order";
import { HeaderMenu } from "./HeaderMenu";
import { SyncButton } from "./SyncButton";
import {
  CreateSegmentModal,
  type CreateSegmentConfirmInput,
  type CreateSegmentDraft,
} from "./CreateSegmentModal";
import { ProjectDrawer, DRAWER_DRAG_TYPE } from "./ProjectDrawer";

const WEEK_WIDTH = 80;
const SIDEBAR_WIDTH = 280;
const HEADER_HEIGHT = 64;
const PERSON_ROW_HEIGHT = 44;
const PROJECT_ROW_BASE = 36;
const LANE_HEIGHT = 28;
const LANE_GAP = 4;
const WEEKS_TOTAL = 60;
const WEEKS_BEFORE_TODAY = 12;
const RESIZE_HANDLE = 8;
const PROJECT_ROW_DRAG = "application/x-hello-planning-project-row";

type Category = "ht_internal" | "ht_client" | "personal";
type Visibility = "active" | "archived" | "hidden";

type Person = {
  id: string;
  firstName: string;
  lastName: string;
  propicUrl: string | null;
  capacityDaysPerWeek: number;
};

type Project = {
  id: string;
  code: string | null;
  name: string;
  category: Category;
  visibility: Visibility;
};

type AllocationSegment = {
  id: string;
  personId: string;
  projectId: string;
  startWeek: string;
  endWeek: string;
  daysPerWeek: number;
};

type ProjectOrderEntry = {
  personId: string;
  projectId: string;
  sortOrder: number;
};

export type TimelineProps = {
  people: Person[];
  projects: Project[];
  segments: AllocationSegment[];
  projectOrder: ProjectOrderEntry[];
  todayISO: string;
};

type DragState =
  | null
  | {
      kind: "create";
      personId: string;
      projectId?: string;
      anchorIdx: number;
      currentIdx: number;
    }
  | {
      kind: "move";
      segmentId: string;
      personId: string;
      originalStartIdx: number;
      originalEndIdx: number;
      mouseAnchorIdx: number;
      currentMouseIdx: number;
    }
  | {
      kind: "resize";
      segmentId: string;
      personId: string;
      edge: "left" | "right";
      originalStartIdx: number;
      originalEndIdx: number;
      currentIdx: number;
    };

type OptimisticAction =
  | { type: "create"; segment: AllocationSegment }
  | { type: "update"; id: string; patch: Partial<AllocationSegment> }
  | { type: "delete"; id: string };

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

function formatTotal(n: number): string {
  if (n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function projectRowHeight(laneCount: number): number {
  if (laneCount <= 1) return PROJECT_ROW_BASE;
  return LANE_GAP + laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP;
}

export function Timeline({
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

  const [orderOverrides, setOrderOverrides] = useState<
    Record<string, string[]>
  >({});
  const [collapsedPeople, setCollapsedPeople] = useState<Set<string>>(
    () => new Set(),
  );
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(
    null,
  );

  const [optimisticSegments, applyOptimistic] = useOptimistic(
    segments,
    optimisticReducer,
  );
  const [, startTransition] = useTransition();

  const [drag, setDrag] = useState<DragState>(null);
  const [pendingCreate, setPendingCreate] =
    useState<CreateSegmentDraft | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragRef = useRef<DragState>(null);
  dragRef.current = drag;

  const initialScrollLeft = useMemo(() => {
    const target = firstMondayOfMonthOffset(today, -1);
    const idx = weeksBetween(rangeStart, target);
    return Math.max(0, idx) * WEEK_WIDTH;
  }, [today, rangeStart]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  useEffect(() => {
    if (!scrollRef.current || initialized) return;
    scrollRef.current.scrollLeft = initialScrollLeft;
    setInitialized(true);
  }, [initialScrollLeft, initialized]);

  function shiftWeeks(n: number) {
    scrollRef.current?.scrollBy({ left: n * WEEK_WIDTH, behavior: "smooth" });
  }
  function scrollToToday() {
    scrollRef.current?.scrollTo({
      left: todayWeekIndex * WEEK_WIDTH,
      behavior: "smooth",
    });
  }

  const allPeopleExpanded =
    people.length > 0 && collapsedPeople.size === 0;

  function toggleAllPeople() {
    if (allPeopleExpanded) {
      setCollapsedPeople(new Set(people.map((p) => p.id)));
    } else {
      setCollapsedPeople(new Set());
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
          console.error("reorder failed", err);
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
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
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
                console.error("move failed", err);
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
              console.error("resize failed", err);
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
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
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
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
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
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
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

    // Edit branch: update existing segment in place.
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
          console.error("edit failed", err);
        }
      });
      return;
    }

    // Create branch.
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempSegment: AllocationSegment = {
      id: tempId,
      personId: draft.personId,
      projectId: input.projectId,
      startWeek: input.startWeek,
      endWeek: input.endWeek,
      daysPerWeek: input.daysPerWeek,
    };
    startTransition(async () => {
      applyOptimistic({ type: "create", segment: tempSegment });
      try {
        await createSegment({
          personId: draft.personId,
          projectId: input.projectId,
          startWeek: input.startWeek,
          endWeek: input.endWeek,
          daysPerWeek: input.daysPerWeek,
        });
      } catch (err) {
        console.error("create failed", err);
      }
    });
  }

  // Open the modal in edit mode (locked project, prefilled values).
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

  const onUpdateDays = useCallback(
    (segId: string, newDays: number) => {
      startTransition(async () => {
        applyOptimistic({
          type: "update",
          id: segId,
          patch: { daysPerWeek: newDays },
        });
        try {
          await updateSegment(segId, { daysPerWeek: newDays });
        } catch (err) {
          console.error("update days failed", err);
        }
      });
    },
    [applyOptimistic],
  );

  const onDeleteSeg = useCallback(
    (segId: string) => {
      startTransition(async () => {
        applyOptimistic({ type: "delete", id: segId });
        try {
          await deleteSegment(segId);
        } catch (err) {
          console.error("delete failed", err);
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
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
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
          console.error("split failed", err);
        }
      });
    },
    [applyOptimistic, weekISOs],
  );

  const onProjectDrop = useCallback(
    (
      personId: string,
      projectId: string,
      clientX: number,
    ) => {
      const scroller = scrollRef.current;
      if (!scroller) return;
      const scRect = scroller.getBoundingClientRect();
      const xInScroller = clientX - scRect.left + scroller.scrollLeft;
      const idx = Math.max(
        0,
        Math.min(WEEKS_TOTAL - 1, Math.floor(xInScroller / WEEK_WIDTH)),
      );
      const startISO = weekISOs[idx];
      const endIdx = Math.min(WEEKS_TOTAL - 1, idx + 3);
      const endISO = weekISOs[endIdx];
      const person = people.find((p) => p.id === personId);
      setPendingCreate({
        personId,
        personName: person?.firstName ?? "",
        startWeek: startISO,
        endWeek: endISO,
        defaultProjectId: projectId,
      });
    },
    [people, weekISOs],
  );

  const totalGridWidth = WEEKS_TOTAL * WEEK_WIDTH;
  const totalContentWidth = SIDEBAR_WIDTH + totalGridWidth;

  const weekGridStyle = {
    gridTemplateColumns: `repeat(${WEEKS_TOTAL}, ${WEEK_WIDTH}px)`,
  } as const;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background z-30 shrink-0">
        <div className="flex items-center gap-3">
          <img
            src="/ht-logo.png"
            alt="Hello Tomorrow"
            width={36}
            height={36}
            className="w-9 h-9 rounded-md object-cover"
          />
          <div>
            <h1 className="text-base font-bold tracking-tight leading-tight">
              Hello Planning
            </h1>
            <p className="text-xs text-muted-foreground leading-tight">
              Hello Tomorrow
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => shiftWeeks(-4)}
            className="p-2 rounded bg-muted hover:bg-muted-hover text-muted-foreground"
            aria-label="Back 4 weeks"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <button
            type="button"
            onClick={scrollToToday}
            className="px-3 py-1.5 rounded hover:bg-muted text-sm font-semibold"
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => shiftWeeks(4)}
            className="p-2 rounded bg-muted hover:bg-muted-hover text-muted-foreground"
            aria-label="Forward 4 weeks"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <SyncButton />
          <HeaderMenu
            drawerOpen={drawerOpen}
            onToggleDrawer={() => setDrawerOpen((v) => !v)}
          />
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden min-h-0">
        <div ref={scrollRef} className="flex-1 overflow-auto bg-muted">
          <div style={{ minWidth: totalContentWidth }}>
            {/* Sticky header */}
            <div
              className="sticky top-0 z-20 flex bg-background border-b border-grid-line"
              style={{ height: HEADER_HEIGHT }}
            >
              <div
                className="shrink-0 pl-2 pr-3 flex items-end gap-1 pb-2 border-r border-border sticky left-0 z-30 bg-background"
                style={{ width: SIDEBAR_WIDTH }}
              >
                <button
                  type="button"
                  onClick={toggleAllPeople}
                  disabled={people.length === 0}
                  title={
                    allPeopleExpanded
                      ? "Collapse all people"
                      : "Expand all people"
                  }
                  aria-label={
                    allPeopleExpanded
                      ? "Collapse all people"
                      : "Expand all people"
                  }
                  className="mb-0.5 p-1 rounded hover:bg-muted text-muted-foreground disabled:opacity-40 disabled:pointer-events-none"
                >
                  {allPeopleExpanded ? (
                    <ChevronsDownUp size={16} aria-hidden />
                  ) : (
                    <ChevronsUpDown size={16} aria-hidden />
                  )}
                </button>
                <span className="flex-1 text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                  People
                </span>
              </div>
              <div style={{ width: totalGridWidth }}>
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
                            ? "text-brand font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {dayMonth(w)}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Body rows */}
            {people.length === 0 ? (
              <div
                className="flex bg-background"
                style={{ width: totalContentWidth }}
              >
                <div
                  className="p-4 text-sm text-muted-foreground border-r border-border sticky left-0 bg-background"
                  style={{ width: SIDEBAR_WIDTH }}
                >
                  No people yet.{" "}
                  <Link href="/people" className="text-brand hover:underline">
                    Add one
                  </Link>
                  .
                </div>
              </div>
            ) : (
              people.map((p, personIndex) => {
                const personSegs = optimisticSegments.filter(
                  (s) => s.personId === p.id,
                );
                const projectIds = getProjectOrder(
                  p.id,
                  personSegs.map((s) => s.projectId),
                );
                const expanded = !collapsedPeople.has(p.id);
                // Personal projects do not count toward capacity/overbooking.
                const countableSegs = personSegs.filter(
                  (s) =>
                    projectById[s.projectId]?.category !== "personal",
                );
                const weeklyTotals = weeklyTotalsForSegments(
                  countableSegs,
                  weekISOs,
                );

                return (
                  <div
                    key={p.id}
                    className={`bg-background border-b-[3px] border-border shadow-[inset_0_-1px_0_0_var(--grid-line)] ${
                      personIndex > 0 ? "border-t-2 border-t-border mt-2" : ""
                    }`}
                  >
                    {/* Person summary row */}
                    <div
                      className="flex border-b border-grid-line bg-muted/50"
                      style={{ height: PERSON_ROW_HEIGHT }}
                    >
                      <PersonSidebarHeader
                        person={p}
                        expanded={expanded}
                        onToggle={() =>
                          setCollapsedPeople((prev) => {
                            const next = new Set(prev);
                            if (next.has(p.id)) next.delete(p.id);
                            else next.add(p.id);
                            return next;
                          })
                        }
                        onNewSchedule={() =>
                          openCreateForPerson(p.id, p.firstName)
                        }
                      />
                      <PersonWeeklyTotalsRow
                        weeklyTotals={weeklyTotals}
                        capacity={p.capacityDaysPerWeek}
                        weekISOs={weekISOs}
                        todayWeekIndex={todayWeekIndex}
                      />
                    </div>

                    {expanded &&
                      projectIds.map((projectId) => {
                        const project = projectById[projectId];
                        if (!project) return null;
                        const projSegs = personSegs.filter(
                          (s) => s.projectId === projectId,
                        );
                        const { laned, count: laneCount } =
                          assignLanes(projSegs);
                        const rowHeight = projectRowHeight(laneCount);
                        const totalDays = totalPlannedDays(
                          projSegs,
                          rangeStart,
                          WEEKS_TOTAL,
                        );

                        return (
                          <div
                            key={`${p.id}-${projectId}`}
                            className="flex border-b border-grid-line"
                            style={{ height: rowHeight }}
                          >
                            <ProjectSidebarRow
                              project={project}
                              totalDays={totalDays}
                              personId={p.id}
                              projectId={projectId}
                              isDragOver={dragOverProjectId === projectId}
                              onDragOver={(e) => {
                                if (
                                  !e.dataTransfer.types.includes(
                                    PROJECT_ROW_DRAG,
                                  )
                                )
                                  return;
                                e.preventDefault();
                                e.dataTransfer.dropEffect = "move";
                                setDragOverProjectId(projectId);
                              }}
                              onDragLeave={() => {
                                if (dragOverProjectId === projectId) {
                                  setDragOverProjectId(null);
                                }
                              }}
                              onDrop={(fromProjectId) => {
                                setDragOverProjectId(null);
                                reorderProjects(
                                  p.id,
                                  fromProjectId,
                                  projectId,
                                );
                              }}
                              onAssign={() =>
                                openCreateForPerson(
                                  p.id,
                                  p.firstName,
                                  projectId,
                                )
                              }
                            />
                            <ProjectTimelineRow
                              personId={p.id}
                              projectId={projectId}
                              rowHeight={rowHeight}
                              segments={laned}
                              project={project}
                              weekISOs={weekISOs}
                              todayWeekIndex={todayWeekIndex}
                              rangeStart={rangeStart}
                              drag={drag}
                              onStartCreate={(clientX) =>
                                startCreateDrag(p.id, projectId, clientX)
                              }
                              onStartMove={startMoveDrag}
                              onStartResize={startResizeDrag}
                              onUpdateDays={onUpdateDays}
                              onDelete={onDeleteSeg}
                              onSplit={onSplitSeg}
                              onEdit={onEditSeg}
                              onProjectDrop={(clientX) =>
                                onProjectDrop(p.id, projectId, clientX)
                              }
                            />
                          </div>
                        );
                      })}

                    {expanded && (
                      <div
                        className="flex bg-muted/20"
                        style={{ height: 36 }}
                      >
                        <div
                          className="shrink-0 pl-10 pr-3 flex items-center sticky left-0 z-10 bg-muted/20 border-r border-border"
                          style={{ width: SIDEBAR_WIDTH }}
                        >
                          <button
                            type="button"
                            onClick={() =>
                              openCreateForPerson(p.id, p.firstName)
                            }
                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
                          >
                            <Plus size={12} aria-hidden />
                            Assign project
                          </button>
                        </div>
                        <div
                          className="bg-muted"
                          style={{ width: totalGridWidth }}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <ProjectDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          projects={projects}
          segments={optimisticSegments}
        />
      </div>

      {pendingCreate && (
        <CreateSegmentModal
          draft={pendingCreate}
          projects={projects}
          onCancel={() => setPendingCreate(null)}
          onConfirm={onConfirmCreate}
        />
      )}
    </div>
  );
}

// ─── Sidebar: person header ───────────────────────────────────────────────

function PersonSidebarHeader({
  person,
  expanded,
  onToggle,
  onNewSchedule,
}: {
  person: Person;
  expanded: boolean;
  onToggle: () => void;
  onNewSchedule: () => void;
}) {
  return (
    <div
      className="group shrink-0 flex items-center gap-1 pl-2 pr-2 border-r border-border sticky left-0 z-10 bg-muted/50"
      style={{ width: SIDEBAR_WIDTH }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="p-1 rounded hover:bg-muted text-muted-foreground"
        aria-label={expanded ? "Collapse projects" : "Expand projects"}
      >
        {expanded ? (
          <ChevronDown size={14} aria-hidden />
        ) : (
          <ChevronRight size={14} aria-hidden />
        )}
      </button>
      <Link
        href={`/people#${person.id}`}
        className="flex items-center gap-2 flex-1 min-w-0 py-1"
      >
        <div className="w-8 h-8 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-[10px] font-semibold text-muted-foreground">
          {person.propicUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={person.propicUrl}
              alt=""
              className="w-full h-full object-cover"
            />
          ) : (
            `${person.firstName[0] ?? ""}${person.lastName[0] ?? ""}`.toUpperCase()
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium truncate">
            {person.firstName} {person.lastName}
          </div>
          <div className="text-[11px] text-muted-foreground tabular-nums leading-tight">
            {person.capacityDaysPerWeek} d/wk
          </div>
        </div>
      </Link>
      <button
        type="button"
        onClick={onNewSchedule}
        title="New schedule"
        aria-label="New schedule"
        className="shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-muted-foreground hover:bg-primary hover:text-primary-foreground transition opacity-0 group-hover:opacity-100 focus:opacity-100"
      >
        <Plus size={14} strokeWidth={2.5} aria-hidden />
      </button>
    </div>
  );
}

// ─── Sidebar: project row (draggable) ─────────────────────────────────────

function ProjectSidebarRow({
  project,
  totalDays,
  personId,
  projectId,
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
  isDragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (fromProjectId: string) => void;
  onAssign: () => void;
}) {
  const color = projectColor(project);
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
      className={`shrink-0 flex items-center gap-1 pl-1 pr-3 border-r border-border sticky left-0 z-10 bg-background cursor-grab active:cursor-grabbing ${
        isDragOver ? "bg-brand-soft" : ""
      }`}
      style={{ width: SIDEBAR_WIDTH }}
    >
      <GripVertical
        size={14}
        className="shrink-0 text-muted-foreground/50"
        aria-hidden
      />
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: color }}
      />
      <button
        type="button"
        onClick={onAssign}
        className="text-sm truncate flex-1 text-left hover:underline min-w-0"
        title={label}
      >
        {isPersonal(project) && (
          <User size={12} className="inline mr-1 -mt-0.5" aria-hidden />
        )}
        {label}
      </button>
      <span className="text-xs text-muted-foreground tabular-nums shrink-0">
        {formatTotal(totalDays)}
      </span>
    </div>
  );
}

// ─── Grid: person weekly totals ───────────────────────────────────────────

function PersonWeeklyTotalsRow({
  weeklyTotals,
  capacity,
  weekISOs,
  todayWeekIndex,
}: {
  weeklyTotals: number[];
  capacity: number;
  weekISOs: string[];
  todayWeekIndex: number;
}) {
  return (
    <div
      className="grid bg-muted/50"
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
              over
                ? "bg-red-100 text-red-700 font-semibold"
                : i === todayWeekIndex
                  ? "bg-brand/5 text-muted-foreground"
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

// ─── Grid: project timeline row ───────────────────────────────────────────

type ProjectRowProps = {
  personId: string;
  projectId: string;
  rowHeight: number;
  segments: Array<AllocationSegment & { lane: number }>;
  project: Project;
  weekISOs: string[];
  todayWeekIndex: number;
  rangeStart: Date;
  drag: DragState;
  onStartCreate: (clientX: number) => void;
  onStartMove: (segment: AllocationSegment, clientX: number) => void;
  onStartResize: (
    segment: AllocationSegment,
    edge: "left" | "right",
    clientX: number,
  ) => void;
  onUpdateDays: (segId: string, newDays: number) => void;
  onDelete: (segId: string) => void;
  onSplit: (segment: AllocationSegment, clientX: number) => void;
  onEdit: (segment: AllocationSegment) => void;
  onProjectDrop: (clientX: number) => void;
};

function ProjectTimelineRow({
  personId,
  projectId,
  rowHeight,
  segments,
  project,
  weekISOs,
  todayWeekIndex,
  rangeStart,
  drag,
  onStartCreate,
  onStartMove,
  onStartResize,
  onUpdateDays,
  onDelete,
  onSplit,
  onEdit,
  onProjectDrop,
}: ProjectRowProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [dropHover, setDropHover] = useState(false);

  function onRowMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    onStartCreate(e.clientX);
  }

  function onDragOver(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(PROJECT_ROW_DRAG)) return;
    if (!e.dataTransfer.types.includes(DRAWER_DRAG_TYPE)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    if (!dropHover) setDropHover(true);
  }
  function onDragLeave() {
    if (dropHover) setDropHover(false);
  }
  function onDrop(e: React.DragEvent) {
    if (e.dataTransfer.types.includes(PROJECT_ROW_DRAG)) return;
    const pid = e.dataTransfer.getData(DRAWER_DRAG_TYPE);
    if (!pid) return;
    e.preventDefault();
    setDropHover(false);
    onProjectDrop(e.clientX);
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
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative transition-colors cursor-crosshair select-none ${
        dropHover ? "bg-brand-soft" : "hover:bg-muted-hover"
      }`}
      style={{ width: weekISOs.length * WEEK_WIDTH, height: rowHeight }}
    >
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{
          gridTemplateColumns: `repeat(${weekISOs.length}, ${WEEK_WIDTH}px)`,
        }}
      >
        {weekISOs.map((iso, i) => (
          <div
            key={iso}
            className={`border-r border-grid-line last:border-r-0 ${
              i === todayWeekIndex ? "bg-brand/5" : ""
            }`}
          />
        ))}
      </div>

      <div
        className="absolute top-0 bottom-0 w-px bg-brand/40 pointer-events-none"
        style={{ left: todayWeekIndex * WEEK_WIDTH }}
      />

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

        return (
          <AllocationBar
            key={s.id}
            segment={{ ...s, startWeek: startISO, endWeek: endISO }}
            laneIndex={s.lane}
            project={project}
            rangeStart={rangeStart}
            dragging={dragging}
            onStartMove={(clientX) =>
              onStartMove(
                { ...s, startWeek: startISO, endWeek: endISO },
                clientX,
              )
            }
            onStartResize={(edge, clientX) =>
              onStartResize(
                { ...s, startWeek: startISO, endWeek: endISO },
                edge,
                clientX,
              )
            }
            onUpdateDays={(newDays) => onUpdateDays(s.id, newDays)}
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

// ─── Allocation bar ───────────────────────────────────────────────────────

type BarProps = {
  segment: AllocationSegment;
  laneIndex: number;
  project: Project;
  rangeStart: Date;
  dragging: boolean;
  onStartMove: (clientX: number) => void;
  onStartResize: (edge: "left" | "right", clientX: number) => void;
  onUpdateDays: (newDays: number) => void;
  onDelete: () => void;
  onSplit: (clientX: number) => void;
  onEdit: () => void;
};

function AllocationBar({
  segment,
  laneIndex,
  project,
  rangeStart,
  dragging,
  onStartMove,
  onStartResize,
  onUpdateDays,
  onDelete,
  onSplit,
  onEdit,
}: BarProps) {
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

  const [editing, setEditing] = useState(false);
  const [draftDays, setDraftDays] = useState(String(segment.daysPerWeek));
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) editInputRef.current?.select();
  }, [editing]);

  function commitDays() {
    const v = Number.parseFloat(draftDays);
    if (Number.isFinite(v) && v > 0 && v <= 7 && v !== segment.daysPerWeek) {
      onUpdateDays(v);
    }
    setEditing(false);
  }

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

  const barLabel = `${project.code ?? project.name} · ${segment.daysPerWeek} d/w`;

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
        dragging ? "ring-2 ring-brand opacity-90 z-10 shadow-lg" : ""
      }`}
      style={{
        top,
        height: LANE_HEIGHT,
        left,
        width,
        backgroundColor: color,
        opacity: isArchived ? 0.6 : dragging ? 0.9 : 1,
      }}
      title={`${barLabel}\nDouble-click to edit · Shift+click to split · Right-click to delete`}
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
      <span className="truncate flex-1 pointer-events-none">{barLabel}</span>

      {editing ? (
        <input
          ref={editInputRef}
          type="number"
          step="0.5"
          min="0.5"
          max="7"
          value={draftDays}
          onChange={(e) => setDraftDays(e.target.value)}
          onBlur={commitDays}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitDays();
            if (e.key === "Escape") {
              setDraftDays(String(segment.daysPerWeek));
              setEditing(false);
            }
          }}
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="w-10 px-1 text-xs rounded bg-white/90 text-zinc-900 tabular-nums focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (!isArchived) {
              setDraftDays(String(segment.daysPerWeek));
              setEditing(true);
            }
          }}
          className={`tabular-nums px-1 rounded hover:bg-black/10 ${
            isArchived ? "cursor-default" : "cursor-text"
          }`}
        >
          {segment.daysPerWeek}
        </button>
      )}
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
