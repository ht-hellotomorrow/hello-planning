import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";
import {
  checkLoginRateLimit,
  clearLoginAttempts,
  recordFailedLogin,
} from "@/lib/rate-limit";

function clientIp(req: Request): string {
  // Netlify popola x-nf-client-connection-ip; fallback su x-forwarded-for.
  return (
    req.headers.get("x-nf-client-connection-ip") ||
    req.headers.get("x-forwarded-for")?.split(",")[0] ||
    "unknown"
  ).trim();
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  const limit = await checkLoginRateLimit(ip);
  if (!limit.ok) {
    return NextResponse.json(
      { error: "Troppi tentativi falliti. Riprova più tardi." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => ({}))) as {
    username?: string;
    password?: string;
  };
  const username = body.username;
  const password = body.password;

  if (!process.env.SHARED_PASSWORD || !process.env.SHARED_USERNAME) {
    return NextResponse.json(
      { error: "SHARED_USERNAME o SHARED_PASSWORD non configurata" },
      { status: 500 },
    );
  }
  if (
    !username ||
    !password ||
    username !== process.env.SHARED_USERNAME ||
    password !== process.env.SHARED_PASSWORD
  ) {
    await recordFailedLogin(ip);
    return NextResponse.json(
      { error: "Username o password sbagliati" },
      { status: 401 },
    );
  }

  await clearLoginAttempts(ip);

  const token = await expectedToken();
  if (!token) {
    return NextResponse.json({ error: "Auth error" }, { status: 500 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
