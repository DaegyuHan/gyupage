import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { removeSub, saveSub, type PushSub } from "@/lib/server/push";

const valid = (s: unknown): s is PushSub => {
  const v = s as PushSub;
  return (
    !!v &&
    typeof v.endpoint === "string" &&
    /^https:\/\//.test(v.endpoint) &&
    v.endpoint.length < 1000 &&
    typeof v.keys?.p256dh === "string" &&
    typeof v.keys?.auth === "string"
  );
};

/** 이 기기 알림 켜기 */
export async function POST(req: Request) {
  return guarded(async () => {
    const { subscription, device } = (await req.json()) as { subscription: unknown; device?: string };
    if (!valid(subscription)) return NextResponse.json({ error: "구독 정보가 이상해요" }, { status: 400 });
    await saveSub(subscription, typeof device === "string" ? device.slice(0, 80) : null);
    return NextResponse.json({ ok: true });
  });
}

/** 이 기기 알림 끄기 */
export async function DELETE(req: Request) {
  return guarded(async () => {
    const { endpoint } = (await req.json()) as { endpoint?: string };
    if (typeof endpoint !== "string") return NextResponse.json({ error: "endpoint 가 없어요" }, { status: 400 });
    await removeSub(endpoint);
    return NextResponse.json({ ok: true });
  });
}
