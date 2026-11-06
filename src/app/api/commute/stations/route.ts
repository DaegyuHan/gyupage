import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { searchStations } from "@/lib/server/commute";

/** GET ?q=아주대 — 정류장 찾기 (설정 화면용, 로그인 필요) */
export async function GET(req: Request) {
  return guarded(async () => {
    const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return NextResponse.json({ stations: [] });
    try {
      return NextResponse.json({ stations: (await searchStations(q)).slice(0, 30) });
    } catch (e) {
      return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
    }
  });
}
