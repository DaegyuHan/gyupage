import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { toKind } from "@/lib/history";

type Ctx = { params: Promise<{ slug: string }> };

/** 올린 히스토리 문서 지우기 (저장소 파일은 여기서 못 지움) */
export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { slug } = await params;
    const sql = await db();
    await sql`DELETE FROM history_docs WHERE slug = ${decodeURIComponent(slug)}`;
    return NextResponse.json({ ok: true });
  });
}

/** 회사 / 기타 바꾸기 { kind } */
export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { slug } = await params;
    const { kind } = (await req.json()) as { kind?: string };
    const sql = await db();
    await sql`UPDATE history_docs SET kind = ${toKind(kind)}, updated_at = ${Date.now()} WHERE slug = ${decodeURIComponent(slug)}`;
    return NextResponse.json({ ok: true });
  });
}
