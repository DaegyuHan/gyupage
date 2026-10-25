import { NextResponse } from "next/server";
import { addDays, kstDate } from "@/lib/football/kst";
import { LEAGUE_MAP } from "@/lib/football/leagues";
import { fetchApiFootball, fetchOverseas, splitByDay } from "@/lib/football/providers";
import { sampleMatches } from "@/lib/football/sample";
import type { FootballResponse, Match, SourceState } from "@/lib/football/types";

// Next 15 의 GET 라우트는 기본적으로 매번 실행됨(날짜가 매일 바뀌니 그게 맞음).
// 외부 API 호출은 providers.ts 의 fetch 캐시(revalidate)로 아낌.

type Result = { matches: Match[]; state: SourceState; error?: string };

async function attempt(fn: () => Promise<Match[]>): Promise<Result> {
  try {
    return { matches: await fn(), state: "live" };
  } catch (e) {
    const noKey = e instanceof Error && e.message === "NO_KEY";
    if (!noKey) console.error("[football]", e);
    return {
      matches: [],
      state: noKey ? "sample" : "error",
      error: noKey ? undefined : e instanceof Error ? e.message.slice(0, 200) : String(e),
    };
  }
}

const isRegion = (region: "domestic" | "overseas") => (m: Match) => LEAGUE_MAP[m.league].region === region;

/**
 * 1순위: API-Football 하나로 6개 리그 전부 (날짜당 1회 호출)
 * 해외 리그는 API-Football 이 실패하면 football-data.org 로 한 번 더 시도
 * 둘 다 키가 없으면 예시 데이터
 */
export async function GET() {
  const today = kstDate(new Date());
  const yesterday = addDays(today, -1);
  const sample = sampleMatches(yesterday, today);

  const af = await attempt(() => fetchApiFootball(yesterday, today));

  let domestic: Result = { ...af, matches: af.matches.filter(isRegion("domestic")) };
  let overseas: Result = { ...af, matches: af.matches.filter(isRegion("overseas")) };

  if (af.state !== "live") {
    const fd = await attempt(() => fetchOverseas(yesterday, today));
    if (fd.state === "live" || af.state === "sample") overseas = fd;
  }
  if (domestic.state === "sample") domestic = { ...domestic, matches: sample.filter(isRegion("domestic")) };
  if (overseas.state === "sample") overseas = { ...overseas, matches: sample.filter(isRegion("overseas")) };

  const body: FootballResponse = {
    dates: { yesterday, today },
    days: splitByDay([...domestic.matches, ...overseas.matches], yesterday, today),
    sources: { overseas: overseas.state, domestic: domestic.state },
    generatedAt: new Date().toISOString(),
    errors: { overseas: overseas.error, domestic: domestic.error },
  };
  return NextResponse.json(body);
}
