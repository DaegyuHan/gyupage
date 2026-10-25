import { NextResponse } from "next/server";
import { getHomeMatches } from "@/lib/home/matches";

export async function GET() {
  try {
    return NextResponse.json({ matches: await getHomeMatches() });
  } catch (e) {
    console.error("[home-matches]", e);
    return NextResponse.json({ matches: [] }, { status: 502 });
  }
}
