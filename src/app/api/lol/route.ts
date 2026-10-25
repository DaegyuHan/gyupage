import { cdn } from "@/lib/server/cache";
import { NextResponse } from "next/server";
import { getLol, LolKeyError, LolSetupError } from "@/lib/games/lol";

export async function GET() {
  try {
    return NextResponse.json(await getLol(), cdn(600));
  } catch (e) {
    if (e instanceof LolSetupError) return NextResponse.json({ setup: true });
    if (e instanceof LolKeyError) {
      const detail = process.env.NODE_ENV === "development" ? `${String(e)} (key …${(process.env.RIOT_API_KEY ?? "").slice(-4)})` : undefined;
      return NextResponse.json({ expired: true, error: "Riot API 키가 만료됐어요.", detail }, { status: 502 });
    }
    console.error("[lol]", e);
    const detail = process.env.NODE_ENV === "development" ? String(e) : undefined;
    return NextResponse.json({ error: "LoL 기록을 불러오지 못했어요.", detail }, { status: 502 });
  }
}
