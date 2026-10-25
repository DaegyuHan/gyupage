import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { validEvent } from "@/lib/server/events";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const ev = validEvent({ ...(await req.json()), id });
    if (!ev) return NextResponse.json({ error: "일정 형식이 맞지 않아요" }, { status: 400 });
    const sql = await db();
    await sql`UPDATE events SET title = ${ev.title}, category = ${ev.category}, start_date = ${ev.start}, end_date = ${ev.end},
      time = ${ev.time ?? null}, memo = ${ev.memo ?? null}, updated_at = ${ev.updatedAt} WHERE id = ${id}`;
    return NextResponse.json({ event: ev });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const sql = await db();
    await sql`DELETE FROM events WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  });
}
