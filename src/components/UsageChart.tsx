"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";

interface Point {
  key: string;
  calls: number;
  errors: number;
  remaining?: number | null;
}
interface History {
  source: string;
  label: string;
  hours: Point[];
  days: Point[];
  sources: { source: string; label: string; calls: number }[];
}

/** API 별 하루 한도 (기준선) */
const LIMITS: Record<string, number> = { "api-football": 100 };

/** 보기 좋은 눈금 최댓값 (1·2·5 배수) */
function niceMax(v: number) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v)!;
}

function Bars({
  points,
  label,
  tick,
  limit,
  height = 132,
}: {
  points: Point[];
  label: (p: Point) => string;
  /** 아래에 글씨를 쓸 칸이면 그 글씨 */
  tick: (p: Point, i: number) => string | null;
  limit?: number;
  height?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const max = niceMax(Math.max(1, ...points.map((p) => p.calls), limit ?? 0));
  const h = hover != null ? points[hover] : null;

  return (
    <div className="relative select-none">
      {/* 툴팁 */}
      <div className="mb-2 h-5 text-xs text-ink-2" aria-live="polite">
        {h ? (
          <>
            <b className="text-ink">{label(h)}</b> · {h.calls}회
            {h.errors > 0 && <span className="text-[#e5484d]"> · 에러 {h.errors}</span>}
            {h.remaining != null && <span className="text-ink-3"> · 남은 한도 {h.remaining}</span>}
          </>
        ) : (
          <span className="text-ink-3">막대에 올리거나 눌러 보세요</span>
        )}
      </div>

      <div className="flex gap-2">
        {/* y 축 */}
        <div className="relative w-7 shrink-0 text-right text-[10px] tabular-nums text-ink-3" style={{ height }}>
          {[1, 0.5, 0].map((f) => (
            <span key={f} className="absolute right-0 -translate-y-1/2" style={{ top: `${(1 - f) * 100}%` }}>
              {Math.round(max * f)}
            </span>
          ))}
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative" style={{ height }} onMouseLeave={() => setHover(null)}>
            {/* 눈금선 */}
            {[1, 0.5].map((f) => (
              <div key={f} className="absolute inset-x-0 border-t border-line-soft" style={{ top: `${(1 - f) * 100}%` }} />
            ))}
            <div className="absolute inset-x-0 bottom-0 border-t border-line" />
            {/* 하루 한도 기준선 */}
            {limit != null && (
              <div className="pointer-events-none absolute inset-x-0 z-10 border-t border-dashed border-ink-3" style={{ top: `${(1 - limit / max) * 100}%` }}>
                <span className="absolute -top-4 right-0 rounded bg-surface px-1 text-[10px] font-semibold text-ink-2">하루 한도 {limit}</span>
              </div>
            )}
            {/* 막대 */}
            <div className="absolute inset-0 flex items-end gap-[2px]">
              {points.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  onMouseEnter={() => setHover(i)}
                  onFocus={() => setHover(i)}
                  onClick={() => setHover(i)}
                  aria-label={`${label(p)} ${p.calls}회`}
                  className="group relative flex h-full min-w-0 flex-1 items-end"
                >
                  <span
                    className={`block w-full rounded-t-[3px] transition-colors ${hover === i ? "bg-accent" : "bg-accent/70"} ${p.calls === 0 ? "opacity-0" : ""}`}
                    style={{ height: `${(p.calls / max) * 100}%`, minHeight: p.calls ? 2 : 0 }}
                  />
                  {p.errors > 0 && <span className="absolute left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#e5484d]" style={{ bottom: `calc(${(p.calls / max) * 100}% + 3px)` }} />}
                </button>
              ))}
            </div>
          </div>
          {/* x 축 */}
          <div className="relative mt-1.5 h-4 text-[10px] text-ink-3">
            {points.map((p, i) => {
              const t = tick(p, i);
              return t ? (
                <span key={p.key} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${((i + 0.5) / points.length) * 100}%` }}>
                  {t}
                </span>
              ) : null;
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const hourOf = (k: string) => Number(k.slice(11, 13));
const md = (k: string) => `${Number(k.slice(5, 7))}/${Number(k.slice(8, 10))}`;

/** 설정 > API 모니터: 실제 호출 수 그래프 */
export default function UsageChart() {
  const [source, setSource] = useState("api-football");
  const [data, setData] = useState<History | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setErr(null);
    api<History>(`/api/monitor/history?source=${encodeURIComponent(source)}`)
      .then(setData)
      .catch((e) => setErr(String(e).replace(/^Error: /, "")));
  }, [source]);

  const total48 = data?.hours.reduce((s, p) => s + p.calls, 0) ?? 0;
  const today = data?.days.at(-1)?.calls ?? 0;
  const limit = LIMITS[source];
  const sources = data?.sources.length ? data.sources : [{ source: "api-football", label: "API-Football", calls: 0 }];

  return (
    <div className="mt-8">
      <div className="mb-4 flex flex-wrap items-center gap-1.5">
        {sources.map((s) => (
          <button
            key={s.source}
            onClick={() => setSource(s.source)}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
              s.source === source ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:text-ink"
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {err && <p className="text-sm text-[#e5484d]">{err}</p>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-bold">최근 48시간 · 시간별</h3>
            <span className="text-xs text-ink-3">합계 {total48}회</span>
          </div>
          {data ? (
            <Bars
              points={data.hours}
              label={(p) => `${md(p.key)} ${hourOf(p.key)}시`}
              tick={(p) => (hourOf(p.key) === 0 ? md(p.key) : hourOf(p.key) % 6 === 0 ? `${hourOf(p.key)}시` : null)}
            />
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-sunken/70" />
          )}
        </div>

        <div className="rounded-2xl border border-line bg-surface p-5">
          <div className="mb-3 flex items-baseline justify-between gap-3">
            <h3 className="font-bold">최근 14일 · 하루별</h3>
            <span className="text-xs text-ink-3">
              오늘 {today}회{limit ? ` / ${limit}` : ""}
            </span>
          </div>
          {data ? (
            <Bars points={data.days} label={(p) => md(p.key)} tick={(p, i) => (i % 3 === 1 || i === data.days.length - 1 ? md(p.key) : null)} limit={limit} />
          ) : (
            <div className="h-40 animate-pulse rounded-lg bg-sunken/70" />
          )}
        </div>
      </div>
      <p className="mt-3 text-xs text-ink-3">
        사이트가 실제로 외부 API 를 부른 횟수예요 (캐시로 응답한 건 안 셈). 빨간 점은 그 시간에 에러가 있었다는 뜻이에요.
      </p>
    </div>
  );
}
