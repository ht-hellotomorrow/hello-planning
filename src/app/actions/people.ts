"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { people } from "@/db/schema";

export async function addPerson(formData: FormData) {
  const firstName = (formData.get("firstName") as string | null)?.trim();
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const capacityRaw = formData.get("capacity") as string | null;
  const propicUrl = (formData.get("propicUrl") as string | null)?.trim() || null;

  if (!firstName) {
    throw new Error("Nome richiesto");
  }
  const capacity = capacityRaw ? Number.parseFloat(capacityRaw) : 5;
  if (!Number.isFinite(capacity) || capacity < 0 || capacity > 7) {
    throw new Error("Capacity deve essere tra 0 e 7");
  }

  await db.insert(people).values({
    firstName,
    lastName,
    propicUrl,
    capacityDaysPerWeek: capacity,
  });

  revalidatePath("/");
  revalidatePath("/persone");
}

export async function updatePerson(formData: FormData) {
  const id = formData.get("id") as string | null;
  if (!id) throw new Error("Id richiesto");

  const firstName = (formData.get("firstName") as string | null)?.trim();
  const lastName = (formData.get("lastName") as string | null)?.trim() ?? "";
  const capacityRaw = formData.get("capacity") as string | null;
  const propicUrl =
    (formData.get("propicUrl") as string | null)?.trim() || null;

  if (!firstName) throw new Error("Nome richiesto");
  const capacity = capacityRaw ? Number.parseFloat(capacityRaw) : 5;
  if (!Number.isFinite(capacity) || capacity < 0 || capacity > 7) {
    throw new Error("Capacity deve essere tra 0 e 7");
  }

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
  revalidatePath("/persone");
}

export async function archivePerson(id: string) {
  await db.update(people).set({ archived: true }).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/persone");
}

export async function unarchivePerson(id: string) {
  await db.update(people).set({ archived: false }).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/persone");
}

export async function deletePerson(id: string) {
  // ON DELETE CASCADE sui foreign keys di allocation_segments
  // elimina automaticamente tutte le allocazioni della persona.
  await db.delete(people).where(eq(people.id, id));
  revalidatePath("/");
  revalidatePath("/persone");
}
