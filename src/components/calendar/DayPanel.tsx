"use client";

import MarkdownView from "@/components/editor/MarkdownView";
import { CATEGORY_MAP } from "@/lib/categories";
import { fromKey, inRange, todayKey, WEEKDAYS } from "@/lib/date";
import type { CalendarEvent } from "@/lib/types";

interface Props {
  dateKey: string;
  events: CalendarEvent[];
  onAdd: () => void;
  onEventClick: (ev: CalendarEvent) => void;
  /** 패널에서 체크박스 눌렀을 때 */
  onMemoChange: (ev: CalendarEvent, memo: string) => void;
}

export default function DayPanel({ dateKey, events, onAdd, onEventClick, onMemoChange }: Props) {
  const d = fromKey(dateKey);
  const isToday = dateKey === todayKey();
  const list = events
    .filter((e) => inRange(dateKey, e.start, e.end))
    .sort(
      (a, b) =>
        Number(a.start === a.end) - Number(b.start === b.end) || (a.time ?? "99").localeCompare(b.time ?? "99"),
    );

  return (
    <section>
      <header className="mb-4 flex items-end justify-between gap-3">
        <div className="flex items-end gap-3">
          <span className="numeral text-5xl font-extrabold leading-[0.8]">{d.getDate()}</span>
          <div className="leading-tight">
            <div className="text-xs text-ink-2">{d.getMonth() + 1}월</div>
            <div className="font-bold">
              {WEEKDAYS[d.getDay()]}요일{isToday && <span className="ml-1.5 text-accent">오늘</span>}
            </div>
          </div>
        </div>
        <button
          onClick={onAdd}
          className="rounded-full border border-line px-3.5 py-1.5 text-sm font-medium hover:border-ink-3"
        >
          일정 추가
        </button>
      </header>

      {list.length === 0 ? (
        <button
          onClick={onAdd}
          className="w-full rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-3 hover:border-ink-3 hover:text-ink-2"
        >
          비어 있는 날이에요. 눌러서 일정을 추가하세요.
        </button>
      ) : (
        <ul className="divide-y divide-line-soft">
          {list.map((ev) => {
            const c = CATEGORY_MAP[ev.category];
            const ranged = ev.start !== ev.end;
            return (
              <li key={ev.id} className="py-3 first:pt-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => onEventClick(ev)}
                  onKeyDown={(e) => e.key === "Enter" && onEventClick(ev)}
                  className="-mx-2 cursor-pointer rounded-lg px-2 py-1 hover:bg-sunken/60"
                >
                  <div className="flex items-center gap-2 text-xs">
                    <span
                      className="rounded-full px-2 py-0.5 font-semibold"
                      style={{ background: c.soft, color: c.color }}
                    >
                      {c.label}
                    </span>
                    {ev.time && <span className="tabular-nums text-ink-2">{ev.time}</span>}
                    {ranged && (
                      <span className="tabular-nums text-ink-3">
                        {ev.start.slice(5).replace("-", ".")} – {ev.end.slice(5).replace("-", ".")}
                      </span>
                    )}
                  </div>
                  <div className="mt-1.5 text-[15px] font-semibold leading-snug">{ev.title}</div>
                  {ev.memo && (
                    <MarkdownView
                      source={ev.memo}
                      onChange={(next) => onMemoChange(ev, next)}
                      className="mt-2 max-h-80 overflow-y-auto text-ink-2"
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
