import { NextResponse } from "next/server";
import { hasPush, vapidPublicKey } from "@/lib/server/push";

/** 브라우저가 구독할 때 쓰는 공개 키 (공개돼도 괜찮은 값) */
export async function GET() {
  return NextResponse.json({ enabled: hasPush(), key: vapidPublicKey() ?? null });
}
