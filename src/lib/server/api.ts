import { NextResponse } from "next/server";
import { requireAuth } from "./auth";
import { NoDatabaseError } from "./db";

type Handler = () => Promise<Response>;

/** 로그인 확인 + DB 오류를 알아보기 쉬운 응답으로 */
export async function guarded(fn: Handler): Promise<Response> {
  const denied = await requireAuth();
  if (denied) return denied;
  try {
    return await fn();
  } catch (e) {
    if (e instanceof NoDatabaseError) return NextResponse.json({ error: "DB 가 아직 연결되지 않았어요", nodb: true }, { status: 503 });
    console.error("[db]", e);
    const detail = process.env.NODE_ENV === "development" ? String(e) : undefined;
    return NextResponse.json({ error: "저장소 오류가 났어요", detail }, { status: 500 });
  }
}

export const isDay = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
