import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { busArrivals } from "@/lib/server/commute";

/** GET ?stationId= — 이 정류장을 지나는 노선 목록 (설정 화면용, 로그인 필요) */
export async function GET(req: Request) {
  return guarded(async () => {
    const id = new URL(req.url).searchParams.get("stationId") ?? "";
    if (!/^\d{6,12}$/.test(id)) return NextResponse.json({ error: "정류장 번호가 이상해요" }, { status: 400 });
    try {
      const all = await busArrivals(id);
      const routes = all
        .map((b) => ({ route: b.route, type: b.type }))
        .sort((a, b) => a.route.localeCompare(b.route, "ko", { numeric: true }));
      return NextResponse.json({ routes });
    } catch (e) {
      return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
    }
  });
}
