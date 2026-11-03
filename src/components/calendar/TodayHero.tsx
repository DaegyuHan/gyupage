"use client";

import { CATEGORY_MAP } from "@/lib/categories";
import { fromKey, inRange, todayKey, WEEKDAYS } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";
import { parsePhase } from "@/lib/projectPhases";

interface Props {
  events: CalendarEvent[];
  onOpen: (ev: CalendarEvent) => void;
  /** 일정을 아직 불러오는 중 */
  loading?: boolean;
  /** 요일 아래에 넣을 것 (홈: 오늘 꼭 할 일) */
  children?: React.ReactNode;
}

const DAY = 86_400_000;

interface ProjectGroup {
  name: string;
  start: string;
  end: string;
  /** 단계 일정들 (시작 순) — 단계 없는 프로젝트면 하나 */
  steps: { label?: string; ev: CalendarEvent }[];
}

/** 같은 이름의 단계 일정(개발·SIT·UAT…)을 프로젝트 하나로 묶음 */
function groupProjects(events: CalendarEvent[]): ProjectGroup[] {
  const map = new Map<string, ProjectGroup>();
  for (const e of events) {
    if (e.category !== "project") continue;
    const p = parsePhase(e.title);
    const name = p?.name ?? e.title;
    const g = map.get(name) ?? { name, start: e.start, end: e.end, steps: [] };
    g.start = e.start < g.start ? e.start : g.start;
    g.end = e.end > g.end ? e.end : g.end;
    g.steps.push({ label: p?.phase, ev: e });
    map.set(name, g);
  }
  for (const g of map.values()) g.steps.sort((a, b) => a.ev.start.localeCompare(b.ev.start));
  return [...map.values()];
}

const md = (k: string) => `${Number(k.slice(5, 7))}.${Number(k.slice(8, 10))}`;

function projectProgress(p: { start: string; end: string }, today: string) {
  const s = fromKey(p.start).getTime();
  const e = fromKey(p.end).getTime();
  const t = fromKey(today).getTime();
  const total = Math.max(1, (e - s) / DAY + 1);
  const done = Math.min(total, Math.max(0, (t - s) / DAY + 1));
  const left = Math.round((e - t) / DAY);
  return { ratio: done / total, left, started: t >= s };
}

export default function TodayHero({ events, onOpen, loading = false, children }: Props) {
  const today = todayKey();
  const d = fromKey(today);
  const todays = events
    .filter((e) => inRange(today, e.start, e.end) && e.category !== "project")
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
  const projects = groupProjects(events)
    .filter((g) => g.end >= today)
    .sort((a, b) => a.end.localeCompare(b.end));

  return (
    <section className="grid gap-8 border-b border-line pb-8 pt-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-14">
      {/* 오늘 */}
      {/* 휴대폰: 날짜·요일 한 줄 + 아래에 할 일(가로 꽉 차게) / 넓은 화면: 날짜 옆에 전부 */}
      <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-x-6 sm:gap-x-8">
        <div className="numeral select-none text-[112px] font-extrabold leading-[0.78] text-ink sm:row-span-2 sm:text-[168px]">
          {d.getDate()}
        </div>
        <div className="min-w-0 self-end pb-1 sm:self-start sm:pb-0 sm:pt-1">
          <p className="text-ink-2">
            {d.getFullYear()}년 {d.getMonth() + 1}월
          </p>
          <p className="text-2xl font-bold tracking-tight sm:text-3xl">{WEEKDAYS[d.getDay()]}요일</p>
        </div>
        <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
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
              <span className="text-sm text-ink-3">{loading ? "일정 불러오는 중…" : "오늘은 잡힌 약속이 없어요"}</span>
            )}
          </div>
        </div>
      </div>

      {/* 진행 중 프로젝트 */}
      <div className="self-end">
        <h2 className="mb-3 text-sm font-semibold text-ink-2">진행 중인 프로젝트</h2>
        {loading ? (
          <div className="h-10 rounded-lg bg-sunken/70" aria-busy="true" />
        ) : projects.length === 0 ? (
          <p className="text-sm text-ink-3">캘린더에 프로젝트 기간을 넣으면 여기서 남은 날짜를 보여줘요.</p>
        ) : (
          <ul className="space-y-3.5">
            {projects.slice(0, 3).map((g) => {
              const { ratio } = projectProgress(g, today);
              // 지금 단계 = 오늘이 들어 있는 단계, 없으면 다음에 올 단계
              const cur = g.steps.find((s) => inRange(today, s.ev.start, s.ev.end)) ?? g.steps.find((s) => s.ev.start > today) ?? g.steps[g.steps.length - 1];
              const next = g.steps.find((s) => s.ev.start > today && s !== cur);
              const now = inRange(today, cur.ev.start, cur.ev.end);
              const left = projectProgress(cur.ev, today).left;
              const until = Math.round((fromKey(cur.ev.start).getTime() - fromKey(today).getTime()) / DAY);
              return (
                <li key={g.name}>
                  <button onClick={() => onOpen(cur.ev)} className="group block w-full text-left">
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="truncate font-semibold group-hover:underline">{g.name}</span>
                      <span className="numeral shrink-0 text-sm font-semibold text-ink-2">
                        {cur.label && (
                          <span className="mr-1.5 rounded px-1.5 py-0.5 text-[11px] font-bold" style={{ background: CATEGORY_MAP.project.soft, color: CATEGORY_MAP.project.color }}>
                            {cur.label}
                          </span>
                        )}
                        {now ? (left === 0 ? "D-DAY" : `D-${left}`) : `${until}일 뒤`}
                      </span>
                    </div>
                    <div className="relative h-1.5 overflow-hidden rounded-full bg-sunken">
                      <div className="h-full rounded-full" style={{ width: `${Math.round(ratio * 100)}%`, background: CATEGORY_MAP.project.color }} />
                    </div>
                    {g.steps.length > 1 && (
                      <div className="mt-1 flex justify-between gap-2 text-[11px] text-ink-3">
                        <span className="truncate">{g.steps.map((s) => s.label).filter(Boolean).join(" → ")}</span>
                        {next && (
                          <span className="numeral shrink-0">
                            다음 {next.label} {md(next.ev.start)}
                          </span>
                        )}
                      </div>
                    )}
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
