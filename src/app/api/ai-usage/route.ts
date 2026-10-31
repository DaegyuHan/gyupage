import { NextResponse } from "next/server";
import { costUsd, priceOf, SEARCH_USD, usdKrw } from "@/lib/aiCost";
import { getRealCsNotes } from "@/lib/cs";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import type { AiPrediction } from "@/lib/football/aiPrediction";

/**
 * 설정 > AI 사용량: 기능별·월별 Claude 토큰과 원화 비용 (추정)
 * - 승부 예측: ai_predictions 에 저장된 사용량
 * - Daily CS: content/cs/*.md 의 usage (GitHub Actions 가 만들 때 기록)
 */
interface Bucket {
  count: number;
  input: number;
  output: number;
  searches: number;
  krw: number;
  /** 사용량 기록이 없어서 빠진 개수 */
  unknown: number;
}
const empty = (): Bucket => ({ count: 0, input: 0, output: 0, searches: 0, krw: 0, unknown: 0 });
const month = (t: number) => new Date(t + 9 * 3600_000).toISOString().slice(0, 7);

export async function GET() {
  return guarded(async () => {
    const rate = usdKrw();
    const months = new Map<string, Record<string, Bucket>>();
    const add = (key: string, t: number, model: string | undefined, u: { input: number; output: number; searches?: number } | undefined) => {
      const m = month(t);
      if (!months.has(m)) months.set(m, {});
      const b = (months.get(m)![key] ??= empty());
      b.count++;
      if (!u) {
        b.unknown++;
        return;
      }
      b.input += u.input;
      b.output += u.output;
      b.searches += u.searches ?? 0;
      b.krw += costUsd(model ?? "sonnet", u) * rate;
    };

    const sql = await db();
    const rows = (await sql`SELECT data FROM ai_predictions`) as { data: AiPrediction }[];
    for (const { data: p } of rows) add("predict", p.createdAt, p.model, p.usage);
    for (const n of getRealCsNotes()) add("cs", Date.parse(`${n.date}T08:30:00+09:00`), n.model, n.usage);

    const list = [...months.entries()]
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([m, by]) => ({ month: m, by, krw: Object.values(by).reduce((s, b) => s + b.krw, 0) }));
    const sonnet = priceOf("sonnet");
    return NextResponse.json(
      { rate, months: list, price: { model: "Sonnet", input: sonnet.input, output: sonnet.output, search: SEARCH_USD } },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}
