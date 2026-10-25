"use client";

import { useEffect, useMemo, useState } from "react";
import { formatKorean, WEEKDAYS } from "@/lib/date";
import type { ContribDay, GithubSummary } from "@/lib/github";

const GREEN = "#2da44e";
/** 0~4 단계 색 (다크모드에서도 배경에 맞춰 섞임) */
const LEVEL = [
  "var(--color-sunken)",
  `color-mix(in oklab, ${GREEN} 35%, var(--color-sunken))`,
  `color-mix(in oklab, ${GREEN} 58%, var(--color-sunken))`,
  `color-mix(in oklab, ${GREEN} 80%, var(--color-sunken))`,
  GREEN,
];

function ago(iso: string) {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 60) return `${Math.max(min, 1)}분 전`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}시간 전`;
  const d = Math.floor(h / 24);
  if (d < 31) return `${d}일 전`;
  const m = Math.floor(d / 30);
  return m < 12 ? `${m}개월 전` : `${Math.floor(m / 12)}년 전`;
}

function Stat({ value, unit, label, accent }: { value: string | number; unit?: string; label: string; accent?: boolean }) {
  return (
    <div>
      <div className={`numeral text-[26px] font-extrabold leading-none tabular-nums ${accent ? "text-[#2da44e]" : ""}`}>
        {value}
        {unit && <span className="ml-0.5 text-sm font-bold text-ink-3">{unit}</span>}
      </div>
      <div className="mt-1.5 text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

/** 홈: GitHub 잔디 — 최근 5주를 달력처럼 + 연속 기록 + 최근 저장소 */
export default function GithubCard() {
  const [data, setData] = useState<GithubSummary | null>(null);
  const [failed, setFailed] = useState(false);
  const [hover, setHover] = useState<ContribDay | null>(null);

  useEffect(() => {
    fetch("/api/github")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: GithubSummary) => setData(d))
      .catch(() => setFailed(true));
  }, []);

  // 일요일부터 시작하는 5주 (이번 주 남은 날은 빈칸)
  const cells = useMemo(() => {
    if (!data || data.days.length === 0) return [];
    const last = data.days[data.days.length - 1];
    const dow = new Date(`${last.date}T12:00:00+09:00`).getUTCDay();
    const shown = data.days.slice(Math.max(0, data.days.length - 1 - dow - 28));
    return [...shown, ...Array.from({ length: 6 - dow }, () => null)];
  }, [data]);

  const shownDays = cells.filter((c): c is ContribDay => !!c);
  const total = shownDays.reduce((s, d) => s + d.count, 0);
  const active = shownDays.filter((d) => d.count > 0).length;
  const best = shownDays.reduce<ContribDay | null>((b, d) => (d.count > (b?.count ?? 0) ? d : b), null);
  const today = shownDays[shownDays.length - 1]?.date;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          GitHub
          {data && (
            <a
              href={`https://github.com/${data.user}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-semibold tracking-normal text-ink-3 hover:text-accent"
            >
              @{data.user}
            </a>
          )}
        </h2>
        <span className="text-xs text-ink-3">최근 5주 · 30분마다 갱신</span>
      </div>

      {failed && <p className="text-sm text-ink-3">GitHub 기록을 불러오지 못했어요.</p>}
      {!data && !failed && <div className="h-[220px] rounded-2xl bg-sunken/70" aria-busy="true" />}

      {data && (
        <div className="grid gap-x-10 gap-y-6 rounded-2xl border border-line bg-surface p-5 md:grid-cols-[auto_minmax(0,1fr)] lg:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)]">
          {/* 5주 달력 */}
          <div className="justify-self-center md:justify-self-start">
            <div className="grid grid-cols-7 gap-1.5" onMouseLeave={() => setHover(null)}>
              {WEEKDAYS.map((w, i) => (
                <span key={w} className={`pb-0.5 text-center text-[10px] font-semibold ${i === 0 ? "text-[#d64545]/80" : "text-ink-3"}`}>
                  {w}
                </span>
              ))}
              {cells.map((d, i) =>
                d ? (
                  <span
                    key={d.date}
                    onMouseEnter={() => setHover(d)}
                    title={`${formatKorean(d.date)} · ${d.count ? `기여 ${d.count}개` : "기여 없음"}`}
                    className={`relative flex h-[34px] w-[34px] items-start justify-start rounded-lg p-1 text-[9px] font-semibold leading-none tabular-nums transition hover:scale-110 ${
                      d.level >= 3 ? "text-white/85" : "text-ink-3"
                    } ${d.date === today ? "ring-2 ring-ink-2 ring-offset-2 ring-offset-surface" : ""}`}
                    style={{ background: LEVEL[d.level] ?? LEVEL[0] }}
                  >
                    {d.date.endsWith("-01") ? `${Number(d.date.slice(5, 7))}/1` : Number(d.date.slice(8))}
                  </span>
                ) : (
                  <span key={`empty-${i}`} className="h-[34px] w-[34px] rounded-lg border border-dashed border-line-soft" />
                ),
              )}
            </div>
            <div className="mt-3 flex items-center justify-between gap-3 text-[11px] text-ink-3">
              <span className="min-h-4 tabular-nums">
                {hover ? (
                  <>
                    <b className="text-ink-2">{formatKorean(hover.date)}</b> · {hover.count ? `${hover.count}개` : "없음"}
                  </>
                ) : (
                  "칸에 마우스를 올려 보세요"
                )}
              </span>
              <span className="flex shrink-0 items-center gap-0.5">
                {LEVEL.map((c, i) => (
                  <span key={i} className="h-[9px] w-[9px] rounded-[2px]" style={{ background: c }} />
                ))}
              </span>
            </div>
          </div>

          {/* 숫자 */}
          <div className="grid content-center grid-cols-2 gap-x-6 gap-y-6">
            <Stat value={data.streak} unit="일" label={data.streak ? "🔥 연속 기여 중" : "연속 기록 (오늘 커밋하면 1일째)"} accent={data.streak > 0} />
            <Stat value={total} unit="개" label="최근 5주 기여" />
            <Stat value={active} unit={`/${shownDays.length}일`} label="기여한 날" />
            <Stat
              value={best?.count ?? 0}
              unit="개"
              label={best ? `가장 많이 한 날 · ${Number(best.date.slice(5, 7))}월 ${Number(best.date.slice(8))}일` : "가장 많이 한 날"}
            />
          </div>

          {/* 최근 저장소 */}
          <div className="min-w-0 md:col-span-2 lg:col-span-1 lg:border-l lg:border-line-soft lg:pl-8">
            <h3 className="mb-2 text-[11px] font-bold text-ink-2">최근 작업한 저장소</h3>
            {data.repos.length === 0 ? (
              <p className="text-sm text-ink-3">공개 저장소가 없어요.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.repos.map((r) => (
                  <li key={r.name}>
                    <a href={r.url} target="_blank" rel="noopener noreferrer" className="group block py-2.5">
                      <div className="truncate text-[14px] font-bold group-hover:text-accent">{r.name}</div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                        {r.lang && (
                          <>
                            <span className="h-2 w-2 rounded-full" style={{ background: r.color }} />
                            {r.lang}
                            <span>·</span>
                          </>
                        )}
                        {ago(r.pushedAt)} 푸시
                      </div>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
