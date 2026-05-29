"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db/client";
import { projects } from "@/db/schema";

export type CreatePersonalProjectInput = {
  name: string;
  code?: string | null;
};

export async function createPersonalProject(
  input: CreatePersonalProjectInput,
): Promise<{ id: string }> {
  const name = input.name?.trim();
  if (!name) throw new Error("Nome richiesto");
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
