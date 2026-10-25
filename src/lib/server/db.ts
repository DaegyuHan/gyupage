import { neon } from "@neondatabase/serverless";

/**
 * Neon(Postgres) 연결. DATABASE_URL 은 .env.local / Vercel 환경 변수에.
 * 표는 처음 쓸 때 자동으로 만들어요 (따로 마이그레이션 안 해도 됨).
 */
export class NoDatabaseError extends Error {}

let client: ReturnType<typeof neon> | null = null;
let ready: Promise<void> | null = null;

export function hasDb() {
  return !!process.env.DATABASE_URL;
}

async function ensureSchema(sql: ReturnType<typeof neon>) {
  await sql`CREATE TABLE IF NOT EXISTS events (
    id text PRIMARY KEY,
    title text NOT NULL,
    category text NOT NULL,
    start_date text NOT NULL,
    end_date text NOT NULL,
    time text,
    memo text,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS events_range ON events (start_date, end_date)`;
  await sql`CREATE TABLE IF NOT EXISTS todos (
    id text PRIMARY KEY,
    day text NOT NULL,
    text text NOT NULL,
    done boolean NOT NULL DEFAULT false,
    position int NOT NULL DEFAULT 0,
    created_at bigint NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS todos_day ON todos (day)`;
  await sql`CREATE TABLE IF NOT EXISTS prefs (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at bigint NOT NULL
  )`;
}

/** 표가 준비된 sql 함수 */
export async function db() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new NoDatabaseError("DATABASE_URL 이 없어요");
  client ??= neon(url);
  ready ??= ensureSchema(client).catch((e) => {
    ready = null; // 다음 요청 때 다시 시도
    throw e;
  });
  await ready;
  return client;
}
