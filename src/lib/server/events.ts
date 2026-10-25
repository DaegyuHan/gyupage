import type { CalendarEvent, CategoryId } from "@/lib/types";
import { isDay } from "./api";

const CATS: CategoryId[] = ["devlog", "project", "appointment", "personal"];

export function rowToEvent(r: Record<string, unknown>): CalendarEvent {
  return {
    id: String(r.id),
    title: String(r.title),
    category: r.category as CategoryId,
    start: String(r.start_date),
    end: String(r.end_date),
    time: (r.time as string | null) ?? undefined,
    memo: (r.memo as string | null) ?? undefined,
    createdAt: Number(r.created_at),
    updatedAt: Number(r.updated_at),
  };
}

/** 들어온 값 검사 + 정리 (이상하면 null) */
export function validEvent(v: unknown): CalendarEvent | null {
  if (!v || typeof v !== "object") return null;
  const e = v as Record<string, unknown>;
  if (typeof e.id !== "string" || !e.id || e.id.length > 100) return null;
  if (typeof e.title !== "string" || !e.title.trim()) return null;
  if (!CATS.includes(e.category as CategoryId)) return null;
  if (!isDay(e.start) || !isDay(e.end)) return null;
  const time = typeof e.time === "string" && /^\d{2}:\d{2}$/.test(e.time) ? e.time : undefined;
  const now = Date.now();
  return {
    id: e.id,
    title: e.title.trim().slice(0, 200),
    category: e.category as CategoryId,
    start: e.start,
    end: e.end < e.start ? e.start : e.end,
    time,
    memo: typeof e.memo === "string" ? e.memo.slice(0, 100_000) : undefined,
    createdAt: Number(e.createdAt) || now,
    updatedAt: Number(e.updatedAt) || now,
  };
}
