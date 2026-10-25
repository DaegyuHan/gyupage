import { NextResponse } from "next/server";
import { isAuthed } from "@/lib/server/auth";
import { db, hasDb } from "@/lib/server/db";

export async function GET() {
  // DB 가 설정돼 있으면 연결·표 준비까지 확인 (서버가 켜진 뒤 처음 한 번만 실제로 접속)
  let dbOk = false;
  if (hasDb()) {
    try {
      await db();
      dbOk = true;
    } catch (e) {
      console.error("[db]", e);
    }
  }
  return NextResponse.json(
    { authed: await isAuthed(), db: hasDb(), dbOk, login: !!process.env.APP_PASSWORD },
    { headers: { "Cache-Control": "no-store" } },
  );
}
