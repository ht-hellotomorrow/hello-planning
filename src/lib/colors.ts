type Category = "ht_internal" | "ht_client" | "personal";
type Visibility = "active" | "archived" | "hidden";

const PALETTES: Record<Category, string[]> = {
  ht_internal: [
    "var(--cat-internal-1)",
    "var(--cat-internal-2)",
    "var(--cat-internal-3)",
    "var(--cat-internal-4)",
  ],
  ht_client: [
    "var(--cat-client-1)",
    "var(--cat-client-2)",
    "var(--cat-client-3)",
    "var(--cat-client-4)",
  ],
  personal: ["var(--cat-personal)"],
};

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export type ProjectColorInput = {
  id: string;
  category: Category;
  visibility: Visibility;
};

export function projectColor(p: ProjectColorInput): string {
  if (p.visibility === "archived") return "var(--cat-archived)";
  const palette = PALETTES[p.category];
  return palette[hashStr(p.id) % palette.length];
}

export function isPersonal(p: { category: Category }): boolean {
  return p.category === "personal";
}
