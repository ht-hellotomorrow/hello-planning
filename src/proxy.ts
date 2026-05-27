import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, isAuthed } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const isLoginRoute =
    pathname === "/login" || pathname === "/api/auth/login";
  if (isLoginRoute) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (await isAuthed(token)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  if (pathname !== "/") url.searchParams.set("from", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.svg$|.*\\.png$|.*\\.jpg$).*)",
  ],
};
