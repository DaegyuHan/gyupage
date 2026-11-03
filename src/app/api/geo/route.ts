import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * 접속한 곳의 대략적인 위치 (Vercel 이 IP 로 알려 주는 값) — 위치 권한 창 없이 날씨 지역을 고르려고 씀
 * 사람마다 다르니 절대 캐시하지 않음. 로컬 개발에서는 값이 없어요.
 */
export async function GET(req: Request) {
  const h = req.headers;
  const lat = Number(h.get("x-vercel-ip-latitude"));
  const lon = Number(h.get("x-vercel-ip-longitude"));
  const city = h.get("x-vercel-ip-city");
  const ok = Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) && h.has("x-vercel-ip-latitude");
  return NextResponse.json(
    ok ? { lat: Math.round(lat * 100) / 100, lon: Math.round(lon * 100) / 100, city: city ? decodeURIComponent(city) : null } : { lat: null, lon: null, city: null },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
