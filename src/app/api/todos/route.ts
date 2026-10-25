import { NextResponse } from "next/server";
import { guarded, isDay } from "@/lib/server/api";
import { db } from "@/lib/server/db";

export interface TodoRow {
  id: string;
  day: string;
  text: string;
  done: boolean;
}

/** 하루 최대 (홈 화면은 6개까지만 받지만 캘린더에서 더 넣을 수 있게 넉넉히) */
const MAX = 30;

/** ?day=YYYY-MM-DD (여러 날은 ?day=…&day=…) */
export async function GET(req: Request) {
  return guarded(async () => {
    const params = new URL(req.url).searchParams;
    const sql = await db();
    // 캘린더용: 전부 (할일은 많지 않아서 한 번에)
    if (params.get("all") === "1") {
      const rows = (await sql`SELECT id, day, text, done FROM todos ORDER BY day, position, created_at`) as TodoRow[];
      return NextResponse.json({ todos: rows });
    }
    const days = params.getAll("day").filter(isDay).slice(0, 7);
    if (!days.length) return NextResponse.json({ todos: [] });
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
