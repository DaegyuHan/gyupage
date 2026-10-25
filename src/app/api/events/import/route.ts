import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { rowToEvent, validEvent } from "@/lib/server/events";

/**
 * 여러 일정을 한 번에 넣기
 * - mode "merge": 같은 id 는 더 최근에 고친 쪽으로 (브라우저에 있던 일정 옮기기)
 * - mode "replace": 전부 지우고 이걸로 바꿈 (백업 파일 불러오기)
 */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = (await req.json()) as { events?: unknown[]; mode?: string };
    const list = (body.events ?? []).map(validEvent).filter((e): e is NonNullable<typeof e> => !!e);
    const sql = await db();
    if (body.mode === "replace") await sql`DELETE FROM events`;
    for (const ev of list) {
      await sql`INSERT INTO events (id, title, category, start_date, end_date, time, memo, created_at, updated_at)
        VALUES (${ev.id}, ${ev.title}, ${ev.category}, ${ev.start}, ${ev.end}, ${ev.time ?? null}, ${ev.memo ?? null}, ${ev.createdAt}, ${ev.updatedAt})
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, category = EXCLUDED.category, start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date, time = EXCLUDED.time, memo = EXCLUDED.memo, updated_at = EXCLUDED.updated_at
        WHERE events.updated_at < EXCLUDED.updated_at`;
    }
    const rows = (await sql`SELECT * FROM events ORDER BY start_date, time NULLS LAST`) as Record<string, unknown>[];
    return NextResponse.json({ imported: list.length, events: rows.map(rowToEvent) });
  });
}
