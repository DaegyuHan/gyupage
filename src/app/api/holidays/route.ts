import { NextResponse } from "next/server";
import { cached } from "@/lib/football/apiFootball";
import { cdn } from "@/lib/server/cache";
import { mfetch } from "@/lib/server/monitor";
import type { Holiday } from "@/lib/holidays";

/**
 * 공공데이터포털 특일정보(getRestDeInfo)로 임시공휴일·선거일 같은 '추가 공휴일'을 받아 옴.
 * DATA_GO_KR_KEY 가 없으면 빈 목록 — 기본 공휴일은 화면에서 바로 계산하니까 없어도 괜찮음.
 */
const fetchYear = cached("holidays-v1", 86400, async (year: number): Promise<Holiday[]> => {
  const raw = process.env.DATA_GO_KR_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!raw) return [];
  // 인코딩된 키(%2B…)든 디코딩된 키든 받기
  const key = raw.includes("%") ? raw : encodeURIComponent(raw);
  const url = `https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo?solYear=${year}&numOfRows=100&_type=json&ServiceKey=${key}`;
  const res = await mfetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`data.go.kr ${res.status}`);
  const j = (await res.json()) as { response?: { body?: { items?: { item?: unknown } | "" } } };
  const item = (j.response?.body?.items as { item?: unknown } | undefined)?.item;
  const list = (Array.isArray(item) ? item : item ? [item] : []) as { locdate: number; dateName: string; isHoliday: string }[];
  return list
    .filter((x) => x.isHoliday === "Y")
    .map((x) => {
      const s = String(x.locdate);
      return { date: `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`, name: x.dateName.trim() };
    });
});

export async function GET(req: Request) {
  const years = (new URL(req.url).searchParams.get("years") ?? "")
    .split(",")
    .map(Number)
    .filter((y) => y >= 2000 && y <= 2100)
    .slice(0, 3);
  const results = await Promise.all(years.map((y) => fetchYear(y).catch(() => [] as Holiday[])));
  return NextResponse.json({ holidays: results.flat() }, cdn(3600, 86400));
}
