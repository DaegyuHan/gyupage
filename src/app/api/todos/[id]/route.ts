import { NextResponse } from "next/server";
import { guarded, isDay } from "@/lib/server/api";
import { db } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const b = (await req.json()) as { done?: boolean; text?: string; day?: string };
    const sql = await db();
    if (typeof b.done === "boolean") await sql`UPDATE todos SET done = ${b.done} WHERE id = ${id}`;
    if (typeof b.text === "string" && b.text.trim()) await sql`UPDATE todos SET text = ${b.text.trim().slice(0, 80)} WHERE id = ${id}`;
    if (isDay(b.day)) await sql`UPDATE todos SET day = ${b.day} WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const sql = await db();
    await sql`DELETE FROM todos WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  });
}
