import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { cleanCover, rowToBook, STATUSES } from "@/lib/server/books";
import { db } from "@/lib/server/db";
import type { BookStatus } from "@/lib/books/types";

type Ctx = { params: Promise<{ id: string }> };

/** 제목·표지·전체 쪽 수·상태 고치기 (보낸 것만) */
export async function PUT(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const b = (await req.json()) as { title?: string; cover?: string | null; totalPages?: number; status?: BookStatus };
    const sql = await db();
    const rows = (await sql`SELECT * FROM books WHERE id = ${id}`) as Record<string, unknown>[];
    if (!rows[0]) return NextResponse.json({ error: "없는 책이에요" }, { status: 404 });
    const cur = rowToBook(rows[0]);
    const title = b.title !== undefined ? b.title.trim().slice(0, 200) || cur.title : cur.title;
    const cover = b.cover !== undefined ? cleanCover(b.cover) : cur.cover;
    const total = b.totalPages !== undefined && Number(b.totalPages) > 0 ? Math.round(Number(b.totalPages)) : cur.totalPages;
    const status = b.status && STATUSES.includes(b.status) ? b.status : cur.status;
    const now = Date.now();
    const finishedAt = status === "done" ? (cur.finishedAt ?? now) : null;
    await sql`UPDATE books SET title = ${title}, cover = ${cover}, total_pages = ${total},
      current_page = ${Math.min(cur.currentPage, total)}, status = ${status}, finished_at = ${finishedAt}, updated_at = ${now}
      WHERE id = ${id}`;
    const after = (await sql`SELECT * FROM books WHERE id = ${id}`) as Record<string, unknown>[];
    return NextResponse.json({ book: rowToBook(after[0]) });
  });
}

export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const sql = await db();
    await sql`DELETE FROM books WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  });
}
