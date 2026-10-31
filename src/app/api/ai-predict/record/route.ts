import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { listAiPredictions } from "@/lib/server/aiPredict";
import { recordStats } from "@/lib/football/aiPrediction";

// 끝난 경기 채점에 상세를 불러올 수 있어서 넉넉히
export const maxDuration = 60;

/** AI 승부 예측 성적: 목록 + 적중률·배당 대비 성적 (로그인 필요) */
export async function GET() {
  return guarded(async () => {
    const list = await listAiPredictions();
    return NextResponse.json(
      {
        stats: recordStats(list),
        items: list.map(({ matchId, kickoff, home, draw, away, score, home_name, away_name, league, result, odds, confidence, headline }) => ({
          matchId, kickoff, home, draw, away, score, home_name, away_name, league, result, odds, confidence, headline,
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
