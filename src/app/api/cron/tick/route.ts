import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { db, hasDb } from "@/lib/server/db";
import { COLOR, hasDiscord, once, sendDiscord } from "@/lib/server/discord";
import { runTick } from "@/lib/server/notify";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

/**
 * 5분마다 불러 주는 곳 (cron-job.org 등) + Vercel 하루 1번 크론
 *   Authorization: Bearer <CRON_SECRET>   또는   ?key=<CRON_SECRET>
 */
function allowed(req: Request) {
  const want = process.env.CRON_SECRET?.trim().replace(/^["']|["']$/g, "");
  if (!want) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || new URL(req.url).searchParams.get("key") || "";
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

async function handle(req: Request) {
  if (!allowed(req)) return NextResponse.json({ error: "키가 맞지 않아요" }, { status: 401 });
  const started = Date.now();
  try {
    const result = await runTick(new URL(req.url).origin);
    if (hasDb()) {
      const sql = await db();
      await sql`INSERT INTO notify_log (key, at) VALUES ('cron:last', ${Date.now()}) ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at`;
    }
    return NextResponse.json({ ok: true, ms: Date.now() - started, ...result }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("[cron]", e);
    if (hasDiscord() && (await once("err:cron", 3600_000).catch(() => true))) {
      await sendDiscord({
        embeds: [{ title: "⚠️ 5분 작업(크론) 실패", color: COLOR.red, description: "```\n" + String((e as Error)?.stack ?? e).slice(0, 900) + "\n```" }],
      });
    }
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}

export const GET = handle;
export const POST = handle;
