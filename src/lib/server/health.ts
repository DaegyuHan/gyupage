import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import type { HealthDay } from "@/lib/health";
import { db } from "./db";

/**
 * 아이폰 단축어 → 규페이지 건강 기록
 * - 토큰: HEALTH_TOKEN 이 있으면 그걸, 없으면 AUTH_SECRET 으로 만든 고정 값
 * - 단축어가 보내는 값은 "8,240", "8240 걸음", "6.5", 줄바꿈으로 나뉜 여러 값(샘플 목록) 등
 *   모양이 제각각이라 숫자만 꺼내서, 여러 개면 더함
 */
export function healthToken() {
  const own = process.env.HEALTH_TOKEN?.trim().replace(/^["']|["']$/g, "");
  if (own) return own;
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!secret) return null;
  return createHmac("sha256", secret).update("health:v1").digest("base64url").slice(0, 32);
}

export function checkHealthToken(req: Request) {
  const want = healthToken();
  if (!want) return false;
  const url = new URL(req.url);
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim() || url.searchParams.get("token") || "";
  if (!got) return false;
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}

/** "8,240" · "8240 걸음" · ["3000","5240"] · "3000\n5240" → 8240 (없으면 null) */
export function num(v: unknown): number | null {
  if (v == null || v === "") return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (Array.isArray(v)) {
    const xs = v.map(num).filter((x): x is number => x != null);
    return xs.length ? xs.reduce((a, b) => a + b, 0) : null;
  }
  const s = String(v).replace(/(\d),(?=\d{3}\b)/g, "$1");
  const parts = s.match(/-?\d+(?:\.\d+)?/g);
  if (!parts) return null;
  // 줄마다 값이 하나씩이면(샘플 목록) 다 더함, 한 줄이면 첫 숫자
  const lines = s.split(/\r?\n/).filter((l) => /\d/.test(l));
  const xs = lines.length > 1 ? lines.map((l) => Number(l.match(/-?\d+(?:\.\d+)?/)![0])) : [Number(parts[0])];
  const total = xs.reduce((a, b) => a + b, 0);
  return Number.isFinite(total) ? total : null;
}

/** 수면: 분(sleepMinutes) · 시간(sleepHours) · "6시간 40분" · 초(sleepSeconds) 어느 것이든 */
export function sleepMinutes(body: Record<string, unknown>): number | null {
  const raw = body.sleepMinutes ?? body.sleep_min ?? body.sleep;
  // "1:30:00" / "6:40" 같은 지속 시간(줄마다 하나씩이면 더함)
  if (typeof raw === "string" && /\d+:\d{2}/.test(raw)) {
    let total = 0;
    for (const m of raw.matchAll(/(\d+):(\d{2})(?::(\d{2}))?/g)) total += Number(m[1]) * 60 + Number(m[2]) + Number(m[3] ?? 0) / 60;
    if (total > 0) return Math.round(total);
  }
  if (typeof raw === "string" && /시간|분|h|m/i.test(raw) && !/\n/.test(raw)) {
    const h = Number(raw.match(/(\d+(?:\.\d+)?)\s*(?:시간|h)/i)?.[1] ?? 0);
    const m = Number(raw.match(/(\d+)\s*(?:분|m(?!s))/i)?.[1] ?? 0);
    if (h || m) return Math.round(h * 60 + m);
  }
  const min = num(raw);
  // 하루(1440분)보다 크면 초 단위, 20보다 작으면 시간 단위로 온 것 (20분 밤잠은 없다고 봄)
  if (min != null) return Math.round(min > 1440 ? min / 60 : min > 0 && min < 20 ? min * 60 : min);
  const hours = num(body.sleepHours);
  if (hours != null) return Math.round(hours * 60);
  const sec = num(body.sleepSeconds);
  if (sec != null) return Math.round(sec / 60);
  return null;
}

const kstToday = () => new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);

export function parseHealth(body: Record<string, unknown>): HealthDay {
  const day = typeof body.day === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.day.trim()) ? body.day.trim() : kstToday();
  const round = (v: number | null, max: number) => (v == null || v < 0 || v > max ? null : Math.round(v));
  const dist = num(body.distanceKm ?? body.distance);
  return {
    day,
    steps: round(num(body.steps), 200_000),
    sleepMin: (() => {
      const m = sleepMinutes(body);
      return m == null || m < 0 || m > 24 * 60 ? null : m;
    })(),
    activeKcal: round(num(body.activeKcal ?? body.activeEnergy ?? body.kcal), 20_000),
    exerciseMin: round(num(body.exerciseMinutes ?? body.exercise), 24 * 60),
    distanceKm: dist == null || dist < 0 || dist > 500 ? null : Math.round(dist * 100) / 100,
  };
}

/** 받은 칸만 덮어씀 (안 보낸 값은 그대로) */
export async function saveHealth(h: HealthDay) {
  const sql = await db();
  await sql`INSERT INTO health_daily (day, steps, sleep_min, active_kcal, exercise_min, distance_km, updated_at)
    VALUES (${h.day}, ${h.steps}, ${h.sleepMin}, ${h.activeKcal}, ${h.exerciseMin}, ${h.distanceKm}, ${Date.now()})
    ON CONFLICT (day) DO UPDATE SET
      steps = COALESCE(EXCLUDED.steps, health_daily.steps),
      sleep_min = COALESCE(EXCLUDED.sleep_min, health_daily.sleep_min),
      active_kcal = COALESCE(EXCLUDED.active_kcal, health_daily.active_kcal),
      exercise_min = COALESCE(EXCLUDED.exercise_min, health_daily.exercise_min),
      distance_km = COALESCE(EXCLUDED.distance_km, health_daily.distance_km),
      updated_at = EXCLUDED.updated_at`;
}

export async function recentHealth(days: number): Promise<{ list: HealthDay[]; updatedAt: number | null }> {
  const sql = await db();
  const from = new Date(Date.now() + 9 * 3600_000 - (days - 1) * 86400_000).toISOString().slice(0, 10);
  const rows = (await sql`SELECT * FROM health_daily WHERE day >= ${from} ORDER BY day`) as Record<string, unknown>[];
  const n = (v: unknown) => (v == null ? null : Number(v));
  return {
    list: rows.map((r) => ({
      day: String(r.day),
      steps: n(r.steps),
      sleepMin: n(r.sleep_min),
      activeKcal: n(r.active_kcal),
      exerciseMin: n(r.exercise_min),
      distanceKm: n(r.distance_km),
    })),
    updatedAt: rows.length ? Math.max(...rows.map((r) => Number(r.updated_at))) : null,
  };
}
