export type Category = "ht_internal" | "ht_client" | "personal";

export const CATEGORY_ORDER: Category[] = [
  "ht_internal",
  "ht_client",
  "personal",
];

export const CATEGORY_LABEL: Record<Category, string> = {
  ht_internal: "INTERNAL",
  ht_client: "EXTERNAL",
  personal: "PERSONAL",
};

export const CATEGORY_BADGE_CLASS: Record<Category, string> = {
  ht_internal: "bg-brand-soft text-brand",
  ht_client: "bg-red-100 text-red-700",
  personal: "bg-muted text-muted-foreground",
};

export const CATEGORY_COLOR_VAR: Record<Category, string> = {
  ht_internal: "var(--cat-internal)",
  ht_client: "var(--cat-external)",
  personal: "var(--cat-personal)",
};

export function categoryColor(category: Category): string {
  return CATEGORY_COLOR_VAR[category];
}

export function isPersonalCategory(category: Category): boolean {
  return category === "personal";
}
