import { NextResponse } from "next/server";
import { getAllHistory, parseDoc, toKind } from "@/lib/history";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { listUploaded } from "@/lib/server/historyDb";

const MAX_BYTES = 500_000;

/** 설정 화면: 올린 히스토리 문서 목록 */
export async function GET() {
  return guarded(async () => {
    const docs = await listUploaded();
    return NextResponse.json({
      docs: docs.map(({ slug, title, date, company, tags, filename, updatedAt, kind }) => ({ slug, title, date, company, tags, filename, updatedAt, kind })),
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
    const body = (await req.json()) as { files?: { name?: string; content?: string }[]; kind?: string };
    const kind = toKind(body.kind);
    const files = (body.files ?? []).slice(0, 20);
    const sql = await db();
    const fileSlugs = new Set(getAllHistory().map((d) => d.slug));
    const results: { name: string; ok: boolean; slug?: string; title?: string; date?: string; error?: string; replaced?: boolean }[] = [];

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
      const doc = parseDoc(filename, content);
      const now = Date.now();

      // 같은 파일 이름이면 덮어쓰기
      const same = (await sql`SELECT slug FROM history_docs WHERE filename = ${filename}`) as { slug: string }[];
      if (same[0]) {
        await sql`UPDATE history_docs SET raw = ${content}, kind = ${kind}, updated_at = ${now} WHERE slug = ${same[0].slug}`;
        results.push({ name, ok: true, slug: same[0].slug, title: doc.title, date: doc.date, replaced: true });
        continue;
      }

      let slug = doc.slug.replace(/[\s/?#%]+/g, "-").slice(0, 120) || `doc-${now}`;
      for (let i = 2; ; i++) {
        const taken = fileSlugs.has(slug) || ((await sql`SELECT 1 FROM history_docs WHERE slug = ${slug}`) as unknown[]).length > 0;
        if (!taken) break;
        slug = `${doc.slug.slice(0, 110)}-${i}`;
      }
      await sql`INSERT INTO history_docs (slug, filename, raw, kind, created_at, updated_at) VALUES (${slug}, ${filename}, ${content}, ${kind}, ${now}, ${now})`;
      results.push({ name, ok: true, slug, title: doc.title, date: doc.date });
    }
    return NextResponse.json({ results });
  });
}
