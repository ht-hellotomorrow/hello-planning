import {
  type Category,
  CATEGORY_COLOR_VAR,
  isPersonalCategory,
} from "./categories";

type Visibility = "active" | "archived" | "hidden";

export type ProjectColorInput = {
  category: Category;
  visibility: Visibility;
};

export function projectColor(p: ProjectColorInput): string {
  if (p.visibility === "archived") return "var(--cat-archived)";
  return CATEGORY_COLOR_VAR[p.category];
}

export function isPersonal(p: { category: Category }): boolean {
  return isPersonalCategory(p.category);
}
