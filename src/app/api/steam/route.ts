import { NextResponse } from "next/server";
import { getSteam, SteamSetupError } from "@/lib/games/steam";

export async function GET() {
  try {
    return NextResponse.json(await getSteam());
  } catch (e) {
    if (e instanceof SteamSetupError) return NextResponse.json({ setup: true });
    console.error("[steam]", e);
    const detail = process.env.NODE_ENV === "development" ? String(e) : undefined;
    return NextResponse.json({ error: "Steam 정보를 불러오지 못했어요.", detail }, { status: 502 });
  }
}
