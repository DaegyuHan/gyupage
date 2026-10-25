import { NextResponse } from "next/server";
import { guarded, isDay } from "@/lib/server/api";
import { db } from "@/lib/server/db";

export interface TodoRow {
  id: string;
  day: string;
  text: string;
  done: boolean;
}

const MAX = 6;

/** ?day=YYYY-MM-DD (여러 날은 ?day=…&day=…) */
export async function GET(req: Request) {
  return guarded(async () => {
    const days = new URL(req.url).searchParams.getAll("day").filter(isDay).slice(0, 7);
    if (!days.length) return NextResponse.json({ todos: [] });
    const sql = await db();
    const rows = (await sql`SELECT id, day, text, done FROM todos WHERE day = ANY(${days}) ORDER BY day, position, created_at`) as TodoRow[];
    return NextResponse.json({ todos: rows });
  });
}

/** 하나 또는 여러 개 추가 { day, items: [{id, text, done?}] } */
export async function POST(req: Request) {
  return guarded(async () => {
    const body = (await req.json()) as { day?: string; items?: { id?: string; text?: string; done?: boolean }[] };
    if (!isDay(body.day)) return NextResponse.json({ error: "날짜가 이상해요" }, { status: 400 });
    const sql = await db();
    const [{ n }] = (await sql`SELECT count(*)::int AS n FROM todos WHERE day = ${body.day}`) as { n: number }[];
    const items = (body.items ?? [])
      .filter((i) => typeof i.id === "string" && typeof i.text === "string" && i.text.trim())
      .slice(0, Math.max(0, MAX - n));
    let pos = n;
    for (const i of items) {
      await sql`INSERT INTO todos (id, day, text, done, position, created_at)
        VALUES (${i.id!}, ${body.day}, ${i.text!.trim().slice(0, 80)}, ${!!i.done}, ${pos++}, ${Date.now()})
        ON CONFLICT (id) DO NOTHING`;
    }
    return NextResponse.json({ added: items.length });
  });
}
