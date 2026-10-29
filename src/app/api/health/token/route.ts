import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { healthToken } from "@/lib/server/health";

/** 설정 화면용: 단축어에 넣을 주소·토큰 (로그인해야 볼 수 있음) */
export async function GET(req: Request) {
  return guarded(async () => {
    const token = healthToken();
    if (!token) return NextResponse.json({ error: "AUTH_SECRET 이 없어서 토큰을 만들 수 없어요" }, { status: 503 });
    const origin = new URL(req.url).origin;
    return NextResponse.json({ url: `${origin}/api/health`, token, local: /localhost|127\.0\.0\.1/.test(origin) }, { headers: { "Cache-Control": "no-store" } });
  });
}
