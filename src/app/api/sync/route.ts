import { NextResponse } from "next/server";
import { cookies, headers } from "next/headers";
import { AUTH_COOKIE, isAuthed } from "@/lib/auth";
import { syncProjects } from "@/lib/projects-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function authorize(): Promise<boolean> {
  const hdrs = await headers();
  const cronSecret = hdrs.get("x-cron-secret");
  if (process.env.CRON_SECRET && cronSecret === process.env.CRON_SECRET) {
    return true;
  }
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return isAuthed(token);
}

export async function POST() {
  if (!(await authorize())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const result = await syncProjects();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[sync] failed:", err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
