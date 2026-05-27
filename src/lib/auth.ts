export const AUTH_COOKIE = "hp_auth";

async function sha256(input: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(input),
  );
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function expectedToken(): Promise<string | null> {
  const secret = process.env.SHARED_PASSWORD;
  if (!secret) return null;
  return sha256(`hp:${secret}`);
}

export async function isAuthed(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await expectedToken();
  if (!expected) return false;
  return token === expected;
}
