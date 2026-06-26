"use server";

import { revalidatePath } from "next/cache";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { allocationSegments } from "@/db/schema";

export type CreateSegmentInput = {
  personId: string;
  projectId: string;
  startWeek: string;
  endWeek: string;
  daysPerWeek: number;
};

function validateDays(d: number) {
  if (!Number.isFinite(d) || d <= 0 || d > 7) {
    throw new Error("Days per week must be between 0 and 7");
  }
}

function validateRange(start: string, end: string) {
  if (!start || !end) throw new Error("Weeks required");
  if (end < start) throw new Error("End week is before start week");
}

export async function createSegment(
  input: CreateSegmentInput,
): Promise<{ id: string }> {
  if (!input.personId) throw new Error("Person required");
  if (!input.projectId) throw new Error("Project required");
  validateRange(input.startWeek, input.endWeek);
  validateDays(input.daysPerWeek);

  const id = crypto.randomUUID();
  await db.insert(allocationSegments).values({
    id,
    personId: input.personId,
    projectId: input.projectId,
    startWeek: input.startWeek,
    endWeek: input.endWeek,
    daysPerWeek: input.daysPerWeek,
  });

  revalidatePath("/");
  return { id };
}

export type UpdateSegmentInput = {
  startWeek?: string;
  endWeek?: string;
  daysPerWeek?: number;
};

export async function updateSegment(id: string, patch: UpdateSegmentInput) {
  if (!id) throw new Error("Id required");

  const update: Record<string, unknown> = {
    updatedAt: sql`current_timestamp`,
  };

  if (patch.startWeek !== undefined) update.startWeek = patch.startWeek;
  if (patch.endWeek !== undefined) update.endWeek = patch.endWeek;
  if (patch.daysPerWeek !== undefined) {
    validateDays(patch.daysPerWeek);
    update.daysPerWeek = patch.daysPerWeek;
  }

  if (patch.startWeek !== undefined && patch.endWeek !== undefined) {
    validateRange(patch.startWeek, patch.endWeek);
  }

  await db
    .update(allocationSegments)
    .set(update)
    .where(eq(allocationSegments.id, id));

  revalidatePath("/");
}

export async function deleteSegment(id: string) {
  if (!id) throw new Error("Id required");
  await db.delete(allocationSegments).where(eq(allocationSegments.id, id));
  revalidatePath("/");
}

export async function deleteSegmentsByIds(ids: string[]) {
  if (!ids.length) return;
  await db
    .delete(allocationSegments)
    .where(inArray(allocationSegments.id, ids));
  revalidatePath("/");
}

export type SplitSegmentInput = {
  id: string;
  splitAtWeek: string;
};

// Split a segment in two adjacent ones at Monday `splitAtWeek`:
//   original: [startWeek, splitAtWeek - 1 week]
//   new:      [splitAtWeek, endWeek]
// Both keep the same person, project, and days/week.
export async function splitSegment(
  input: SplitSegmentInput,
): Promise<{ newId: string }> {
  if (!input.id) throw new Error("Id required");
  if (!input.splitAtWeek) throw new Error("Split week required");

  const original = await db.query.allocationSegments.findFirst({
    where: eq(allocationSegments.id, input.id),
  });
  if (!original) throw new Error("Segment not found");

  if (input.splitAtWeek <= original.startWeek) {
    throw new Error("Split must fall after the segment start");
  }
  if (input.splitAtWeek > original.endWeek) {
    throw new Error("Split must fall within the segment end");
  }

  const newOriginalEnd = previousMondayISO(input.splitAtWeek);
  const newId = crypto.randomUUID();

  await db
    .update(allocationSegments)
    .set({ endWeek: newOriginalEnd, updatedAt: sql`current_timestamp` })
    .where(eq(allocationSegments.id, input.id));

  await db.insert(allocationSegments).values({
    id: newId,
    personId: original.personId,
    projectId: original.projectId,
    startWeek: input.splitAtWeek,
    endWeek: original.endWeek,
    daysPerWeek: original.daysPerWeek,
  });

  revalidatePath("/");
  return { newId };
}

// Subtracts 7 days from a yyyy-mm-dd date in UTC.
function previousMondayISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}
