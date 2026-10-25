import { cdn } from "@/lib/server/cache";
import { NextResponse } from "next/server";
import { getF1 } from "@/lib/f1";

export async function GET() {
  try {
    return NextResponse.json(await getF1(), cdn(600));
  } catch (e) {
    console.error("[f1]", e);
    return NextResponse.json({ error: "F1 일정을 불러오지 못했어요." }, { status: 502 });
  }
}
