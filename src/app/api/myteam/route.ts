import { NextResponse } from "next/server";
import { getMyTeams } from "@/lib/myteam";

export async function GET() {
  try {
    return NextResponse.json({ teams: await getMyTeams() });
  } catch (e) {
    console.error("[myteam]", e);
    const detail = process.env.NODE_ENV === "development" ? String(e) : undefined;
    return NextResponse.json({ error: "팀 정보를 불러오지 못했어요.", detail }, { status: 502 });
  }
}
