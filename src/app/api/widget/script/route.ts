import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { buildWidgetScript } from "@/lib/widget/scriptable";

/** 설정 화면용: 주소·토큰을 채운 Scriptable 스크립트 (로그인해야 받을 수 있음) */
export async function GET(req: Request) {
  return guarded(async () => {
    const token = process.env.WIDGET_TOKEN?.trim();
    if (!token) return NextResponse.json({ error: "WIDGET_TOKEN 이 설정되지 않았어요", setup: true }, { status: 503 });
    // 배포 주소 기준 (로컬에서 열면 localhost 가 들어가니 배포 사이트에서 복사하기)
    const origin = new URL(req.url).origin;
    return NextResponse.json(
      { script: buildWidgetScript(origin, token), origin, local: /localhost|127\.0\.0\.1/.test(origin) },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
