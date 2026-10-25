import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { kstDay, kstHour, labelOf } from "@/lib/server/monitor";

const DAY = 86400_000;

/**
 * 그래프용: 고른 API 의 최근 48시간(시간별) + 14일(하루별) 호출 수
 * GET /api/monitor/history?source=api-football
 */
export async function GET(req: Request) {
  return guarded(async () => {
    const source = new URL(req.url).searchParams.get("source") || "api-football";
    const sql = await db();
    const since = kstHour(Date.now() - 47 * 3600_000);
    const fromDay = kstDay(Date.now() - 13 * DAY);
    const [hourly, daily, sources] = await Promise.all([
      sql`SELECT hour, calls, errors, remaining FROM api_usage_hourly WHERE source = ${source} AND hour >= ${since} ORDER BY hour`,
      sql`SELECT day, calls, errors FROM api_usage WHERE source = ${source} AND day >= ${fromDay} ORDER BY day`,
      sql`SELECT source, sum(calls)::int AS calls FROM api_usage WHERE day >= ${fromDay} GROUP BY source ORDER BY calls DESC`,
    ]);

    // 비어 있는 시간·날도 0 으로 채움 (그래프 칸이 빠지지 않게)
    const hMap = new Map((hourly as { hour: string; calls: number; errors: number; remaining: number | null }[]).map((r) => [r.hour, r]));
    const hours = Array.from({ length: 48 }, (_, i) => {
      const key = kstHour(Date.now() - (47 - i) * 3600_000);
      const r = hMap.get(key);
      return { key, calls: r?.calls ?? 0, errors: r?.errors ?? 0, remaining: r?.remaining ?? null };
    });
    const dMap = new Map((daily as { day: string; calls: number; errors: number }[]).map((r) => [r.day, r]));
    const days = Array.from({ length: 14 }, (_, i) => {
      const key = kstDay(Date.now() - (13 - i) * DAY);
      const r = dMap.get(key);
      return { key, calls: r?.calls ?? 0, errors: r?.errors ?? 0 };
    });

    return NextResponse.json(
      {
        source,
        label: labelOf(source),
        hours,
        days,
        sources: (sources as { source: string; calls: number }[]).map((s) => ({ source: s.source, label: labelOf(s.source), calls: s.calls })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
