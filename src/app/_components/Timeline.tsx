"use client";

import Link from "next/link";
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
import { projectColor } from "@/lib/colors";
import { assignLanes } from "@/lib/lanes";
import {
  createSegment,
  deleteSegment,
  updateSegment,
} from "@/app/actions/allocations";
import { SyncButton } from "./SyncButton";
import { LogoutButton } from "./LogoutButton";
import {
  CreateSegmentModal,
  type CreateSegmentDraft,
} from "./CreateSegmentModal";

const WEEK_WIDTH = 80;
const SIDEBAR_WIDTH = 240;
const ROW_BASE = 64;
const LANE_HEIGHT = 28;
const LANE_GAP = 4;
const HEADER_HEIGHT = 64;
const WEEKS_TOTAL = 60;
const WEEKS_BEFORE_TODAY = 12;
const RESIZE_HANDLE = 8;

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

export type TimelineProps = {
  people: Person[];
  projects: Project[];
  segments: AllocationSegment[];
  todayISO: string;
};

type DragState =
  | null
  | {
      kind: "create";
      personId: string;
      anchorIdx: number;
      currentIdx: number;
      rowTop: number;
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

export function Timeline({
  people,
  projects,
  segments,
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
  const todayWeekIndex = WEEKS_BEFORE_TODAY;

  // Optimistic state
  const [optimisticSegments, applyOptimistic] = useOptimistic(
    segments,
    optimisticReducer,
  );
  const [, startTransition] = useTransition();

  // Drag + modal state
  const [drag, setDrag] = useState<DragState>(null);
  const [pendingCreate, setPendingCreate] =
    useState<CreateSegmentDraft | null>(null);
  const dragRef = useRef<DragState>(null);
  dragRef.current = drag;

  // Initial scroll
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

  // ── DRAG MOUSE HANDLERS ──────────────────────────────────────────────
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
        setPendingCreate({
          personId: d.personId,
          personName: people.find((p) => p.id === d.personId)?.firstName ?? "",
          startWeek: weekISOs[start],
          endWeek: weekISOs[end],
          durationWeeks: end - start + 1,
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

  // ── BAR/ROW INTERACTION CALLBACKS ─────────────────────────────────────
  const startCreateDrag = useCallback(
    (personId: string, clientX: number, rowEl: HTMLElement) => {
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
        anchorIdx: idx,
        currentIdx: idx,
        rowTop: rowEl.getBoundingClientRect().top,
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

  // ── MODAL CONFIRM ─────────────────────────────────────────────────────
  async function onConfirmCreate(projectId: string, daysPerWeek: number) {
    if (!pendingCreate) return;
    const tempId = `temp-${crypto.randomUUID()}`;
    const tempSegment: AllocationSegment = {
      id: tempId,
      personId: pendingCreate.personId,
      projectId,
      startWeek: pendingCreate.startWeek,
      endWeek: pendingCreate.endWeek,
      daysPerWeek,
    };
    setPendingCreate(null);
    startTransition(async () => {
      applyOptimistic({ type: "create", segment: tempSegment });
      try {
        await createSegment({
          personId: tempSegment.personId,
          projectId: tempSegment.projectId,
          startWeek: tempSegment.startWeek,
          endWeek: tempSegment.endWeek,
          daysPerWeek: tempSegment.daysPerWeek,
        });
      } catch (err) {
        console.error("create failed", err);
      }
    });
  }

  // ── INLINE DAYS EDIT ──────────────────────────────────────────────────
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

  // ── DERIVED: lanes per person ────────────────────────────────────────
  const personLanes = useMemo(() => {
    const map = new Map<
      string,
      { laned: Array<AllocationSegment & { lane: number }>; count: number }
    >();
    for (const p of people) {
      const segs = optimisticSegments.filter((s) => s.personId === p.id);
      map.set(p.id, assignLanes(segs));
    }
    return map;
  }, [optimisticSegments, people]);

  const totalGridWidth = WEEKS_TOTAL * WEEK_WIDTH;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Top header */}
      <header className="px-6 py-3 border-b border-border flex items-center justify-between gap-4 bg-background z-30 shrink-0">
        <div className="flex items-center gap-3">
          <div className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-brand text-accent text-base font-extrabold">
            H!
          </div>
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
            className="p-2 rounded hover:bg-muted text-muted-foreground"
            aria-label="Indietro 4 settimane"
          >
            ←
          </button>
          <button
            type="button"
            onClick={scrollToToday}
            className="px-3 py-1.5 rounded hover:bg-muted text-sm font-medium"
          >
            Oggi
          </button>
          <button
            type="button"
            onClick={() => shiftWeeks(4)}
            className="p-2 rounded hover:bg-muted text-muted-foreground"
            aria-label="Avanti 4 settimane"
          >
            →
          </button>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/persone"
            className="px-3 py-1.5 rounded text-sm font-medium hover:bg-muted text-muted-foreground"
          >
            Persone
          </Link>
          <SyncButton />
          <LogoutButton />
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Sidebar persone */}
        <aside
          className="shrink-0 border-r border-border bg-background overflow-y-auto"
          style={{ width: SIDEBAR_WIDTH }}
        >
          <div
            className="px-4 flex items-end pb-2 border-b border-border text-xs text-muted-foreground font-semibold uppercase tracking-wider sticky top-0 bg-background z-10"
            style={{ height: HEADER_HEIGHT }}
          >
            Persone
          </div>
          {people.length === 0 ? (
            <div className="p-4 text-sm text-muted-foreground">
              Nessuna persona.{" "}
              <Link href="/persone" className="text-brand hover:underline">
                Aggiungine una
              </Link>
              .
            </div>
          ) : (
            people.map((p) => {
              const lanes = personLanes.get(p.id);
              const rowHeight = Math.max(
                ROW_BASE,
                (lanes?.count ?? 1) * (LANE_HEIGHT + LANE_GAP) + LANE_GAP * 2,
              );
              return (
                <Link
                  key={p.id}
                  href={`/persone#${p.id}`}
                  className="flex items-center gap-3 px-4 border-b border-border hover:bg-muted/40 transition"
                  style={{ height: rowHeight }}
                >
                  <div className="w-9 h-9 shrink-0 rounded-full bg-muted overflow-hidden flex items-center justify-center text-xs font-semibold text-muted-foreground">
                    {p.propicUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.propicUrl}
                        alt=""
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      `${p.firstName[0] ?? ""}${p.lastName[0] ?? ""}`.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {p.firstName} {p.lastName}
                    </div>
                    <div className="text-xs text-muted-foreground tabular-nums">
                      {p.capacityDaysPerWeek} gg/sett
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </aside>

        {/* Timeline scrollabile */}
        <div ref={scrollRef} className="flex-1 overflow-auto">
          <div style={{ width: totalGridWidth }}>
            {/* Sticky header */}
            <div
              className="sticky top-0 z-20 bg-background border-b border-border"
              style={{ height: HEADER_HEIGHT }}
            >
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${WEEKS_TOTAL}, ${WEEK_WIDTH}px)`,
                  height: 32,
                }}
              >
                {months.map((m, i) => (
                  <div
                    key={`${m.label}-${i}`}
                    className="px-2 py-2 text-xs font-semibold text-muted-foreground border-r border-border last:border-r-0 truncate"
                    style={{ gridColumn: `span ${m.count}` }}
                  >
                    {m.label}
                  </div>
                ))}
              </div>
              <div
                className="grid border-t border-border"
                style={{
                  gridTemplateColumns: `repeat(${WEEKS_TOTAL}, ${WEEK_WIDTH}px)`,
                  height: 32,
                }}
              >
                {weeks.map((w, i) => {
                  const isToday = i === todayWeekIndex;
                  return (
                    <div
                      key={isoDate(w)}
                      className={`px-2 py-2 text-xs tabular-nums border-r border-border last:border-r-0 ${
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

            {/* Rows */}
            {people.map((p) => {
              const lanes = personLanes.get(p.id);
              const rowHeight = Math.max(
                ROW_BASE,
                (lanes?.count ?? 1) * (LANE_HEIGHT + LANE_GAP) + LANE_GAP * 2,
              );
              return (
                <PersonTimelineRow
                  key={p.id}
                  personId={p.id}
                  rowHeight={rowHeight}
                  segments={lanes?.laned ?? []}
                  projectById={projectById}
                  weekISOs={weekISOs}
                  todayWeekIndex={todayWeekIndex}
                  rangeStart={rangeStart}
                  drag={drag}
                  onStartCreate={startCreateDrag}
                  onStartMove={startMoveDrag}
                  onStartResize={startResizeDrag}
                  onUpdateDays={onUpdateDays}
                  onDelete={onDeleteSeg}
                />
              );
            })}
          </div>
        </div>
      </div>

      {/* Create modal */}
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

// ─────────────────────────────────────────────────────────────────────────
// Row component
// ─────────────────────────────────────────────────────────────────────────

type RowProps = {
  personId: string;
  rowHeight: number;
  segments: Array<AllocationSegment & { lane: number }>;
  projectById: Record<string, Project>;
  weekISOs: string[];
  todayWeekIndex: number;
  rangeStart: Date;
  drag: DragState;
  onStartCreate: (personId: string, clientX: number, row: HTMLElement) => void;
  onStartMove: (segment: AllocationSegment, clientX: number) => void;
  onStartResize: (
    segment: AllocationSegment,
    edge: "left" | "right",
    clientX: number,
  ) => void;
  onUpdateDays: (segId: string, newDays: number) => void;
  onDelete: (segId: string) => void;
};

function PersonTimelineRow({
  personId,
  rowHeight,
  segments,
  projectById,
  weekISOs,
  todayWeekIndex,
  rangeStart,
  drag,
  onStartCreate,
  onStartMove,
  onStartResize,
  onUpdateDays,
  onDelete,
}: RowProps) {
  const rowRef = useRef<HTMLDivElement>(null);

  function onRowMouseDown(e: React.MouseEvent) {
    if (e.button !== 0) return;
    if (!rowRef.current) return;
    onStartCreate(personId, e.clientX, rowRef.current);
  }

  // Preview during drag
  const createPreview =
    drag?.kind === "create" && drag.personId === personId
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
      className="relative border-b border-border hover:bg-muted/10 transition-colors cursor-crosshair select-none"
      style={{ height: rowHeight }}
    >
      {/* Week background */}
      <div
        className="absolute inset-0 grid pointer-events-none"
        style={{
          gridTemplateColumns: `repeat(${weekISOs.length}, ${WEEK_WIDTH}px)`,
        }}
      >
        {weekISOs.map((iso, i) => (
          <div
            key={iso}
            className={`border-r border-border/50 last:border-r-0 ${
              i === todayWeekIndex ? "bg-brand/5" : ""
            }`}
          />
        ))}
      </div>

      {/* Today line */}
      <div
        className="absolute top-0 bottom-0 w-px bg-brand/40 pointer-events-none"
        style={{ left: todayWeekIndex * WEEK_WIDTH }}
      />

      {/* Allocation bars */}
      {segments.map((s) => {
        const project = projectById[s.projectId];
        if (!project) return null;

        // Apply drag preview offset
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
          />
        );
      })}

      {/* Create preview */}
      {createPreview && (
        <div
          className="absolute top-1 bottom-1 rounded-md bg-brand/30 border-2 border-brand pointer-events-none flex items-center justify-center text-xs font-medium text-brand"
          style={{
            left: createPreview.start * WEEK_WIDTH + 4,
            width: (createPreview.end - createPreview.start + 1) * WEEK_WIDTH - 8,
          }}
        >
          {createPreview.end - createPreview.start + 1} sett.
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Allocation bar with drag handles + inline edit
// ─────────────────────────────────────────────────────────────────────────

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
  const isPersonal = project.category === "personal";
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
    if (isArchived) return; // not movable
    if (e.button !== 0) return;
    onStartMove(e.clientX);
    e.stopPropagation();
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
    if (window.confirm(`Eliminare l'allocazione su ${project.name}?`)) {
      onDelete();
    }
  }

  return (
    <div
      onMouseDown={onBarMouseDown}
      onContextMenu={onContextMenu}
      className={`absolute rounded-md px-2 text-xs font-medium overflow-hidden flex items-center gap-1 group ${
        isArchived
          ? "text-zinc-700 cursor-default"
          : isPersonal
            ? "text-zinc-800 cursor-grab active:cursor-grabbing"
            : "text-white cursor-grab active:cursor-grabbing"
      } ${isPersonal ? "border-2 border-dashed border-zinc-500" : ""} ${
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
      title={`${project.name} · ${segment.daysPerWeek} gg/sett (click destro per eliminare)`}
    >
      {/* Resize handle left */}
      {!isArchived && (
        <div
          onMouseDown={(e) => onResizeEdgeMouseDown(e, "left")}
          className="absolute left-0 top-0 bottom-0 cursor-ew-resize z-10 hover:bg-black/10"
          style={{ width: RESIZE_HANDLE }}
        />
      )}

      {overflowsLeft && <span className="opacity-60">‹</span>}
      {isPersonal && (
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          aria-hidden
        >
          <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
        </svg>
      )}
      <span className="truncate flex-1 pointer-events-none">
        {project.code ?? project.name}
      </span>

      {/* Days (clickable inline edit) */}
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
          onMouseDown={(e) => {
            e.stopPropagation();
          }}
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
      {overflowsRight && <span className="opacity-60">›</span>}

      {/* Resize handle right */}
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
