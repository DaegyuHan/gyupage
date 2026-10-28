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

/** 회사 / 기타, 프로젝트 바꾸기 { kind?, projectId? } (projectId: null 이면 프로젝트에서 빼기) */
export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { slug } = await params;
    const body = (await req.json()) as { kind?: string; projectId?: string | null };
    const sql = await db();
    const key = decodeURIComponent(slug);
    if ("projectId" in body) {
      if (body.projectId) {
        const p = (await sql`SELECT kind FROM history_projects WHERE id = ${body.projectId}`) as { kind: string }[];
        if (!p[0]) return NextResponse.json({ error: "없는 프로젝트예요" }, { status: 404 });
        // 프로젝트에는 문서 하나만 → 원래 있던 문서는 프로젝트에서 빼서 '전체 기록'에 남김
        await sql`UPDATE history_docs SET project_id = NULL WHERE project_id = ${body.projectId} AND slug <> ${key}`;
        await sql`UPDATE history_docs SET project_id = ${body.projectId}, kind = ${toKind(p[0].kind)}, updated_at = ${Date.now()} WHERE slug = ${key}`;
      } else {
        await sql`UPDATE history_docs SET project_id = NULL, updated_at = ${Date.now()} WHERE slug = ${key}`;
      }
    }
    if (body.kind) {
      // 구분을 바꾸면 다른 구분의 프로젝트에서는 빠짐
      await sql`UPDATE history_docs SET kind = ${toKind(body.kind)}, project_id = CASE WHEN ${toKind(body.kind)} = 'etc' THEN NULL ELSE project_id END, updated_at = ${Date.now()} WHERE slug = ${key}`;
    }
    return NextResponse.json({ ok: true });
  });
}
