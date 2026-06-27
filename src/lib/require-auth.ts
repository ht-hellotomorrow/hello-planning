import "server-only";
import { cookies } from "next/headers";
import { AUTH_COOKIE, isAuthed } from "./auth";

/**
 * Difesa in profondità per le server action: anche se il proxy (middleware)
 * dovesse non coprire una route, ogni mutation verifica comunque il cookie.
 * Le server action sono endpoint POST pubblici, quindi non basta il middleware.
 */
export async function requireAuth(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!(await isAuthed(token))) {
    throw new Error("Non autorizzato");
  }
}
