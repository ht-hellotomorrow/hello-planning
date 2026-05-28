// Greedy interval scheduling: assegna a ciascun segmento la più bassa "lane"
// (corsia verticale) che non collida con altri segmenti già piazzati su quella lane.

export type Laned<T> = T & { lane: number };

export function assignLanes<T extends { startWeek: string; endWeek: string; id: string }>(
  segments: T[],
): { laned: Laned<T>[]; count: number } {
  const sorted = [...segments].sort((a, b) => {
    if (a.startWeek !== b.startWeek) return a.startWeek.localeCompare(b.startWeek);
    if (a.endWeek !== b.endWeek) return a.endWeek.localeCompare(b.endWeek);
    return a.id < b.id ? -1 : 1;
  });

  const lanesEndWeek: string[] = [];
  const laned: Laned<T>[] = sorted.map((seg) => {
    let lane = lanesEndWeek.findIndex((end) => end < seg.startWeek);
    if (lane === -1) {
      lane = lanesEndWeek.length;
      lanesEndWeek.push(seg.endWeek);
    } else {
      lanesEndWeek[lane] = seg.endWeek;
    }
    return { ...seg, lane };
  });

  return { laned, count: lanesEndWeek.length };
}
