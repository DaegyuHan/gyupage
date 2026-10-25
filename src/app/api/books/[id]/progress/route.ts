import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { kstDay, rowToBook, rowToLog } from "@/lib/server/books";
import { db } from "@/lib/server/db";

type Ctx = { params: Promise<{ id: string }> };

/** 지금 몇 쪽까지 읽었는지 { page } → 책 갱신 + 읽은 기록 한 줄 */
export async function POST(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const { page } = (await req.json()) as { page?: number };
    const sql = await db();
    const rows = (await sql`SELECT * FROM books WHERE id = ${id}`) as Record<string, unknown>[];
    if (!rows[0]) return NextResponse.json({ error: "없는 책이에요" }, { status: 404 });
    const book = rowToBook(rows[0]);
    const to = Math.round(Number(page));
    if (!(to >= 0 && to <= book.totalPages)) return NextResponse.json({ error: `0~${book.totalPages} 사이로 적어 주세요` }, { status: 400 });

    const now = Date.now();
    const done = to >= book.totalPages;
    let log = null;
    if (to !== book.currentPage) {
      const l = { id: randomUUID(), day: kstDay(now) };
      await sql`INSERT INTO reading_logs (id, book_id, day, from_page, to_page, created_at)
        VALUES (${l.id}, ${id}, ${l.day}, ${book.currentPage}, ${to}, ${now})`;
      const lr = (await sql`SELECT * FROM reading_logs WHERE id = ${l.id}`) as Record<string, unknown>[];
      log = rowToLog(lr[0]);
    }
    const status = done ? "done" : book.status === "done" ? "reading" : book.status;
    await sql`UPDATE books SET current_page = ${to}, status = ${status},
      finished_at = ${done ? (book.finishedAt ?? now) : null}, started_at = ${book.startedAt ?? now}, updated_at = ${now}
      WHERE id = ${id}`;
    const after = (await sql`SELECT * FROM books WHERE id = ${id}`) as Record<string, unknown>[];
    return NextResponse.json({ book: rowToBook(after[0]), log });
  });
}
