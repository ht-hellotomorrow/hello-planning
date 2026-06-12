import { parseISO, weeksBetween } from "@/lib/weeks";

function compareLabels(a: string, b: string): number {
  return a.localeCompare(b, "en", { numeric: true, sensitivity: "base" });
}

export type SegmentRange = {
  startWeek: string;
  endWeek: string;
  daysPerWeek: number;
};

export function segmentCoversWeek(
  seg: { startWeek: string; endWeek: string },
  weekISO: string,
): boolean {
  return weekISO >= seg.startWeek && weekISO <= seg.endWeek;
}

export function weeklyTotalsForSegments(
  segments: SegmentRange[],
  weekISOs: string[],
): number[] {
  return weekISOs.map((weekISO) =>
    segments
      .filter((s) => segmentCoversWeek(s, weekISO))
      .reduce((sum, s) => sum + s.daysPerWeek, 0),
  );
}

/** Giorni totali pianificati (settimane × giorni/settimana) per un insieme di segmenti. */
export function totalPlannedDays(
  segments: SegmentRange[],
  rangeStart: Date,
  weekCount: number,
): number {
  const rangeEndIdx = weekCount - 1;
  let total = 0;
  for (const s of segments) {
    const startIdx = weeksBetween(rangeStart, parseISO(s.startWeek));
    const endIdx = weeksBetween(rangeStart, parseISO(s.endWeek));
    const clampedStart = Math.max(0, startIdx);
    const clampedEnd = Math.min(rangeEndIdx, endIdx);
    if (clampedEnd < clampedStart) continue;
    const weeks = clampedEnd - clampedStart + 1;
    total += weeks * s.daysPerWeek;
  }
  return Math.round(total * 10) / 10;
}

export function sortProjectIds(
  projectIds: string[],
  order: string[] | undefined,
  nameById: Record<string, string>,
): string[] {
  const unique = [...new Set(projectIds)];
  if (!order?.length) {
    return unique.sort((a, b) =>
      compareLabels(nameById[a] ?? a, nameById[b] ?? b),
    );
  }
  const ordered = order.filter((id) => unique.includes(id));
  const rest = unique
    .filter((id) => !order.includes(id))
    .sort((a, b) => compareLabels(nameById[a] ?? a, nameById[b] ?? b));
  return [...ordered, ...rest];
}
