import { NextResponse } from "next/server";
import { getGithub } from "@/lib/github";

export async function GET() {
  try {
    return NextResponse.json(await getGithub());
  } catch (e) {
    console.error("[github]", e);
    return NextResponse.json({ error: "GitHub 기록을 불러오지 못했어요." }, { status: 502 });
  }
}
