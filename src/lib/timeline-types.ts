import type { Category } from "./categories";

export type Visibility = "active" | "archived" | "hidden";

export type Person = {
  id: string;
  firstName: string;
  lastName: string;
  propicUrl: string | null;
  capacityDaysPerWeek: number;
};

export type Project = {
  id: string;
  code: string | null;
  name: string;
  category: Category;
  visibility: Visibility;
};

export type AllocationSegment = {
  id: string;
  personId: string;
  projectId: string;
  startWeek: string;
  endWeek: string;
  daysPerWeek: number;
};

export type ProjectOrderEntry = {
  personId: string;
  projectId: string;
  sortOrder: number;
};

export type ViewMode = "people" | "projects";

export type DragState =
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

export type OptimisticAction =
  | { type: "create"; segment: AllocationSegment }
  | { type: "update"; id: string; patch: Partial<AllocationSegment> }
  | { type: "delete"; id: string };
