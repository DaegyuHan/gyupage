import { NextResponse } from "next/server";
import { getCommute } from "@/lib/server/commute";
import { autoKey, type CommuteKey } from "@/lib/commute";

export const dynamic = "force-dynamic";

/** GET /api/commute?mode=am|pm (없으면 시간 보고 자동) */
export async function GET(req: Request) {
  const m = new URL(req.url).searchParams.get("mode");
  const k: CommuteKey = m === "am" || m === "pm" ? m : autoKey();
  return NextResponse.json(await getCommute(k), { headers: { "Cache-Control": "no-store" } });
}
