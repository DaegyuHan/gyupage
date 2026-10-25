import { cdn } from "@/lib/server/cache";
import { NextResponse } from "next/server";
import { getEsports } from "@/lib/esports";

export async function GET() {
  try {
    return NextResponse.json(await getEsports(), cdn(180));
  } catch (e) {
    console.error("[esports]", e);
    return NextResponse.json({ error: "e스포츠 일정을 불러오지 못했어요." }, { status: 502 });
  }
}
