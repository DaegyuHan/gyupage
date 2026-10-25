import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { cleanCover, rowToBook, rowToLog } from "@/lib/server/books";
import { db } from "@/lib/server/db";

/** 책 목록 + 읽은 기록 (?logs=0 이면 기록 없이) */
export async function GET(req: Request) {
  return guarded(async () => {
    const sql = await db();
    const books = ((await sql`SELECT * FROM books ORDER BY (status = 'reading') DESC, updated_at DESC`) as Record<string, unknown>[]).map(rowToBook);
    const withLogs = new URL(req.url).searchParams.get("logs") !== "0";
    const logs = withLogs
      ? ((await sql`SELECT * FROM reading_logs ORDER BY created_at DESC LIMIT 1000`) as Record<string, unknown>[]).map(rowToLog)
      : [];
    return NextResponse.json({ books, logs });
  });
}

export async function POST(req: Request) {
  return guarded(async () => {
    const b = (await req.json()) as { id?: string; title?: string; cover?: string; totalPages?: number };
    const title = b.title?.trim().slice(0, 200);
    const total = Math.round(Number(b.totalPages));
    if (!b.id || !title || !(total > 0 && total < 100_000)) return NextResponse.json({ error: "제목과 전체 쪽 수를 확인해 주세요" }, { status: 400 });
    const now = Date.now();
    const sql = await db();
    await sql`INSERT INTO books (id, title, cover, total_pages, current_page, status, started_at, created_at, updated_at)
      VALUES (${b.id}, ${title}, ${cleanCover(b.cover)}, ${total}, 0, 'reading', ${now}, ${now}, ${now})`;
    const rows = (await sql`SELECT * FROM books WHERE id = ${b.id}`) as Record<string, unknown>[];
    return NextResponse.json({ book: rowToBook(rows[0]) });
  });
}
