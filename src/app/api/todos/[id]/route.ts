import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const { done } = (await req.json()) as { done?: boolean };
    const sql = await db();
    await sql`UPDATE todos SET done = ${!!done} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const sql = await db();
    await sql`DELETE FROM todos WHERE id = ${id}`;
    // 2주 지난 할 일은 겸사겸사 정리
    await sql`DELETE FROM todos WHERE day < to_char(now() - interval '14 days', 'YYYY-MM-DD')`;
    return NextResponse.json({ ok: true });
  });
}
