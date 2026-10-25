"use client";

import { useMemo, useState } from "react";
import { CATEGORIES } from "@/lib/categories";
import { todayKey } from "@/lib/date";
import Link from "next/link";
import LegacyImport from "@/components/LegacyImport";
import SaveError from "@/components/SaveError";
import { useEvents } from "@/lib/eventStore";
import type { CategoryId } from "@/lib/types";
import DayPanel from "./DayPanel";
import MonthGrid from "./MonthGrid";
import { useEventEditor } from "./useEventEditor";
import { useHolidays } from "@/lib/useHolidays";

/** 캘린더 탭: 월간 달력 + 카테고리 필터 + 선택한 날 */
export default function CalendarView() {
  const store = useEvents();
  const { events, loaded } = store;
  const editor = useEventEditor(store);

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [selected, setSelected] = useState(todayKey());
  const [visible, setVisible] = useState<Set<CategoryId>>(new Set(CATEGORIES.map((c) => c.id)));


  const filtered = useMemo(() => events.filter((e) => visible.has(e.category)), [events, visible]);
  // 달력 6주가 앞뒤 해로 넘어갈 수 있어서 3년치
  const holidays = useHolidays([year - 1, year, year + 1]);

  const moveMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };
  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
    setSelected(todayKey());
  };

  const toggle = (id: CategoryId) =>
    setVisible((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openNew = (key: string) => {
    setSelected(key);
    editor.openNew(key);
  };

  // 서버(UTC)와 브라우저(KST)의 '오늘'이 달라 생기는 hydration 불일치를 피하려고 클라이언트에서만 그림
  if (!loaded) return <div className="h-[70vh]" aria-busy="true" />;

  // 캘린더는 내 일정이라 로그인해야 보여요
  if (!store.authed) {
    return (
      <div className="mx-auto flex min-h-[50vh] max-w-md flex-col items-center justify-center text-center">
        <h1 className="text-2xl font-extrabold tracking-tight">캘린더는 로그인해야 보여요</h1>
        <p className="mt-2 text-sm text-ink-2">일정은 DB 에 저장돼서 로그인하면 어느 기기에서든 같은 일정을 볼 수 있어요.</p>
        <Link href="/login?next=/calendar" className="mt-6 rounded-full bg-ink px-5 py-2.5 text-sm font-bold text-paper">
          로그인
        </Link>
      </div>
    );
  }

  const isThisMonth = year === now.getFullYear() && month === now.getMonth();

  return (
    <>
      <div className="mt-6">
        <LegacyImport onDone={store.reload} />
      <SaveError message={store.error} />
      </div>
      <div className="mt-6 grid gap-10 xl:grid-cols-[minmax(0,1fr)_340px]">
        {/* 달력 */}
        <div className="min-w-0">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
            <div className="flex items-center gap-3">
              <h1 className="flex items-baseline gap-2">
                <span className="numeral text-5xl font-extrabold">{month + 1}월</span>
                <span className="numeral text-lg font-semibold text-ink-3">{year}</span>
              </h1>
              <div className="flex items-center rounded-full border border-line bg-surface">
                <button
                  onClick={() => moveMonth(-1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink"
                  aria-label="이전 달"
                >
                  <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
                    <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
                <button
                  onClick={goToday}
                  disabled={isThisMonth}
                  className="px-1.5 text-sm font-medium text-ink-2 hover:text-ink disabled:text-ink-3"
                >
                  오늘
                </button>
                <button
                  onClick={() => moveMonth(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:text-ink"
                  aria-label="다음 달"
                >
                  <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
                    <path d="m1.5 1 5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(() => {
                const all = visible.size === CATEGORIES.length;
                return (
                  <button
                    onClick={() => setVisible(all ? new Set() : new Set(CATEGORIES.map((c) => c.id)))}
                    aria-pressed={all}
                    className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors ${
                      all ? "border-transparent bg-ink text-paper" : "border-line text-ink-3 hover:text-ink-2"
                    }`}
                    title={all ? "전부 끄기" : "전부 켜기"}
                  >
                    전체
                  </button>
                );
              })()}
              {CATEGORIES.map((c) => {
                const on = visible.has(c.id);
                return (
                  <button
                    key={c.id}
                    onClick={() => toggle(c.id)}
                    aria-pressed={on}
                    className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors ${
                      on ? "border-transparent bg-surface text-ink shadow-[0_1px_2px_rgba(20,28,43,0.08)]" : "border-line text-ink-3"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 rounded-full transition-all"
                      style={on ? { background: c.color } : { boxShadow: `inset 0 0 0 1.5px ${c.color}` }}
                    />
                    {c.label}
                  </button>
                );
              })}
              <button
                onClick={() => openNew(selected)}
                className="ml-1 rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-on-accent transition-transform active:scale-[0.97]"
              >
                새 일정
              </button>
            </div>
          </div>

          <MonthGrid
            year={year}
            month={month}
            events={filtered}
            selected={selected}
            onSelect={setSelected}
            onAdd={openNew}
            onEventClick={editor.openEdit}
            holidays={holidays}
          />
          <p className="mt-3 text-xs text-ink-3">날짜를 먼저 한 번 눌러 고른 뒤, 그 칸의 일정을 누르면 편집하고 + 를 누르면 추가해요.</p>
        </div>

        {/* 선택한 날 */}
        <aside className="space-y-10 xl:pt-[68px]">
          <DayPanel
            dateKey={selected}
            holiday={holidays.get(selected)}
            events={filtered}
            onAdd={() => openNew(selected)}
            onEventClick={editor.openEdit}
            onMemoChange={editor.updateMemo}
          />
        </aside>
      </div>

      {editor.modal}
    </>
  );
}
