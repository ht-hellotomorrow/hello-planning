import { asc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import {
  allocationSegments,
  people,
  personProjectOrder,
  projects,
} from "@/db/schema";
import { todayMondayISO } from "@/lib/weeks";
import { Timeline } from "./_components/Timeline";

export const dynamic = "force-dynamic";

export default async function Home() {
  let peopleRows: Awaited<ReturnType<typeof loadPeople>> = [];
  let projectRows: Awaited<ReturnType<typeof loadProjects>> = [];
  let segmentRows: Awaited<ReturnType<typeof loadSegments>> = [];
  let projectOrderRows: Awaited<ReturnType<typeof loadProjectOrder>> = [];
  let dbError: string | null = null;

  try {
    [peopleRows, projectRows, segmentRows, projectOrderRows] =
      await Promise.all([
        loadPeople(),
        loadProjects(),
        loadSegments(),
        loadProjectOrder(),
      ]);
  } catch (err) {
    dbError = err instanceof Error ? err.message : "DB error";
  }

  if (dbError) {
    return (
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="max-w-md p-6 rounded-md border border-red-200 bg-red-50 text-red-800 text-sm">
          <strong>Database not initialized.</strong>
          <p className="mt-2">
            Run{" "}
            <code className="px-1.5 py-0.5 bg-red-100 rounded font-mono text-xs">
              npm run db:push
            </code>{" "}
            to create the tables.
          </p>
          <p className="mt-2 text-xs opacity-70">{dbError}</p>
        </div>
      </main>
    );
  }

  return (
    <Timeline
      people={peopleRows}
      projects={projectRows}
      segments={segmentRows}
      projectOrder={projectOrderRows}
      todayISO={todayMondayISO()}
    />
  );
}

async function loadPeople() {
  return db
    .select({
      id: people.id,
      firstName: people.firstName,
      lastName: people.lastName,
      propicUrl: people.propicUrl,
      capacityDaysPerWeek: people.capacityDaysPerWeek,
    })
    .from(people)
    .where(eq(people.archived, false))
    .orderBy(asc(people.sortOrder), asc(people.firstName));
}

async function loadProjects() {
  return db
    .select({
      id: projects.id,
      code: projects.code,
      name: projects.name,
      category: projects.category,
      visibility: projects.visibility,
    })
    .from(projects);
}

async function loadSegments() {
  return db
    .select({
      id: allocationSegments.id,
      personId: allocationSegments.personId,
      projectId: allocationSegments.projectId,
      startWeek: allocationSegments.startWeek,
      endWeek: allocationSegments.endWeek,
      daysPerWeek: allocationSegments.daysPerWeek,
    })
    .from(allocationSegments);
}

async function loadProjectOrder() {
  return db
    .select({
      personId: personProjectOrder.personId,
      projectId: personProjectOrder.projectId,
      sortOrder: personProjectOrder.sortOrder,
    })
    .from(personProjectOrder)
    .orderBy(
      asc(personProjectOrder.personId),
      asc(personProjectOrder.sortOrder),
    );
}
