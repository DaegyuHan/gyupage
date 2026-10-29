import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { checkHealthToken, parseHealth, recentHealth, saveHealth } from "@/lib/server/health";

/**
 * POST: 아이폰 단축어가 오늘 건강 기록을 보냄 (Authorization: Bearer <토큰>)
 *   { steps, sleepMinutes | sleepHours, activeKcal, exerciseMinutes, distanceKm, day? }
 *   여러 날을 한 번에: { days: [ {...}, {...} ] }
 * GET: 홈 화면용 최근 기록 (로그인 필요)
 */
export async function POST(req: Request) {
  if (!checkHealthToken(req)) return NextResponse.json({ error: "토큰이 맞지 않아요" }, { status: 401 });
  let body: Record<string, unknown>;
  try {
    const text = await req.text();
    body = text.trim() ? (JSON.parse(text) as Record<string, unknown>) : {};
  } catch {
    return NextResponse.json({ error: "JSON 형식이 아니에요" }, { status: 400 });
  }
  try {
    const items = Array.isArray(body.days) ? (body.days as Record<string, unknown>[]).slice(0, 60) : [body];
    const saved = items.map(parseHealth);
    for (const h of saved) await saveHealth(h);
    const t = saved.at(-1)!;
    // 단축어 '결과 보기'에 보이는 한 줄
    const parts = [
      t.steps != null && `걸음 ${t.steps.toLocaleString("ko-KR")}`,
      t.sleepMin != null && `수면 ${Math.floor(t.sleepMin / 60)}시간 ${t.sleepMin % 60}분`,
      t.activeKcal != null && `활동 ${t.activeKcal}kcal`,
      t.exerciseMin != null && `운동 ${t.exerciseMin}분`,
    ].filter(Boolean);
    return NextResponse.json({ ok: true, day: t.day, message: `✅ ${t.day} 저장 · ${parts.join(" · ") || "값 없음"}`, saved });
  } catch (e) {
    console.error("[health]", e);
    return NextResponse.json({ error: "저장하지 못했어요" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return guarded(async () => {
    const days = Math.min(31, Math.max(1, Number(new URL(req.url).searchParams.get("days")) || 7));
    return NextResponse.json(await recentHealth(days), { headers: { "Cache-Control": "no-store" } });
  });
}
