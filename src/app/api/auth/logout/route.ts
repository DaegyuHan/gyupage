import { NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_HINT } from "@/lib/server/auth";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });
  res.cookies.set(SESSION_HINT, "", { path: "/", maxAge: 0 });
  return res;
}
