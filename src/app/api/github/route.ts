import { cdn } from "@/lib/server/cache";
import { NextResponse } from "next/server";
import { getGithub } from "@/lib/github";

export async function GET() {
  try {
    return NextResponse.json(await getGithub(), cdn(900));
  } catch (e) {
    console.error("[github]", e);
    return NextResponse.json({ error: "GitHub 기록을 불러오지 못했어요." }, { status: 502 });
  }
}
