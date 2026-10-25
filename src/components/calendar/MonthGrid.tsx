"use client";

import { CATEGORY_MAP } from "@/lib/categories";
import { monthGrid, toKey, todayKey, WEEKDAYS } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

interface Props {
  year: number;
  month: number;
  events: CalendarEvent[];
  selected: string;
  onSelect: (key: string) => void;
  onAdd: (key: string) => void;
  onEventClick: (ev: CalendarEvent) => void;
}

const MAX_BAR_LANES = 3;
const MAX_SINGLE = 3;
const BAR_H = 22; // px, 기간 바 한 줄 높이(간격 포함)

export interface Segment {
  ev: CalendarEvent;
  startCol: number;
  endCol: number;
  /** 이 주에서 실제 시작 / 끝인지 (둥근 모서리용) */
  isStart: boolean;
  isEnd: boolean;
  lane: number;
}

/** 한 주에 걸친 기간 일정들을 겹치지 않게 줄(lane)에 배치 */
export function layoutWeek(weekKeys: string[], multi: CalendarEvent[]): Segment[] {
  const first = weekKeys[0];
  const last = weekKeys[6];
  const segs = multi
    .filter((e) => e.start <= last && e.end >= first)
    .sort((a, b) => a.start.localeCompare(b.start) || b.end.localeCompare(a.end))
    .map((ev) => ({
      ev,
      startCol: Math.max(0, weekKeys.findIndex((k) => k >= ev.start)),
      endCol: (() => {
        let c = 6;
        while (c > 0 && weekKeys[c] > ev.end) c--;
        return c;
      })(),
      isStart: ev.start >= first,
      isEnd: ev.end <= last,
      lane: 0,
    }));

  const laneEnds: number[] = [];
  for (const s of segs) {
    let lane = laneEnds.findIndex((end) => end < s.startCol);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(s.endCol);
    } else laneEnds[lane] = s.endCol;
    s.lane = lane;
  }
  return segs;
}

export default function MonthGrid({ year, month, events, selected, onSelect, onAdd, onEventClick }: Props) {
  const days = monthGrid(year, month);
  const today = todayKey();
  const multi = events.filter((e) => e.start !== e.end);
  const single = events.filter((e) => e.start === e.end);

  const weeks = Array.from({ length: 6 }, (_, w) => days.slice(w * 7, w * 7 + 7));

  return (
    <div className="-mx-4 overflow-hidden border-y border-line bg-surface sm:mx-0 sm:rounded-2xl sm:border-x">
      <div className="grid grid-cols-7 border-b border-line">
        {WEEKDAYS.map((w, i) => (
          <div
            key={w}
            className={`py-2.5 text-center text-xs font-semibold sm:px-3 sm:text-left ${i === 0 ? "text-[#d4483b]" : i === 6 ? "text-accent" : "text-ink-3"}`}
          >
            {w}
          </div>
        ))}
      </div>

      {weeks.map((week, wi) => {
        const keys = week.map(toKey);
        const segs = layoutWeek(keys, multi);
        const visibleSegs = segs.filter((s) => s.lane < MAX_BAR_LANES);
        const lanes = Math.min(MAX_BAR_LANES, segs.reduce((m, s) => Math.max(m, s.lane + 1), 0));

        return (
          <div key={keys[0]} className={`relative grid grid-cols-7 ${wi < 5 ? "border-b border-line-soft" : ""}`}>
            {/* 날짜 칸 */}
            {week.map((d, i) => {
              const key = keys[i];
              const inMonth = d.getMonth() === month;
              const isSelected = key === selected;
              const isToday = key === today;
              const daySingles = single
                .filter((e) => e.start === key)
                .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
              const hiddenBars = segs.filter((s) => s.lane >= MAX_BAR_LANES && s.startCol <= i && s.endCol >= i).length;
              const more = Math.max(0, daySingles.length - MAX_SINGLE) + hiddenBars;
              const dow = d.getDay();

              return (
                <div
                  key={key}
                  onClick={() => onSelect(key)}
                  onDoubleClick={() => onAdd(key)}
                  className={`group relative min-h-[96px] cursor-pointer px-0.5 pb-1.5 pt-1.5 transition-colors sm:min-h-[118px] sm:px-1.5 sm:pb-2 ${
                    i < 6 ? "border-r border-line-soft" : ""
                  } ${isSelected ? "bg-accent-soft/60" : "hover:bg-paper/70"}`}
                >
                  <div className="relative flex h-7 items-center justify-center px-1 sm:justify-between">
                    <span
                      className={`numeral flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold sm:h-7 sm:min-w-7 sm:px-1.5 sm:text-[15px] ${
                        isToday
                          ? "bg-accent text-on-accent"
                          : !inMonth
                            ? "text-ink-3/60"
                            : dow === 0
                              ? "text-[#d4483b]"
                              : dow === 6
                                ? "text-accent"
                                : "text-ink"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onAdd(key);
                      }}
                      // 휴대폰: 칸을 한 번 눌러 고른 날에만 + 가 보임 / 넓은 화면: 마우스를 올리면 보임
                      className={`${isSelected ? "flex touch-visible" : "hidden sm:flex"} absolute right-0 top-0.5 h-6 w-6 items-center justify-center rounded-full bg-surface/80 text-ink-3 opacity-0 transition-opacity hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100 sm:static sm:bg-transparent`}
                      aria-label={`${d.getMonth() + 1}월 ${d.getDate()}일에 일정 추가`}
                    >
                      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden>
                        <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>

                  {/* 기간 바 자리 비우기 */}
                  <div style={{ height: lanes * BAR_H + (lanes ? 2 : 0) }} />

                  <div className={`space-y-0.5 ${inMonth ? "" : "opacity-50"}`}>
                    {daySingles.slice(0, MAX_SINGLE).map((ev) => {
                      const c = CATEGORY_MAP[ev.category];
                      return (
                        <button
                          key={ev.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onEventClick(ev);
                          }}
                          className="flex w-full items-center gap-1 truncate rounded-md px-1 py-[3px] text-left text-[10.5px] leading-tight hover:bg-sunken sm:gap-1.5 sm:px-1.5 sm:text-[12px]"
                          title={ev.title}
                        >
                          <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: c.color }} />
                          {ev.time && <span className="hidden shrink-0 tabular-nums text-ink-3 sm:inline">{ev.time}</span>}
                          <span className={`truncate ${ev.done ? "line-through opacity-60" : ""}`}>{ev.title}</span>
                        </button>
                      );
                    })}
                    {more > 0 && <div className="px-1 text-[10px] font-medium text-ink-3 sm:px-1.5 sm:text-[11px]">+{more}개</div>}
                  </div>
                </div>
              );
            })}

            {/* 기간 일정 바 (주 단위로 이어서 그림) */}
            {visibleSegs.length > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 grid grid-cols-7"
                style={{ top: 38, gridAutoRows: BAR_H }}
              >
                {visibleSegs.map((s) => {
                  const c = CATEGORY_MAP[s.ev.category];
                  return (
                    <button
                      key={s.ev.id}
                      onClick={() => onEventClick(s.ev)}
                      title={`${s.ev.title} (${s.ev.start} ~ ${s.ev.end})`}
                      className="pointer-events-auto mb-[3px] truncate px-1.5 text-left text-[10.5px] font-semibold leading-[19px] sm:px-2 sm:text-[12px] text-[var(--cat-on)] transition-[filter] hover:brightness-110"
                      style={{
                        gridColumn: `${s.startCol + 1} / ${s.endCol + 2}`,
                        gridRow: s.lane + 1,
                        background: c.color,
                        marginLeft: s.isStart ? 6 : 0,
                        marginRight: s.isEnd ? 6 : 0,
                        borderRadius: `${s.isStart ? 6 : 0}px ${s.isEnd ? 6 : 0}px ${s.isEnd ? 6 : 0}px ${s.isStart ? 6 : 0}px`,
                      }}
                    >
                      {s.ev.title}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
