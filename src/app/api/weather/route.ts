import { NextResponse, type NextRequest } from "next/server";
import { DEFAULT_PLACE, getWeather } from "@/lib/weather";

/** GET /api/weather?lat=37.66&lon=126.83 (없으면 수원) */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams;
  const num = (v: string | null, min: number, max: number) => {
    const n = Number(v);
    return v !== null && Number.isFinite(n) && n >= min && n <= max ? n : null;
  };
  // 캐시가 잘게 쪼개지지 않게 소수 둘째 자리(약 1km)로 반올림
  const lat = Math.round((num(q.get("lat"), -90, 90) ?? DEFAULT_PLACE.lat) * 100) / 100;
  const lon = Math.round((num(q.get("lon"), -180, 180) ?? DEFAULT_PLACE.lon) * 100) / 100;

  try {
    return NextResponse.json(await getWeather(lat, lon));
  } catch (e) {
    console.error("[weather]", e);
    return NextResponse.json({ error: "날씨를 불러오지 못했어요." }, { status: 502 });
  }
}
