import "server-only";
import { eq } from "drizzle-orm";
import { db } from "@/db/client";
import { loginAttempts } from "@/db/schema";

// Finestra fissa: max MAX_ATTEMPTS tentativi falliti per IP ogni WINDOW_MS.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 8;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; retryAfter: number };

export async function checkLoginRateLimit(ip: string): Promise<RateLimitResult> {
  const now = Date.now();
  const row = await db.query.loginAttempts.findFirst({
    where: eq(loginAttempts.ip, ip),
  });
  // Nessun record o finestra scaduta → si riparte da zero.
  if (!row || now - row.windowStart > WINDOW_MS) return { ok: true };
  if (row.count >= MAX_ATTEMPTS) {
    return {
      ok: false,
      retryAfter: Math.ceil((row.windowStart + WINDOW_MS - now) / 1000),
    };
  }
  return { ok: true };
}

export async function recordFailedLogin(ip: string): Promise<void> {
  const now = Date.now();
  const row = await db.query.loginAttempts.findFirst({
    where: eq(loginAttempts.ip, ip),
  });
  if (!row || now - row.windowStart > WINDOW_MS) {
    await db
      .insert(loginAttempts)
      .values({ ip, count: 1, windowStart: now })
      .onConflictDoUpdate({
        target: loginAttempts.ip,
        set: { count: 1, windowStart: now },
      });
  } else {
    await db
      .update(loginAttempts)
      .set({ count: row.count + 1 })
      .where(eq(loginAttempts.ip, ip));
  }
}

export async function clearLoginAttempts(ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
