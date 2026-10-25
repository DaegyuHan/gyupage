"use client";

import Link from "next/link";
import { layoutWeek } from "@/components/calendar/MonthGrid";
import { CATEGORY_MAP } from "@/lib/categories";
import { fromKey, toKey, WEEKDAYS } from "@/lib/date";
import type { HomeMatch } from "@/lib/home/matches";
import type { CalendarEvent } from "@/lib/types";
import type { WeatherDay } from "@/lib/weather";
import WeatherIcon, { weatherLabel } from "@/components/weather/WeatherIcon";

interface Props {
  events: CalendarEvent[];
  /** 오늘 (YYYY-MM-DD) */
  start: string;
  onAdd: (key: string) => void;
  onOpen: (ev: CalendarEvent) => void;
  /** 날짜별 날씨 (없으면 표시 안 함) */
  weather?: Map<string, WeatherDay>;
  /** 머리 오른쪽에 넣을 것 (지금 날씨·위치) */
  headerExtra?: React.ReactNode;
  /** 응원 팀 경기 (홈에서만) */
  matches?: HomeMatch[];
  /** 일정을 아직 불러오는 중 */
  loading?: boolean;
}

/** 칸 머리에 들어가는 날씨 한 줄 */
function DayWeather({ w, compact = false }: { w?: WeatherDay; compact?: boolean }) {
  if (!w) return <div className={compact ? "h-4" : "h-[22px]"} />;
  return (
    <div className="flex items-center gap-1" title={`${weatherLabel(w.code)}, 최고 ${w.max}° 최저 ${w.min}°, 강수 확률 ${w.rain}%`}>
      <WeatherIcon code={w.code} size={compact ? 16 : 20} />
      <span className={`numeral font-semibold tabular-nums ${compact ? "text-[11px]" : "text-[13px]"}`}>{w.max}°</span>
      <span className={`numeral tabular-nums text-ink-3 ${compact ? "text-[11px]" : "text-[13px]"}`}>{w.min}°</span>
      {w.rain >= 30 && (
        <span className={`numeral ml-0.5 font-semibold tabular-nums text-[#3b82f6] ${compact ? "text-[10px]" : "text-[11px]"}`}>{w.rain}%</span>
      )}
    </div>
  );
}

const BAR_H = 24;
const MAX_LANES = 3;

/** 개발일지 체크박스 진행률: "2/5" */
function taskProgress(memo?: string) {
  if (!memo) return null;
  const all = memo.match(/^\s*(?:[-*+]|\d+[.)])\s+\[[ xX]\]/gm)?.length ?? 0;
  if (!all) return null;
  const done = memo.match(/^\s*(?:[-*+]|\d+[.)])\s+\[[xX]\]/gm)?.length ?? 0;
  return { done, all };
}

function EventLine({ ev, onOpen }: { ev: CalendarEvent; onOpen: (ev: CalendarEvent) => void }) {
  const c = CATEGORY_MAP[ev.category];
  const prog = ev.category === "devlog" ? taskProgress(ev.memo) : null;
  return (
    <button
      onClick={() => onOpen(ev)}
      className="group block w-full rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-sunken/70"
      title={ev.title}
    >
      <span className="flex items-center gap-1.5 text-[11px] text-ink-3">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
        <span style={{ color: c.color }} className="font-semibold">
          {c.label}
        </span>
        {ev.time && <span className="tabular-nums">{ev.time}</span>}
      </span>
      <span className={`mt-0.5 line-clamp-2 text-[13px] font-medium leading-snug ${ev.done ? "text-ink-3 line-through" : ""}`}>
        {ev.done && "✓ "}
        {ev.title}
      </span>
      {prog && (
        <span className="mt-1 flex items-center gap-1.5">
          <span className="h-1 flex-1 overflow-hidden rounded-full bg-sunken">
            <span className="block h-full rounded-full" style={{ width: `${(prog.done / prog.all) * 100}%`, background: c.color }} />
          </span>
          <span className="numeral text-[10px] font-semibold text-ink-3">
            {prog.done}/{prog.all}
          </span>
        </span>
      )}
    </button>
  );
}

const RESULT = { W: { label: "승", color: "#0e8a6b" }, D: { label: "무", color: "#8a94a6" }, L: { label: "패", color: "#d64545" } };

function BallIcon() {
  return (
    <svg viewBox="0 0 16 16" className="h-3 w-3 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden>
      <circle cx="8" cy="8" r="6.3" />
      <path d="M8 5.2l2.6 1.9-1 3H6.4l-1-3z" fill="currentColor" stroke="none" />
      <path d="M8 1.7v3.5M10.6 7.1l3.2-1.1M9.6 10.1l2 2.8M6.4 10.1l-2 2.8M5.4 7.1L2.2 6" />
    </svg>
  );
}

/** 응원 팀 경기 — 일정보다 눈에 덜 띄게 작은 한 줄 (대회·홈/원정은 마우스를 올리면) */
function MatchLine({ m }: { m: HomeMatch }) {
  const r = m.result ? RESULT[m.result] : null;
  return (
    <div
      className="flex min-w-0 items-center gap-1 px-2 py-[3px] text-[11px] leading-tight text-ink-2"
      title={`${m.competition} · ${m.team} vs ${m.opponent}${m.home === undefined ? "" : m.home ? " (홈)" : " (원정)"}${m.score ? ` · ${m.score}` : ""}`}
    >
      <span className="shrink-0" style={{ color: m.color }}>
        <BallIcon />
      </span>
      {m.state === "live" ? (
        <span className="shrink-0 font-bold text-[#d4483b]">LIVE</span>
      ) : (
        <span className="shrink-0 tabular-nums text-ink-3">{m.time}</span>
      )}
      <span className="min-w-0 truncate">
        <span className="font-semibold" style={{ color: m.color }}>
          {m.team === "바이에른 뮌헨" ? "뮌헨" : m.team}
        </span>{" "}
        <span className="text-ink-3">vs</span> {m.opponent}
      </span>
      {m.score && (
        <span className="ml-auto shrink-0 font-bold tabular-nums" style={r ? { color: r.color } : undefined}>
          {m.score}
        </span>
      )}
    </div>
  );
}

export default function WeekBoard({ events, start, onAdd, onOpen, weather, headerExtra, matches = [], loading = false }: Props) {
  const base = fromKey(start);
  const days = Array.from({ length: 7 }, (_, i) => new Date(base.getFullYear(), base.getMonth(), base.getDate() + i));
  const keys = days.map(toKey);
  const end = keys[6];

  const inWeek = events.filter((e) => e.start <= end && e.end >= start);
  const multi = inWeek.filter((e) => e.start !== e.end);
  const single = inWeek.filter((e) => e.start === e.end);
  const segs = layoutWeek(keys, multi);
  const lanes = Math.min(MAX_LANES, segs.reduce((m, s) => Math.max(m, s.lane + 1), 0));
  const total = inWeek.length;

  const dayLabel = (d: Date, i: number) => (i === 0 ? "오늘" : i === 1 ? "내일" : `${WEEKDAYS[d.getDay()]}요일`);
  const matchesOf = (key: string) => matches.filter((m) => m.date === key);
  const singlesOf = (key: string) =>
    single.filter((e) => e.start === key).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight">일정</h2>
          <p className="mt-0.5 text-sm text-ink-2">
            {base.getMonth() + 1}월 {base.getDate()}일 – {days[6].getMonth() + 1}월 {days[6].getDate()}일
            {loading ? ", 일정 불러오는 중…" : total > 0 ? `, 일정 ${total}개` : ", 아직 잡힌 일정이 없어요"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end">
          {headerExtra}
          <Link href="/calendar" className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium text-ink-2 hover:border-ink-3 hover:text-ink">
            캘린더 열기
          </Link>
        </div>
      </div>

      {/* 넓은 화면: 7칸 주간표 */}
      <div className="relative hidden overflow-hidden rounded-2xl border border-line bg-surface md:block">
        <div className="grid grid-cols-7">
          {days.map((d, i) => {
            const key = keys[i];
            const dow = d.getDay();
            const today = i === 0;
            return (
              <div key={key} className={`group flex min-h-[260px] flex-col ${i < 6 ? "border-r border-line-soft" : ""} ${today ? "bg-accent-soft/40" : ""}`}>
                {/* 날짜 머리 */}
                <div className="flex h-[98px] items-start justify-between px-3 pt-3">
                  <div>
                    <div className={`text-xs font-semibold ${today ? "text-accent" : dow === 0 ? "text-[#d4483b]" : dow === 6 ? "text-accent" : "text-ink-3"}`}>
                      {dayLabel(d, i)}
                    </div>
                    <div className={`numeral text-[28px] font-extrabold leading-none ${dow === 0 && !today ? "text-[#d4483b]" : ""}`}>{d.getDate()}</div>
                    <div className="mt-2">
                      <DayWeather w={weather?.get(key)} />
                    </div>
                  </div>
                  <button
                    onClick={() => onAdd(key)}
                    className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full text-ink-3 touch-visible opacity-0 transition-opacity hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
                    aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일에 일정 추가`}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                      <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </button>
                </div>

                {/* 기간 바 자리 */}
                <div style={{ height: lanes * BAR_H + (lanes ? 6 : 0) }} />

                <div className="flex flex-1 flex-col gap-0.5 px-1 pb-2">
                  {singlesOf(key).map((ev) => (
                    <EventLine key={ev.id} ev={ev} onOpen={onOpen} />
                  ))}
                  {singlesOf(key).length === 0 && (
                    <button
                      onClick={() => onAdd(key)}
                      className="min-h-10 w-full flex-1 rounded-lg text-left text-xs text-transparent hover:text-ink-3"
                      aria-label="일정 추가"
                    >
                      <span className="px-2">+ 추가</span>
                    </button>
                  )}
                  {/* 응원 팀 경기는 칸 맨 아래에 */}
                  {matchesOf(key).length > 0 && (
                    <div className="mt-auto border-t border-dashed border-line-soft pt-1">
                      {matchesOf(key).map((m) => (
                        <MatchLine key={m.id} m={m} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 기간 일정 바 */}
        {segs.length > 0 && (
          <div className="pointer-events-none absolute inset-x-0 grid grid-cols-7" style={{ top: 98, gridAutoRows: BAR_H }}>
            {segs
              .filter((s) => s.lane < MAX_LANES)
              .map((s) => {
                const c = CATEGORY_MAP[s.ev.category];
                return (
                  <button
                    key={s.ev.id}
                    onClick={() => onOpen(s.ev)}
                    title={`${s.ev.title} (${s.ev.start} ~ ${s.ev.end})`}
                    className="pointer-events-auto mb-1 truncate px-2.5 text-left text-[12px] font-semibold leading-5 text-[var(--cat-on)] transition-[filter] hover:brightness-110"
                    style={{
                      gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                      gridRow: s.lane + 1,
                      background: c.color,
                      marginLeft: s.isStart ? 8 : 0,
                      marginRight: s.isEnd ? 8 : 0,
                      borderRadius: `${s.isStart ? 6 : 0}px ${s.isEnd ? 6 : 0}px ${s.isEnd ? 6 : 0}px ${s.isStart ? 6 : 0}px`,
                    }}
                  >
                    {!s.isStart && "… "}
                    {s.ev.title}
                    {s.isEnd && s.ev.end !== start && <span className="ml-1.5 font-normal opacity-80">~{Number(s.ev.end.slice(8))}일</span>}
                  </button>
                );
              })}
          </div>
        )}
      </div>

      {/* 좁은 화면: 날짜별 목록 */}
      <ol className="space-y-1 md:hidden">
        {days.map((d, i) => {
          const key = keys[i];
          const ongoing = multi.filter((e) => e.start <= key && e.end >= key);
          const list = singlesOf(key);
          const today = i === 0;
          return (
            <li key={key} className={`flex gap-4 rounded-2xl px-3 py-3 ${today ? "bg-accent-soft/50" : ""}`}>
              <div className="w-[68px] shrink-0">
                <div className={`text-[11px] font-semibold ${today ? "text-accent" : "text-ink-3"}`}>{dayLabel(d, i)}</div>
                <div className="numeral text-2xl font-extrabold leading-tight">{d.getDate()}</div>
                <DayWeather w={weather?.get(key)} compact />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                {ongoing.map((e) => (
                  <button
                    key={e.id}
                    onClick={() => onOpen(e)}
                    className="block w-full truncate rounded-md px-2 py-1 text-left text-[12px] font-semibold text-[var(--cat-on)]"
                    style={{ background: CATEGORY_MAP[e.category].color }}
                  >
                    {e.title}
                  </button>
                ))}
                {list.map((ev) => (
                  <EventLine key={ev.id} ev={ev} onOpen={onOpen} />
                ))}
                {ongoing.length + list.length === 0 && (
                  <button onClick={() => onAdd(key)} className="py-1.5 text-sm text-ink-3">
                    일정 없음
                  </button>
                )}
                {matchesOf(key).length > 0 && (
                  <div className="border-t border-dashed border-line-soft pt-1">
                    {matchesOf(key).map((m) => (
                      <MatchLine key={m.id} m={m} />
                    ))}
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
