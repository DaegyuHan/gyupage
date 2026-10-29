import { NextResponse } from "next/server";
import { getAllHistory, parseDoc, toKind } from "@/lib/history";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { kstDay, listUploaded } from "@/lib/server/historyDb";

const MAX_BYTES = 500_000;

/** 설정 화면: 올린 히스토리 문서 목록 */
export async function GET() {
  return guarded(async () => {
    const docs = await listUploaded();
    return NextResponse.json({
      docs: docs.map(({ slug, title, date, company, tags, filename, updatedAt, kind, projectId }) => ({ slug, title, date, company, tags, filename, updatedAt, kind, projectId: projectId ?? null })),
    });
  });
}

/**
 * md 파일 올리기 { files: [{ name, content }] }
 * - 같은 파일 이름으로 다시 올리면 내용을 바꿈
 * - 다른 파일인데 주소(slug)가 겹치면 뒤에 -2, -3 을 붙임
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = (await req.json()) as { files?: { name?: string; content?: string }[]; kind?: string; projectId?: string | null };
    const kind = toKind(body.kind);
    const sql0 = await db();
    // 프로젝트에 넣으면 구분은 그 프로젝트를 따라감
    let projectId: string | null = null;
    let projectKind = kind;
    if (typeof body.projectId === "string" && body.projectId) {
      const p = (await sql0`SELECT id, kind FROM history_projects WHERE id = ${body.projectId}`) as { id: string; kind: string }[];
      if (!p[0]) return NextResponse.json({ error: "없는 프로젝트예요" }, { status: 404 });
      projectId = p[0].id;
      projectKind = toKind(p[0].kind);
    }
    // 프로젝트에 올릴 때는 파일 하나만 (프로젝트마다 최신 문서 1개 유지)
    const files = (body.files ?? []).slice(0, projectId ? 1 : 20);
    const sql = await db();
    const fileSlugs = new Set(getAllHistory().map((d) => d.slug));
    const results: { name: string; ok: boolean; slug?: string; title?: string; date?: string; error?: string; replaced?: boolean }[] = [];
    for (const extra of (body.files ?? []).slice(projectId ? 1 : 20)) {
      results.push({ name: extra.name ?? "", ok: false, error: projectId ? "프로젝트에는 파일 하나만 올려요 (첫 파일만 올렸어요)" : "한 번에 20개까지예요" });
    }

    for (const f of files) {
      const name = (f.name ?? "").trim().split(/[\\/]/).pop() ?? "";
      const content = f.content ?? "";
      if (!/\.(md|markdown)$/i.test(name)) {
        results.push({ name, ok: false, error: "md 파일만 올릴 수 있어요" });
        continue;
      }
      if (!content.trim()) {
        results.push({ name, ok: false, error: "내용이 비어 있어요" });
        continue;
      }
      if (Buffer.byteLength(content) > MAX_BYTES) {
        results.push({ name, ok: false, error: "500KB 보다 커요" });
        continue;
      }
      const filename = name.replace(/\.markdown$/i, ".md").normalize("NFC");
      const parsed = parseDoc(filename, content);
      const now = Date.now();
      // 날짜가 없는 파일은 올린 날짜로
      const doc = { ...parsed, date: parsed.date || kstDay(now) };

      // 같은 파일 이름이면 덮어쓰기
      const same = (await sql`SELECT slug FROM history_docs WHERE filename = ${filename}`) as { slug: string }[];
      if (same[0]) {
        // 날짜 없는 파일을 다시 올리면 '올린 날'도 새로
        if (parsed.date) await sql`UPDATE history_docs SET raw = ${content}, kind = ${projectKind}, project_id = ${projectId}, updated_at = ${now} WHERE slug = ${same[0].slug}`;
        else await sql`UPDATE history_docs SET raw = ${content}, kind = ${projectKind}, project_id = ${projectId}, created_at = ${now}, updated_at = ${now} WHERE slug = ${same[0].slug}`;
        if (projectId) await sql`DELETE FROM history_docs WHERE project_id = ${projectId} AND slug <> ${same[0].slug}`;
        results.push({ name, ok: true, slug: same[0].slug, title: doc.title, date: doc.date, replaced: true });
        continue;
      }

      let slug = doc.slug.replace(/[\s/?#%]+/g, "-").slice(0, 120) || `doc-${now}`;
      for (let i = 2; ; i++) {
        const taken = fileSlugs.has(slug) || ((await sql`SELECT 1 FROM history_docs WHERE slug = ${slug}`) as unknown[]).length > 0;
        if (!taken) break;
        slug = `${doc.slug.slice(0, 110)}-${i}`;
      }
      // 프로젝트의 예전 문서는 지우고 새 문서로 바꿔 끼움
      const replaced = projectId ? ((await sql`DELETE FROM history_docs WHERE project_id = ${projectId} RETURNING slug`) as unknown[]).length > 0 : false;
      await sql`INSERT INTO history_docs (slug, filename, raw, kind, project_id, created_at, updated_at) VALUES (${slug}, ${filename}, ${content}, ${projectKind}, ${projectId}, ${now}, ${now})`;
      results.push({ name, ok: true, slug, title: doc.title, date: doc.date, replaced });
    }
    return NextResponse.json({ results, projectId });
  });
}
