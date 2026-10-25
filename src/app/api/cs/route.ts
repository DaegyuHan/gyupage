import { NextResponse } from "next/server";
import { getCsNotes, isCsSample } from "@/lib/cs";

// 글은 배포할 때 들어가므로 빌드 시점에 한 번 만들어 둠 (새 글이 올라오면 다시 배포됨)
export const dynamic = "force-static";

/** 홈 카드용: 최근 글 5개 (본문 제외) */
export function GET() {
  const notes = getCsNotes()
    .slice(0, 5)
    .map(({ date, no, category, title, summary, minutes, keywords }) => ({ date, no, category, title, summary, minutes, keywords }));
  return NextResponse.json({ sample: isCsSample(), notes });
}
