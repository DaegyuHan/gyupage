import { cdn } from "@/lib/server/cache";
import { NextResponse } from "next/server";
import { getMaple, MapleSetupError } from "@/lib/games/maple";

export async function GET() {
  try {
    return NextResponse.json(await getMaple(), cdn(1800));
  } catch (e) {
    if (e instanceof MapleSetupError) return NextResponse.json({ setup: true }, { status: 200 });
    console.error("[maple]", e);
    const detail = process.env.NODE_ENV === "development" ? String(e) : undefined;
    return NextResponse.json({ error: "메이플스토리 정보를 불러오지 못했어요.", detail }, { status: 502 });
  }
}
