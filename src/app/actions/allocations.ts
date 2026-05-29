"use server";

import { revalidatePath } from "next/cache";
import { eq, sql } from "drizzle-orm";
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
    throw new Error("Giorni/sett invalido (0 < x ≤ 7)");
  }
}

function validateRange(start: string, end: string) {
  if (!start || !end) throw new Error("Settimane richieste");
  if (end < start) throw new Error("La settimana di fine viene prima di quella di inizio");
}

export async function createSegment(
  input: CreateSegmentInput,
): Promise<{ id: string }> {
  if (!input.personId) throw new Error("Persona richiesta");
  if (!input.projectId) throw new Error("Progetto richiesto");
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
  if (!id) throw new Error("Id richiesto");

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
  if (!id) throw new Error("Id richiesto");
  await db.delete(allocationSegments).where(eq(allocationSegments.id, id));
  revalidatePath("/");
}

export type SplitSegmentInput = {
  id: string;
  splitAtWeek: string;
};

// Spezza un segmento in due adiacenti al lunedì `splitAtWeek`:
//   originale: [startWeek, splitAtWeek - 1 settimana]
//   nuovo:     [splitAtWeek, endWeek]
// Entrambi mantengono persona, progetto e gg/sett.
export async function splitSegment(
  input: SplitSegmentInput,
): Promise<{ newId: string }> {
  if (!input.id) throw new Error("Id richiesto");
  if (!input.splitAtWeek) throw new Error("Settimana di split richiesta");

  const original = await db.query.allocationSegments.findFirst({
    where: eq(allocationSegments.id, input.id),
  });
  if (!original) throw new Error("Segmento non trovato");

  if (input.splitAtWeek <= original.startWeek) {
    throw new Error("Lo split deve cadere dopo l'inizio del segmento");
  }
  if (input.splitAtWeek > original.endWeek) {
    throw new Error("Lo split deve cadere entro la fine del segmento");
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

// Sottrae 7 giorni a una data yyyy-mm-dd in UTC.
function previousMondayISO(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - 7);
  return d.toISOString().slice(0, 10);
}
