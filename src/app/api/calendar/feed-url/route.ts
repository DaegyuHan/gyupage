import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { calendarToken } from "@/lib/server/calendarFeed";

/** 설정 화면용: 구독 주소 (로그인해야 볼 수 있음) */
export async function GET(req: Request) {
  return guarded(async () => {
    const token = calendarToken();
    if (!token) return NextResponse.json({ error: "AUTH_SECRET 이 없어서 주소를 만들 수 없어요" }, { status: 503 });
    const { host, origin } = new URL(req.url);
    const path = `/api/calendar/feed?token=${encodeURIComponent(token)}`;
    return NextResponse.json(
      { webcal: `webcal://${host}${path}`, https: `${origin}${path}`, local: /localhost|127\.0\.0\.1/.test(host) },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
