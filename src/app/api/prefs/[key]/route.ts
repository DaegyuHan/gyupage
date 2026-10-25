import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { db } from "@/lib/server/db";

/** 기기 사이에 같이 쓰는 작은 설정값 (정해 둔 이름만) */
const KEYS = new Set(["csRead", "weatherPlace", "push"]);
type Ctx = { params: Promise<{ key: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { key } = await params;
    if (!KEYS.has(key)) return NextResponse.json({ error: "없는 설정이에요" }, { status: 404 });
    const sql = await db();
    const rows = (await sql`SELECT value FROM prefs WHERE key = ${key}`) as { value: unknown }[];
    return NextResponse.json({ value: rows[0]?.value ?? null });
  });
}

export async function PUT(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { key } = await params;
    if (!KEYS.has(key)) return NextResponse.json({ error: "없는 설정이에요" }, { status: 404 });
    const { value } = (await req.json()) as { value: unknown };
    const json = JSON.stringify(value ?? null);
    if (json.length > 50_000) return NextResponse.json({ error: "너무 커요" }, { status: 413 });
    const sql = await db();
    await sql`INSERT INTO prefs (key, value, updated_at) VALUES (${key}, ${json}::jsonb, ${Date.now()})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`;
    return NextResponse.json({ ok: true });
  });
}
