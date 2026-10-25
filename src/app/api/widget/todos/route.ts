import { NextResponse } from "next/server";
import { db } from "@/lib/server/db";
import { checkWidgetToken } from "@/lib/server/widget";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

/** 위젯용: 오늘(한국 시간) 할 일 — Authorization: Bearer <WIDGET_TOKEN> */
export async function GET(req: Request) {
  if (!checkWidgetToken(req)) return NextResponse.json({ error: "토큰이 맞지 않아요" }, { status: 401 });
  try {
    const now = new Date(Date.now() + 9 * 3600_000);
    const day = now.toISOString().slice(0, 10);
    const sql = await db();
    const rows = (await sql`SELECT text, done FROM todos WHERE day = ${day} ORDER BY position, created_at`) as { text: string; done: boolean }[];
    return NextResponse.json(
      {
        date: day,
        label: `${now.getUTCMonth() + 1}월 ${now.getUTCDate()}일 ${WEEK[now.getUTCDay()]}요일`,
        todos: rows,
        done: rows.filter((r) => r.done).length,
        total: rows.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("[widget]", e);
    return NextResponse.json({ error: "불러오지 못했어요" }, { status: 500 });
  }
}
