"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { projects } from "@/db/schema";
import { isFerieProject } from "@/lib/ferie";

export type CreatePersonalProjectInput = {
  name: string;
  code?: string | null;
};

export async function createPersonalProject(
  input: CreatePersonalProjectInput,
): Promise<{ id: string }> {
  const name = input.name?.trim();
  if (!name) throw new Error("Name required");
  const code = input.code?.trim() || null;

  const id = crypto.randomUUID();
  await db.insert(projects).values({
    id,
    source: "local",
    category: "personal",
    name,
    code,
    status: null,
    visibility: "active",
  });

  revalidatePath("/");
  return { id };
}

export async function deletePersonalProject(id: string) {
  if (!id) throw new Error("Id required");
  if (isFerieProject(id)) {
    throw new Error("Il progetto FERIE non può essere eliminato");
  }
  await db
    .delete(projects)
    .where(and(eq(projects.id, id), eq(projects.source, "local")));
  revalidatePath("/");
}
