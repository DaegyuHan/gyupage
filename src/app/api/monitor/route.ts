import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";
import { COLOR, hasDiscord, sendDiscord } from "@/lib/server/discord";
import { kstDay, labelOf } from "@/lib/server/monitor";
import { dailyReport } from "@/lib/server/notify";
import { hasPush } from "@/lib/server/push";

/** 설정 화면: 오늘 API 사용량 + 연결 상태 */
export async function GET() {
  return guarded(async () => {
    const sql = await db();
    const rows = (await sql`SELECT source, calls, errors, last_status, last_error, last_error_at, remaining, quota
      FROM api_usage WHERE day = ${kstDay()} ORDER BY calls DESC`) as Record<string, unknown>[];
    const [cron] = (await sql`SELECT at FROM notify_log WHERE key = 'cron:last'`) as { at: number }[];
    return NextResponse.json(
      {
        discord: hasDiscord(),
        push: hasPush(),
        cron: !!process.env.CRON_SECRET?.trim(),
        cronLast: cron ? Number(cron.at) : null,
        usage: rows.map((r) => ({
          source: String(r.source),
          label: labelOf(String(r.source)),
          calls: Number(r.calls),
          errors: Number(r.errors),
          lastError: (r.last_error as string | null) ?? null,
          lastErrorAt: r.last_error_at ? Number(r.last_error_at) : null,
          remaining: r.remaining == null ? null : Number(r.remaining),
          quota: r.quota == null ? null : Number(r.quota),
        })),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  });
}

/** { action: "test" | "report" } → 디스코드로 바로 보내기 */
export async function POST(req: Request) {
  return guarded(async () => {
    if (!hasDiscord()) return NextResponse.json({ error: "DISCORD_WEBHOOK_URL 이 없어요" }, { status: 503 });
    const { action } = (await req.json().catch(() => ({}))) as { action?: string };
    const ok =
      action === "report"
        ? await sendDiscord({ embeds: [await dailyReport()] })
        : await sendDiscord({
            embeds: [{ title: "✅ 규페이지 모니터 연결됐어요", color: COLOR.blue, description: "API 에러는 바로, 사용량 리포트는 매일 오전 9시에 여기로 와요." }],
          });
    return ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "디스코드로 보내지 못했어요" }, { status: 502 });
  });
}
