import type { Book, BookStatus, ReadingLog } from "@/lib/books/types";

export const STATUSES: BookStatus[] = ["reading", "paused", "done"];

export function rowToBook(r: Record<string, unknown>): Book {
  return {
    id: String(r.id),
    title: String(r.title),
    cover: (r.cover as string | null) ?? null,
    totalPages: Number(r.total_pages),
    currentPage: Number(r.current_page),
    status: r.status as BookStatus,
    startedAt: r.started_at == null ? null : Number(r.started_at),
    finishedAt: r.finished_at == null ? null : Number(r.finished_at),
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

export function rowToLog(r: Record<string, unknown>): ReadingLog {
  return {
    id: String(r.id),
    bookId: String(r.book_id),
    day: String(r.day),
    fromPage: Number(r.from_page),
    toPage: Number(r.to_page),
    createdAt: Number(r.created_at),
  };
}

/** 표지: data:image/… 는 600KB 까지, 그 밖에는 http(s) 주소만 */
export function cleanCover(v: unknown): string | null {
  if (typeof v !== "string" || !v) return null;
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/.test(v) && v.length <= 600_000) return v;
  if (/^https?:\/\/\S+$/.test(v) && v.length <= 2000) return v;
  return null;
}

export const kstDay = (ms = Date.now()) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);
