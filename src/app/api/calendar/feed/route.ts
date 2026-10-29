import { NextResponse } from "next/server";
import { buildIcs, type IcsEvent } from "@/lib/calendar/ics";
import { checkCalendarToken } from "@/lib/server/calendarFeed";
import { db } from "@/lib/server/db";

export const dynamic = "force-dynamic";

/**
 * 아이폰 캘린더 구독 주소 — 캘린더의 '약속' 카테고리만
 *   webcal://<사이트>/api/calendar/feed?token=…
 * 로그인 쿠키를 못 보내는 캘린더 앱용이라 주소의 토큰으로 확인 (읽기 전용)
 */
export async function GET(req: Request) {
  if (!checkCalendarToken(new URL(req.url).searchParams.get("token"))) {
    return new NextResponse("토큰이 맞지 않아요", { status: 401 });
  }
  try {
    const sql = await db();
    // 지난 6개월 ~ 앞으로 1년
    const now = Date.now() + 9 * 3600_000;
    const from = new Date(now - 183 * 86400_000).toISOString().slice(0, 10);
    const to = new Date(now + 366 * 86400_000).toISOString().slice(0, 10);
    const rows = (await sql`SELECT id, title, start_date, end_date, time, memo, updated_at FROM events
      WHERE category = 'appointment' AND end_date >= ${from} AND start_date <= ${to}
      ORDER BY start_date, time NULLS FIRST`) as Record<string, unknown>[];
    const events: IcsEvent[] = rows.map((r) => ({
      id: String(r.id),
      title: String(r.title),
      start: String(r.start_date),
      end: String(r.end_date),
      time: (r.time as string | null) ?? null,
      memo: (r.memo as string | null) ?? null,
      updatedAt: Number(r.updated_at),
    }));
    const origin = new URL(req.url).origin;
    const body = buildIcs(events, { name: "규페이지 약속", url: `${origin}/calendar`, alarmMinutes: 30 });
    return new NextResponse(body, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="gyupage-appointments.ics"',
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    console.error("[calendar-feed]", e);
    return new NextResponse("불러오지 못했어요", { status: 500 });
  }
}
