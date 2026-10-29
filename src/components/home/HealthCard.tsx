"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import { STEP_GOAL, type HealthDay } from "@/lib/health";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const kst = (offsetDays = 0) => new Date(Date.now() + 9 * 3600_000 - offsetDays * 86400_000).toISOString().slice(0, 10);

function sleepText(min: number | null) {
  if (min == null) return "–";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}시간${m ? ` ${m}분` : ""}` : `${m}분`;
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

function Stat({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-sunken/60 px-2.5 py-1.5">
      <div className="text-[10.5px] font-semibold text-ink-3">{label}</div>
      <div className="numeral truncate text-[14px] font-extrabold tabular-nums">
        {value}
        {unit && <span className="ml-0.5 text-[11px] font-semibold text-ink-3">{unit}</span>}
      </div>
    </div>
  );
}

function Head({ updatedAt }: { updatedAt?: number | null }) {
  return (
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 className="text-2xl font-extrabold tracking-tight">건강</h2>
      <span className="flex gap-3 text-xs font-semibold text-ink-3">
        {updatedAt ? <span className="font-medium">아이폰 건강 · {ago(updatedAt)}</span> : null}
        <Link href="/settings#health" className="hover:text-accent">
          연결 설정
        </Link>
      </span>
    </div>
  );
}

/** 홈 (독서 아래): 아이폰 건강 앱 — 오늘(최근) 걸음·수면·활동·운동 + 7일 걸음 막대 */
export default function HealthCard() {
  const { authed, loading } = useAuth();
  const [data, setData] = useState<{ list: HealthDay[]; updatedAt: number | null } | null>(null);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    if (!authed) return;
    api<{ list: HealthDay[]; updatedAt: number | null }>("/api/health?days=7")
      .then(setData)
      .catch(() => setData({ list: [], updatedAt: null }));
  }, [authed]);

  if (loading || !authed) return null;
  if (!data)
    return (
      <section>
        <Head />
        <div className="h-[150px] animate-pulse rounded-2xl bg-sunken/70" aria-busy="true" />
      </section>
    );

  if (!data.list.length) {
    return (
      <section>
        <Head />
      <Link
        href="/settings#health"
        className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-3 hover:border-accent hover:text-accent"
      >
        <span className="font-semibold text-ink-2">아이폰 건강 기록을 여기에 띄울 수 있어요</span>
        걸음·수면·운동 · 단축어 연결하기 →
      </Link>
      </section>
    );
  }

  // 지난 7일 칸 (기록 없는 날은 빈칸)
  const byDay = new Map(data.list.map((d) => [d.day, d]));
  const week = Array.from({ length: 7 }, (_, i) => {
    const day = kst(6 - i);
    return byDay.get(day) ?? { day, steps: null, sleepMin: null, activeKcal: null, exerciseMin: null, distanceKm: null };
  });
  const latest = [...data.list].reverse().find((d) => d.steps != null || d.sleepMin != null) ?? data.list.at(-1)!;
  const isToday = latest.day === kst();
  const steps = latest.steps ?? 0;
  const pct = Math.min(100, Math.round((steps / STEP_GOAL) * 100));
  const max = Math.max(STEP_GOAL * 1.25, ...week.map((d) => d.steps ?? 0));
  const withSteps = week.filter((d) => d.steps != null);
  const withSleep = week.filter((d) => d.sleepMin != null);
  const avgSteps = withSteps.length ? Math.round(withSteps.reduce((s, d) => s + d.steps!, 0) / withSteps.length) : null;
  const avgSleep = withSleep.length ? Math.round(withSleep.reduce((s, d) => s + d.sleepMin!, 0) / withSleep.length) : null;
  const h = hover != null ? week[hover] : null;

  return (
    <section>
      <Head updatedAt={data.updatedAt} />
      <div className="grid gap-x-8 gap-y-5 rounded-2xl border border-line bg-surface p-5 md:grid-cols-2">
        {/* 왼쪽: 오늘 */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-bold text-ink-2">
            <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden className="text-[#ff375f]">
              <path fill="currentColor" d="M12 21s-7.5-4.6-9.6-9.2C.9 8.4 3 4.5 6.7 4.5c2.1 0 3.6 1.1 4.3 2.4.7-1.3 2.2-2.4 4.3-2.4 3.7 0 5.8 3.9 4.3 7.3C19.5 16.4 12 21 12 21Z" />
            </svg>
            {isToday ? "오늘" : `${Number(latest.day.slice(5, 7))}월 ${Number(latest.day.slice(8))}일`}
          </div>
          <div className="mt-1.5 flex items-baseline gap-1.5">
            <span className="numeral text-[34px] font-extrabold leading-none tabular-nums">{latest.steps != null ? steps.toLocaleString("ko-KR") : "–"}</span>
            <span className="text-xs text-ink-3">걸음 / {STEP_GOAL.toLocaleString("ko-KR")}</span>
            {pct >= 100 && <span className="ml-auto text-xs font-bold text-[#0e8a6b]">목표 달성 🎉</span>}
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-sunken" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="걸음 목표">
            <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2">
            <Stat label="수면" value={sleepText(latest.sleepMin)} />
            <Stat label="활동" value={latest.activeKcal != null ? String(latest.activeKcal) : "–"} unit={latest.activeKcal != null ? "kcal" : undefined} />
            <Stat label="운동" value={latest.exerciseMin != null ? String(latest.exerciseMin) : "–"} unit={latest.exerciseMin != null ? "분" : undefined} />
          </div>
        </div>

        {/* 오른쪽: 최근 7일 걸음 */}
        <div className="flex min-w-0 flex-col">
          <div className="mb-1.5 flex h-4 items-center justify-between text-[11px] text-ink-3">
            <span className="font-bold text-ink-2">최근 7일 걸음</span>
            {h ? (
              <span className="font-semibold text-ink-2">
                {Number(h.day.slice(5, 7))}/{Number(h.day.slice(8))} · {h.steps != null ? `${h.steps.toLocaleString("ko-KR")}걸음` : "기록 없음"}
                {h.sleepMin != null && ` · 수면 ${sleepText(h.sleepMin)}`}
              </span>
            ) : (
              <span>
                {avgSteps != null && `평균 ${avgSteps.toLocaleString("ko-KR")}걸음`}
                {avgSleep != null && ` · 수면 ${sleepText(avgSleep)}`}
              </span>
            )}
          </div>
          <div className="relative min-h-[96px] flex-1" onMouseLeave={() => setHover(null)}>
            <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-3/50" style={{ bottom: `${(STEP_GOAL / max) * 100}%` }} />
            <div className="absolute inset-0 flex items-end gap-1.5">
              {week.map((d, i) => {
                const v = d.steps ?? 0;
                const today = d.day === kst();
                return (
                  <button
                    key={d.day}
                    type="button"
                    onMouseEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onClick={() => setHover(i)}
                    className="flex h-full flex-1 items-end"
                    aria-label={`${d.day} ${d.steps ?? "기록 없음"}걸음`}
                  >
                    <span
                      className={`block w-full rounded-t-[4px] transition-colors ${
                        d.steps == null ? "bg-transparent" : today || hover === i ? "bg-accent" : v >= STEP_GOAL ? "bg-accent/70" : "bg-accent/35"
                      }`}
                      style={{ height: d.steps == null ? 0 : `${Math.max(4, (v / max) * 100)}%` }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
          <div className="mt-1 flex gap-1.5 text-center text-[10.5px] text-ink-3">
            {week.map((d) => (
              <span key={d.day} className={`flex-1 ${d.day === kst() ? "font-bold text-accent" : ""}`}>
                {WEEK[new Date(`${d.day}T00:00:00Z`).getUTCDay()]}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
