import { NextResponse } from "next/server";
import { isAuthed, SESSION_DAYS, SESSION_HINT } from "@/lib/server/auth";
import { db, hasDb } from "@/lib/server/db";

/** 로그인 상태 (쿠키만 봐서 빠름). ?check=1 이면 DB 접속까지 확인 */
export async function GET(req: Request) {
  const check = new URL(req.url).searchParams.get("check") === "1";
  let dbOk: boolean | undefined;
  let dbError: string | undefined;
  if (check && hasDb()) {
    dbOk = false;
    try {
      await db();
      dbOk = true;
    } catch (e) {
      console.error("[db]", e);
      // 접속 주소의 비밀번호가 새지 않게 지움
      dbError = String(e).replace(/postgres(ql)?:\/\/[^\s"']+/g, "postgresql://***").slice(0, 200);
    }
  }
  const authed = await isAuthed();
  const res = NextResponse.json(
    { authed, db: hasDb(), dbOk, dbError, login: !!process.env.APP_PASSWORD },
    { headers: { "Cache-Control": "no-store" } },
  );
  // 세션이 끝났으면 '로그인됨' 표시도 지움
  if (!authed) res.cookies.set(SESSION_HINT, "", { path: "/", maxAge: 0 });
  else
    res.cookies.set(SESSION_HINT, "1", {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_DAYS * 86400,
    });
  return res;
}
