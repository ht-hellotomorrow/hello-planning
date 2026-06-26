import { and, eq, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { allocationSegments, projects } from "@/db/schema";
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

function todayMondayISO(): string {
  const now = new Date();
  const d = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
  );
  const day = d.getUTCDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export type FutureScheduleProject = {
  projectId: string;
  projectName: string;
  projectCode: string | null;
  futureSegmentCount: number;
  segmentIds: string[];
};

export type SyncResult = {
  added: number;
  updated: number;
  total: number;
  durationMs: number;
  projectsWithFutureSchedules: FutureScheduleProject[];
};

export async function syncProjects(): Promise<SyncResult> {
  const start = Date.now();
  const today = todayMondayISO();

  const [records, existingRows, allAirtableDBProjects] = await Promise.all([
    fetchAllProjects(),
    db
      .select({ id: projects.id, airtableRecordId: projects.airtableRecordId })
      .from(projects)
      .where(sql`${projects.airtableRecordId} is not null`),
    // ALL airtable-sourced projects in DB (any visibility)
    db
      .select({
        id: projects.id,
        airtableRecordId: projects.airtableRecordId,
        name: projects.name,
        code: projects.code,
      })
      .from(projects)
      .where(eq(projects.source, "airtable")),
  ]);

  // For each Airtable record, compute the new visibility
  const airtableVisibilityMap = new Map(
    records.map((r) => [r.id, statusToVisibility(r.fields.Status)]),
  );

  // ALL DB airtable projects that are now non-active (newly transitioned OR already archived
  // but not yet cleaned up). This covers the case where a project was archived by a previous
  // sync that ran before transition-detection logic existed.
  const toCleanup = allAirtableDBProjects.filter((p) => {
    if (!p.airtableRecordId) return false;
    const newVis = airtableVisibilityMap.get(p.airtableRecordId);
    // non-active in Airtable (archived/hidden) OR deleted from Airtable entirely
    return newVis !== "active";
  });

  let projectsWithFutureSchedules: FutureScheduleProject[] = [];

  if (toCleanup.length > 0) {
    const transitionedIds = toCleanup.map((p) => p.id);

    // Delete past segments (endWeek strictly before today's Monday)
    await db
      .delete(allocationSegments)
      .where(
        and(
          inArray(allocationSegments.projectId, transitionedIds),
          lt(allocationSegments.endWeek, today),
        ),
      );

    // Find any remaining future/current segments
    const futureSegs = await db
      .select({
        id: allocationSegments.id,
        projectId: allocationSegments.projectId,
      })
      .from(allocationSegments)
      .where(inArray(allocationSegments.projectId, transitionedIds));

    if (futureSegs.length > 0) {
      const byProject = new Map<string, string[]>();
      for (const seg of futureSegs) {
        const ids = byProject.get(seg.projectId) ?? [];
        ids.push(seg.id);
        byProject.set(seg.projectId, ids);
      }
      projectsWithFutureSchedules = toCleanup
        .filter((p) => byProject.has(p.id))
        .map((p) => ({
          projectId: p.id,
          projectName: p.name,
          projectCode: p.code,
          futureSegmentCount: byProject.get(p.id)!.length,
          segmentIds: byProject.get(p.id)!,
        }));
    }

    // Ensure all cleaned-up projects are marked archived in DB
    await db
      .update(projects)
      .set({ visibility: "archived", updatedAt: sql`current_timestamp` })
      .where(inArray(projects.id, transitionedIds));
  }

  // Upsert all projects coming from Airtable
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
    projectsWithFutureSchedules,
  };
}
