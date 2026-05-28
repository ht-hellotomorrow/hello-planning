import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { fetchAllProjects } from "./airtable";

type Visibility = "active" | "archived" | "hidden";
type Category = "ht_internal" | "ht_client";

const STATUS_VISIBILITY: Record<string, Visibility> = {
  "In progress": "active",
  Completed: "archived",
  "Awaiting final payment": "archived",
  Proposal: "hidden",
  "Proposal sent": "hidden",
  Lost: "hidden",
};

function statusToVisibility(status: string | undefined | null): Visibility {
  if (!status) return "hidden";
  return STATUS_VISIBILITY[status] ?? "hidden";
}

function categoryFrom(internal: boolean | undefined): Category {
  return internal ? "ht_internal" : "ht_client";
}

export type SyncResult = {
  added: number;
  updated: number;
  total: number;
  durationMs: number;
};

export async function syncProjects(): Promise<SyncResult> {
  const start = Date.now();
  const records = await fetchAllProjects();

  let added = 0;
  let updated = 0;

  for (const rec of records) {
    const f = rec.fields;
    const visibility = statusToVisibility(f.Status);
    const category = categoryFrom(f.Internal);
    const name = f["Project Name"] ?? f.Code ?? "Senza nome";

    const existing = await db.query.projects.findFirst({
      where: eq(projects.airtableRecordId, rec.id),
    });

    if (existing) {
      await db
        .update(projects)
        .set({
          source: "airtable",
          category,
          code: f.Code ?? null,
          name,
          status: f.Status ?? null,
          visibility,
          updatedAt: sql`current_timestamp`,
        })
        .where(eq(projects.id, existing.id));
      updated++;
    } else {
      await db.insert(projects).values({
        airtableRecordId: rec.id,
        source: "airtable",
        category,
        code: f.Code ?? null,
        name,
        status: f.Status ?? null,
        visibility,
      });
      added++;
    }
  }

  return {
    added,
    updated,
    total: records.length,
    durationMs: Date.now() - start,
  };
}
