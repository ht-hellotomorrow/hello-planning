export const WEEK_WIDTH = 110;
export const SIDEBAR_WIDTH = 280;
/** Sticky sidebar sopra barre e linea Today durante lo scroll orizzontale */
export const SIDEBAR_Z_INDEX = 40;
export const HEADER_HEIGHT = 64;
export const PERSON_ROW_HEIGHT = 44;
export const PROJECT_ROW_BASE = 44;
export const LANE_HEIGHT = 32;
export const LANE_GAP = 4;
export const WEEKS_TOTAL = 60;
export const WEEKS_BEFORE_TODAY = 12;
export const RESIZE_HANDLE = 8;
export const SELECT_PROJECT_ROW_HEIGHT = 44;

export const PROJECT_ROW_DRAG = "application/x-hello-planning-project-row";

export function projectRowHeight(laneCount: number): number {
  if (laneCount <= 1) return PROJECT_ROW_BASE;
  return LANE_GAP + laneCount * (LANE_HEIGHT + LANE_GAP) + LANE_GAP;
}

export function formatTotal(n: number): string {
  if (n === 0) return "";
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}
