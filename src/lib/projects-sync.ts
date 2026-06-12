import { sql } from "drizzle-orm";
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
  const [records, existingRows] = await Promise.all([
    fetchAllProjects(),
    db
      .select({ id: projects.id, airtableRecordId: projects.airtableRecordId })
      .from(projects)
      .where(sql`${projects.airtableRecordId} is not null`),
  ]);

  const existingIds = new Set(existingRows.map((r) => r.airtableRecordId!));

  const rows = records.map((rec) => {
    const f = rec.fields;
    return {
      airtableRecordId: rec.id,
      source: "airtable" as const,
      category: categoryFrom(f.Internal),
      code: f.Code ?? null,
      name: f["Project Name"] ?? f.Code ?? "Senza nome",
      status: f.Status ?? null,
      visibility: statusToVisibility(f.Status),
    };
  });

  // Single upsert — one round-trip regardless of record count
  if (rows.length > 0) {
    await db
      .insert(projects)
      .values(rows)
      .onConflictDoUpdate({
        target: projects.airtableRecordId,
        set: {
          source: sql`excluded.source`,
          category: sql`excluded.category`,
          code: sql`excluded.code`,
          name: sql`excluded.name`,
          status: sql`excluded.status`,
          visibility: sql`excluded.visibility`,
          updatedAt: sql`current_timestamp`,
        },
      });
  }

  const added = rows.filter((r) => !existingIds.has(r.airtableRecordId)).length;
  const updated = rows.length - added;

  return {
    added,
    updated,
    total: records.length,
    durationMs: Date.now() - start,
  };
}
