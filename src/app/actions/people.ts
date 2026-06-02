"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { people } from "@/db/schema";

function validateCapacity(raw: string | null | undefined): number {
  const c = raw ? Number.parseFloat(raw) : 5;
  if (!Number.isFinite(c) || c < 0 || c > 7) {
    throw new Error("Capacity must be between 0 and 7");
  }
  return c;
}

export async function addPerson(formData: FormData) {
  const firstName = (formData.get("firstName") as string | null)?.trim();
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const capacityRaw = formData.get("capacity") as string | null;
  const propicUrl = (formData.get("propicUrl") as string | null)?.trim() || null;

  if (!firstName) throw new Error("First name required");
  const capacity = validateCapacity(capacityRaw);

  // New people go at the bottom of the list.
  const maxRow = await db
    .select({ max: sql<number | null>`max(${people.sortOrder})` })
    .from(people);
  const nextOrder = (maxRow[0]?.max ?? -1) + 1;

  await db.insert(people).values({
    firstName,
    lastName,
    propicUrl,
    capacityDaysPerWeek: capacity,
    sortOrder: nextOrder,
  });

  revalidatePath("/");
  revalidatePath("/people");
}

export async function updatePerson(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("Id required");

  const firstName = (formData.get("firstName") as string | null)?.trim();
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const capacityRaw = formData.get("capacity") as string | null;
  const propicUrl =
    (formData.get("propicUrl") as string | null)?.trim() || null;

  if (!firstName) throw new Error("First name required");
  const capacity = validateCapacity(capacityRaw);

  await db
    .update(people)
    .set({
      firstName,
      lastName,
      propicUrl,
      capacityDaysPerWeek: capacity,
    })
    .where(eq(people.id, id));

  revalidatePath("/");
  revalidatePath("/people");
}

export async function archivePerson(id: string) {
  await db.update(people).set({ archived: true }).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/people");
}

export async function unarchivePerson(id: string) {
  await db.update(people).set({ archived: false }).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/people");
}

export async function reorderPeople(orderedIds: string[]) {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  // One UPDATE per id. Small list (<50), parallelizable.
  await Promise.all(
    orderedIds.map((id, i) =>
      db.update(people).set({ sortOrder: i }).where(eq(people.id, id)),
    ),
  );
  revalidatePath("/");
  revalidatePath("/people");
}

export async function deletePerson(id: string) {
  // ON DELETE CASCADE on allocation_segments foreign keys
  // automatically removes all the person's schedules.
  await db.delete(people).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/people");
}
