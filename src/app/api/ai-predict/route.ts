import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { generateAiPrediction, getAiPrediction } from "@/lib/server/aiPredict";
import { loadDetail } from "@/lib/football/loadDetail";

// Claude 가 웹 검색까지 하는 시간 (보통 40~90초)
export const maxDuration = 300;

/**
 * 경기 AI 승부 예측 (로그인 필요 — Claude API 비용이 들어서)
 * GET  ?id=espn-PL-123  → 저장된 예측 (없으면 null)
 * POST { id, refresh? } → 저장된 게 있으면 그대로, 없으면 Claude 로 새로 예측
 *   - 새 예측은 킥오프 전 경기만 (끝난 경기는 결과가 기사에 나와 있어서 의미 없음)
 *   - refresh 는 예측한 지 1시간 지났고 킥오프 전일 때만
 */
const validId = (s: unknown): s is string => typeof s === "string" && /^[a-zA-Z0-9-]{1,80}$/.test(s);

export async function GET(req: Request) {
  return guarded(async () => {
    const id = new URL(req.url).searchParams.get("id");
    if (!validId(id)) return NextResponse.json({ error: "경기 id 가 이상해요" }, { status: 400 });
    return NextResponse.json({ prediction: await getAiPrediction(id) }, { headers: { "Cache-Control": "no-store" } });
  });
}

export async function POST(req: Request) {
  return guarded(async () => {
    const b = (await req.json().catch(() => ({}))) as { id?: unknown; refresh?: unknown };
    if (!validId(b.id)) return NextResponse.json({ error: "경기 id 가 이상해요" }, { status: 400 });
    const saved = await getAiPrediction(b.id);
    const { d } = await loadDetail(b.id);
    if (!d) return NextResponse.json({ error: "경기 정보를 불러오지 못했어요" }, { status: 502 });
    const before = d.status === "scheduled" && Date.parse(d.kickoff) > Date.now();
    const stale = saved && Date.now() - saved.createdAt > 3600_000;
    if (saved && !(b.refresh && before && stale)) return NextResponse.json({ prediction: saved });
    if (!before) return NextResponse.json({ error: "시작했거나 끝난 경기는 새로 예측하지 않아요" }, { status: 409 });
    try {
      return NextResponse.json({ prediction: await generateAiPrediction(b.id, d) });
    } catch (e) {
      console.error("[ai-predict]", e);
      return NextResponse.json({ error: e instanceof Error ? e.message : "예측하지 못했어요" }, { status: 502 });
    }
  });
}
