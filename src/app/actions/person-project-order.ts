"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { personProjectOrder } from "@/db/schema";
import { requireAuth } from "@/lib/require-auth";

export async function savePersonProjectOrder(
  personId: string,
  projectIds: string[],
) {
  await requireAuth();
  if (!personId) throw new Error("Persona richiesta");

  await db
    .delete(personProjectOrder)
    .where(eq(personProjectOrder.personId, personId));

  if (projectIds.length === 0) {
    revalidatePath("/");
    return;
  }

  await db.insert(personProjectOrder).values(
    projectIds.map((projectId, i) => ({
      personId,
      projectId,
      sortOrder: i,
    })),
  );

  revalidatePath("/");
}
