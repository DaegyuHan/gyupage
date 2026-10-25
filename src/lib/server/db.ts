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
  // 서버가 깨어날 때마다 표 만들기를 10번 가까이 돌리지 않도록, 표가 다 있으면 쿼리 1번으로 끝
  const [check] = (await sql`SELECT
    to_regclass('public.events') IS NOT NULL
    AND to_regclass('public.todos') IS NOT NULL
    AND to_regclass('public.prefs') IS NOT NULL
    AND to_regclass('public.books') IS NOT NULL
    AND to_regclass('public.reading_logs') IS NOT NULL
    AND to_regclass('public.history_docs') IS NOT NULL
    AND to_regclass('public.api_usage') IS NOT NULL
    AND to_regclass('public.notify_log') IS NOT NULL
    AND to_regclass('public.push_subs') IS NOT NULL
    AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'history_docs' AND column_name = 'kind') AS ok`) as { ok: boolean }[];
  if (check?.ok) return;

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
  await sql`CREATE TABLE IF NOT EXISTS books (
    id text PRIMARY KEY,
    title text NOT NULL,
    cover text,
    total_pages int NOT NULL,
    current_page int NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'reading',
    started_at bigint,
    finished_at bigint,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS reading_logs (
    id text PRIMARY KEY,
    book_id text NOT NULL REFERENCES books(id) ON DELETE CASCADE,
    day text NOT NULL,
    from_page int NOT NULL,
    to_page int NOT NULL,
    created_at bigint NOT NULL
  )`;
  await sql`CREATE INDEX IF NOT EXISTS reading_logs_day ON reading_logs (day)`;
  await sql`CREATE TABLE IF NOT EXISTS history_docs (
    slug text PRIMARY KEY,
    filename text NOT NULL,
    raw text NOT NULL,
    created_at bigint NOT NULL,
    updated_at bigint NOT NULL
  )`;
  // 회사 / 기타 구분 (나중에 추가된 칸)
  await sql`ALTER TABLE history_docs ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'company'`;
  // 외부 API 사용량 (하루·출처별) — 디스코드 리포트용
  await sql`CREATE TABLE IF NOT EXISTS api_usage (
    day text NOT NULL,
    source text NOT NULL,
    calls int NOT NULL DEFAULT 0,
    errors int NOT NULL DEFAULT 0,
    last_status int,
    last_error text,
    last_error_at bigint,
    last_ok_at bigint,
    remaining int,
    quota int,
    updated_at bigint NOT NULL,
    PRIMARY KEY (day, source)
  )`;
  // 같은 알림을 여러 번 보내지 않도록 (키 → 마지막으로 보낸 시각)
  await sql`CREATE TABLE IF NOT EXISTS notify_log (
    key text PRIMARY KEY,
    at bigint NOT NULL
  )`;
  // 웹 푸시 구독 (기기마다 하나)
  await sql`CREATE TABLE IF NOT EXISTS push_subs (
    endpoint text PRIMARY KEY,
    p256dh text NOT NULL,
    auth text NOT NULL,
    device text,
    created_at bigint NOT NULL
  )`;
  await sql`CREATE TABLE IF NOT EXISTS prefs (
    key text PRIMARY KEY,
    value jsonb NOT NULL,
    updated_at bigint NOT NULL
  )`;
}

/** 표가 준비된 sql 함수 */
export async function db() {
  // Vercel 화면에 따옴표째 붙여 넣은 경우도 받아 줌
  const url = process.env.DATABASE_URL?.trim().replace(/^["']|["']$/g, "");
  if (!url) throw new NoDatabaseError("DATABASE_URL 이 없어요");
  client ??= neon(url);
  ready ??= ensureSchema(client).catch((e) => {
    ready = null; // 다음 요청 때 다시 시도
    throw e;
  });
  await ready;
  return client;
}
