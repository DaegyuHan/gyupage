import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/server/auth";
import { db, hasDb } from "@/lib/server/db";

export async function GET() {
  // DB 가 설정돼 있으면 연결·표 준비까지 확인 (서버가 켜진 뒤 처음 한 번만 실제로 접속)
  let dbOk = false;
  let dbError: string | undefined;
  if (hasDb()) {
    try {
      await db();
      dbOk = true;
    } catch (e) {
      console.error("[db]", e);
      // 접속 주소의 비밀번호가 새지 않게 지움
      dbError = String(e).replace(/postgres(ql)?:\/\/[^\s"']+/g, "postgresql://***").slice(0, 200);
    }
  }
  return NextResponse.json(
    { authed: await isAuthed(), db: hasDb(), dbOk, dbError, login: !!process.env.APP_PASSWORD },
    { headers: { "Cache-Control": "no-store" } },
  );
}
