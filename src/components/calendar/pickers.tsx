"use client";

import { useEffect, useRef, useState } from "react";
import { fromKey, monthGrid, toKey, todayKey, WEEKDAYS } from "@/lib/date";

/* ───────── 공용: 바깥 클릭·Esc 로 닫히는 팝오버 ───────── */

function usePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    // Esc 는 팝오버만 닫고, 작성 패널까지 닫히지 않게 먼저 가로챔
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return { open, setOpen, ref };
}

const triggerCls =
  "inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-sunken aria-expanded:bg-sunken";

const panelCls =
  "anim-pop absolute left-0 top-[calc(100%+6px)] z-20 rounded-2xl border border-line bg-surface p-3 shadow-[0_18px_50px_-12px_rgba(20,28,43,0.35)]";

function label(key: string, withYear = false) {
  const d = fromKey(key);
  const y = withYear ? `${d.getFullYear()}년 ` : "";
  return `${y}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}

function daysBetween(a: string, b: string) {
  return Math.round((fromKey(b).getTime() - fromKey(a).getTime()) / 86_400_000) + 1;
}

/* ───────── 날짜(기간) 선택 ───────── */

interface RangeProps {
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
}

export function DateRangeField({ start, end, onChange }: RangeProps) {
  const { open, setOpen, ref } = usePopover();
  const [view, setView] = useState(() => ({ y: fromKey(start).getFullYear(), m: fromKey(start).getMonth() }));
  // 시작을 고른 뒤 '끝나는 날'을 고르는 중인지
  const [pickingEnd, setPickingEnd] = useState(false);
  const [hover, setHover] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      const d = fromKey(start);
      setView({ y: d.getFullYear(), m: d.getMonth() });
      setPickingEnd(false);
      setHover(null);
    }
    // 열 때만 초기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const today = todayKey();
  const days = monthGrid(view.y, view.m);
  const move = (delta: number) => {
    const d = new Date(view.y, view.m + delta, 1);
    setView({ y: d.getFullYear(), m: d.getMonth() });
  };

  // 끝나는 날 고르는 중이면 마우스 위치까지 미리 보여줌
  const rangeEnd = pickingEnd && hover && hover >= start ? hover : end;

  const pick = (key: string) => {
    if (!pickingEnd) {
      onChange(key, key);
      setPickingEnd(true);
      return;
    }
    if (key < start) {
      onChange(key, key);
      return;
    }
    onChange(start, key);
    setPickingEnd(false);
    setOpen(false);
  };

  const quick = (key: string) => {
    onChange(key, key);
    setOpen(false);
  };

  const n = daysBetween(start, end);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="dialog" className={triggerCls}>
        <svg width="15" height="15" viewBox="0 0 16 16" className="text-ink-3" aria-hidden>
          <rect x="1.75" y="2.75" width="12.5" height="11.5" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M1.75 6.5h12.5M5 1.5v2.5M11 1.5v2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        <span className="tabular-nums">
          {label(start)}
          {end !== start && (
            <>
              <span className="mx-1.5 text-ink-3">–</span>
              {label(end)}
            </>
          )}
        </span>
        {n > 1 && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold text-accent">{n}일</span>}
      </button>

      {open && (
        <div role="dialog" aria-label="날짜 고르기" className={`${panelCls} w-[300px]`}>
          {/* 머리: 월 이동 */}
          <div className="mb-2 flex items-center justify-between px-1">
            <button type="button" onClick={() => move(-1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink" aria-label="이전 달">
              <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
                <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <div className="text-sm font-bold">
              <span className="numeral text-base">{view.m + 1}월</span>
              <span className="numeral ml-1.5 text-ink-3">{view.y}</span>
            </div>
            <button type="button" onClick={() => move(1)} className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink" aria-label="다음 달">
              <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
                <path d="m1.5 1 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>

          {/* 요일 */}
          <div className="grid grid-cols-7 text-center text-[11px] font-semibold text-ink-3">
            {WEEKDAYS.map((w, i) => (
              <div key={w} className={`py-1 ${i === 0 ? "text-[#d4483b]" : ""}`}>
                {w}
              </div>
            ))}
          </div>

          {/* 날짜 */}
          <div className="grid grid-cols-7" onMouseLeave={() => setHover(null)}>
            {days.map((d) => {
              const key = toKey(d);
              const inMonth = d.getMonth() === view.m;
              const isStart = key === start;
              const isEnd = key === rangeEnd;
              const inRange = key > start && key < rangeEnd;
              const edge = isStart || isEnd;
              const ranged = rangeEnd !== start;
              return (
                <div
                  key={key}
                  className="relative flex h-9 items-center justify-center"
                  onMouseEnter={() => setHover(key)}
                >
                  {/* 기간 띠 */}
                  {ranged && (inRange || (isStart && !isEnd) || (isEnd && !isStart)) && (
                    <span
                      className="absolute inset-y-1 bg-accent-soft"
                      style={{ left: isStart ? "50%" : 0, right: isEnd ? "50%" : 0 }}
                      aria-hidden
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => pick(key)}
                    aria-pressed={edge}
                    aria-label={label(key, true)}
                    className={`numeral relative z-[1] flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold transition-colors ${
                      edge
                        ? "bg-accent text-on-accent"
                        : inRange
                          ? "text-accent hover:bg-accent/15"
                          : `hover:bg-sunken ${inMonth ? (d.getDay() === 0 ? "text-[#d4483b]" : "text-ink") : "text-ink-3/50"}`
                    } ${key === today && !edge ? "ring-1 ring-inset ring-accent" : ""}`}
                  >
                    {d.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* 바닥: 안내 + 빠른 선택 */}
          <div className="mt-2 border-t border-line-soft pt-2.5">
            <p className="mb-2 px-1 text-xs text-ink-2">
              {pickingEnd ? "끝나는 날을 고르세요. 하루짜리면 아래 '하루 일정'을 누르세요." : "시작하는 날을 고르세요."}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button type="button" onClick={() => quick(today)} className="rounded-full bg-sunken px-3 py-1 text-xs font-medium hover:text-accent">
                오늘
              </button>
              <button
                type="button"
                onClick={() => {
                  const t = fromKey(today);
                  quick(toKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() + 1)));
                }}
                className="rounded-full bg-sunken px-3 py-1 text-xs font-medium hover:text-accent"
              >
                내일
              </button>
              {pickingEnd && (
                <button
                  type="button"
                  onClick={() => {
                    onChange(start, start);
                    setOpen(false);
                  }}
                  className="ml-auto rounded-full bg-ink px-3 py-1 text-xs font-semibold text-paper"
                >
                  하루 일정
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ───────── 시간 선택 ───────── */

const TIMES = Array.from({ length: 48 }, (_, i) => `${String(Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function timeLabel(t: string) {
  const [h, m] = t.split(":").map(Number);
  const ap = h < 12 ? "오전" : "오후";
  const hh = h % 12 === 0 ? 12 : h % 12;
  return `${ap} ${hh}:${String(m).padStart(2, "0")}`;
}

export function TimeField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { open, setOpen, ref } = usePopover();
  const listRef = useRef<HTMLDivElement>(null);

  // 열면 선택된 시간(없으면 오전 9시) 근처로 스크롤
  useEffect(() => {
    if (!open || !listRef.current) return;
    const target = value || "09:00";
    const el = listRef.current.querySelector<HTMLElement>(`[data-time="${target.slice(0, 3)}${Number(target.slice(3)) >= 30 ? "30" : "00"}"]`);
    if (el) listRef.current.scrollTop = el.offsetTop - 72;
  }, [open, value]);

  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} aria-haspopup="listbox" className={triggerCls}>
        <svg width="15" height="15" viewBox="0 0 16 16" className="text-ink-3" aria-hidden>
          <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 4.5V8l2.3 1.6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className={`tabular-nums ${value ? "" : "text-ink-3"}`}>{value ? timeLabel(value) : "시간 없음"}</span>
      </button>

      {open && (
        <div className={`${panelCls} w-[188px] p-1.5`}>
          <button
            type="button"
            onClick={() => choose("")}
            className={`mb-1 w-full rounded-lg px-3 py-2 text-left text-sm ${!value ? "bg-accent-soft font-semibold text-accent" : "text-ink-2 hover:bg-sunken"}`}
          >
            시간 없음
          </button>
          <div ref={listRef} role="listbox" aria-label="시간" className="relative max-h-64 overflow-y-auto border-t border-line-soft pt-1 [scrollbar-width:thin]">
            {TIMES.map((t) => {
              const on = t === value;
              return (
                <button
                  key={t}
                  type="button"
                  role="option"
                  aria-selected={on}
                  data-time={t}
                  onClick={() => choose(t)}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-sm tabular-nums ${
                    on ? "bg-accent text-on-accent font-semibold" : "hover:bg-sunken"
                  } ${t.endsWith(":00") && !on ? "font-medium" : ""}`}
                >
                  {timeLabel(t)}
                  {t === "12:00" && !on && <span className="text-[10px] text-ink-3">정오</span>}
                </button>
              );
            })}
          </div>
          {value && !TIMES.includes(value) && <p className="px-3 pt-1.5 text-[11px] text-ink-3">지금 값: {timeLabel(value)}</p>}
        </div>
      )}
    </div>
  );
}
