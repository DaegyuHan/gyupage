import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { rowToEvent, validEvent } from "@/lib/server/events";

export async function GET() {
  return guarded(async () => {
    const sql = await db();
    const rows = (await sql`SELECT * FROM events ORDER BY start_date, time NULLS LAST`) as Record<string, unknown>[];
    return NextResponse.json({ events: rows.map(rowToEvent) });
  });
}

export async function POST(req: Request) {
  return guarded(async () => {
    const ev = validEvent(await req.json());
    if (!ev) return NextResponse.json({ error: "일정 형식이 맞지 않아요" }, { status: 400 });
    const sql = await db();
    await sql`INSERT INTO events (id, title, category, start_date, end_date, time, memo, created_at, updated_at)
      VALUES (${ev.id}, ${ev.title}, ${ev.category}, ${ev.start}, ${ev.end}, ${ev.time ?? null}, ${ev.memo ?? null}, ${ev.createdAt}, ${ev.updatedAt})`;
    return NextResponse.json({ event: ev });
  });
}
