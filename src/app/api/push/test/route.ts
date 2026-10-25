import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { hasPush, sendPush } from "@/lib/server/push";

/** 테스트 알림 (이 기기만, 없으면 전체) */
export async function POST(req: Request) {
  return guarded(async () => {
    if (!hasPush()) return NextResponse.json({ error: "VAPID 키가 아직 없어요" }, { status: 503 });
    const { endpoint } = (await req.json().catch(() => ({}))) as { endpoint?: string };
    const sent = await sendPush(
      { title: "규페이지 알림 테스트 🔔", body: "이렇게 알림이 와요. 설정에서 받을 알림을 고를 수 있어요.", url: "/settings#push", tag: "test" },
      { origin: new URL(req.url).origin, only: typeof endpoint === "string" ? endpoint : undefined },
    );
    return NextResponse.json({ sent });
  });
}
