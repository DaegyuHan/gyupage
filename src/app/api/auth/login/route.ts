import { NextResponse } from "next/server";
import { checkPassword, makeSessionToken, SESSION_COOKIE, SESSION_DAYS, SESSION_HINT } from "@/lib/server/auth";

// 비밀번호를 마구 넣어 보는 걸 막는 아주 단순한 속도 제한 (서버 인스턴스 단위)
const fails: number[] = [];

export async function POST(req: Request) {
  if (!process.env.APP_PASSWORD) return NextResponse.json({ error: "APP_PASSWORD 가 설정되지 않았어요" }, { status: 503 });
  const now = Date.now();
  while (fails.length && fails[0] < now - 10 * 60_000) fails.shift();
  if (fails.length >= 10) return NextResponse.json({ error: "잠시 뒤에 다시 시도해 주세요" }, { status: 429 });

  const { password } = (await req.json().catch(() => ({}))) as { password?: string };
  if (typeof password !== "string" || !checkPassword(password)) {
    fails.push(now);
    await new Promise((r) => setTimeout(r, 600));
    return NextResponse.json({ error: "비밀번호가 맞지 않아요" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, makeSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  // 화면이 '로그인됐을 것'을 바로 알 수 있게 하는 표시 (값은 1 뿐이라 이걸로는 아무것도 못 함)
  res.cookies.set(SESSION_HINT, "1", {
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_DAYS * 86400,
  });
  return res;
}
