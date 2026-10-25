"use client";

import { CATEGORY_MAP } from "@/lib/categories";
import { fromKey, inRange, todayKey, WEEKDAYS } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

interface Props {
  events: CalendarEvent[];
  onOpen: (ev: CalendarEvent) => void;
  /** 요일 아래에 넣을 것 (홈: 오늘 꼭 할 일) */
  children?: React.ReactNode;
}

const DAY = 86_400_000;

function projectProgress(p: CalendarEvent, today: string) {
  const s = fromKey(p.start).getTime();
  const e = fromKey(p.end).getTime();
  const t = fromKey(today).getTime();
  const total = Math.max(1, (e - s) / DAY + 1);
  const done = Math.min(total, Math.max(0, (t - s) / DAY + 1));
  const left = Math.round((e - t) / DAY);
  return { ratio: done / total, left, started: t >= s };
}

export default function TodayHero({ events, onOpen, children }: Props) {
  const today = todayKey();
  const d = fromKey(today);
  const todays = events
    .filter((e) => inRange(today, e.start, e.end) && e.category !== "project")
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const projects = events
    .filter((e) => e.category === "project" && e.end >= today)
    .sort((a, b) => a.end.localeCompare(b.end));

  return (
    <section className="grid gap-8 border-b border-line pb-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
      {/* 오늘 */}
      <div className="flex items-start gap-6 sm:gap-8">
        <div className="numeral select-none text-[112px] font-extrabold leading-[0.78] text-ink sm:text-[168px]">
          {d.getDate()}
        </div>
        <div className="min-w-0 flex-1 pt-1">
          <p className="text-ink-2">
            {d.getFullYear()}년 {d.getMonth() + 1}월
          </p>
          <p className="text-2xl font-bold tracking-tight sm:text-3xl">{WEEKDAYS[d.getDay()]}요일</p>

          {children}

          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {todays.length > 0 ? (
              <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1 text-sm">
                {todays
                  .slice(0, 3)
                  .map((e) => (
                    <li key={e.id}>
                      <button onClick={() => onOpen(e)} className="flex items-center gap-1.5 hover:underline">
                        <span className="h-2 w-2 rounded-full" style={{ background: CATEGORY_MAP[e.category].color }} />
                        {e.time && <span className="text-ink-2 tabular-nums">{e.time}</span>}
                        <span className="truncate">{e.title}</span>
                      </button>
                    </li>
                  ))}
              </ul>
            ) : (
              <span className="text-sm text-ink-3">오늘은 잡힌 약속이 없어요</span>
            )}
          </div>
        </div>
      </div>

      {/* 진행 중 프로젝트 */}
      <div className="self-end">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">진행 중인 프로젝트</h2>
        {projects.length === 0 ? (
          <p className="text-sm text-ink-3">캘린더에 프로젝트 기간을 넣으면 여기서 남은 날짜를 보여줘요.</p>
        ) : (
          <ul className="space-y-3.5">
            {projects.slice(0, 3).map((p) => {
              const { ratio, left, started } = projectProgress(p, today);
              return (
                <li key={p.id}>
                  <button onClick={() => onOpen(p)} className="group block w-full text-left">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold group-hover:underline">{p.title}</span>
                      <span className="numeral shrink-0 text-sm font-semibold text-ink-2">
                        {!started ? "예정" : left === 0 ? "D-DAY" : `D-${left}`}
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.round(ratio * 100)}%`, background: CATEGORY_MAP.project.color }}
                      />
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
