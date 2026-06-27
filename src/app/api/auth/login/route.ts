import { NextResponse } from "next/server";
import { AUTH_COOKIE, expectedToken } from "@/lib/auth";

export async function POST(req: Request) {
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
    return NextResponse.json(
      { error: "Username o password sbagliati" },
      { status: 401 },
    );
  }

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
