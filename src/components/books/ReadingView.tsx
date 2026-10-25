"use client";

import Link from "next/link";
import { useMemo } from "react";
import { formatKorean, toKey, WEEKDAYS } from "@/lib/date";
import type { Book } from "@/lib/books/types";
import { useBooks } from "@/lib/books/useBooks";
import BookCover from "./BookCover";

function Stat({ value, unit, label }: { value: number; unit: string; label: string }) {
  return (
    <div>
      <div className="numeral text-4xl font-extrabold tabular-nums">
        {value.toLocaleString()}
        <span className="ml-0.5 text-base font-bold text-ink-3">{unit}</span>
      </div>
      <div className="mt-1 text-sm text-ink-2">{label}</div>
    </div>
  );
}

/** 독서 탭: 진행도 갱신 기록을 날짜별로 */
export default function ReadingView() {
  const { books, logs, loaded } = useBooks();
  const byId = useMemo(() => new Map(books.map((b) => [b.id, b])), [books]);

  const today = toKey(new Date());
  const month = today.slice(0, 7);
  const pagesOf = (l: { fromPage: number; toPage: number }) => Math.max(0, l.toPage - l.fromPage);

  const monthPages = logs.filter((l) => l.day.startsWith(month)).reduce((s, l) => s + pagesOf(l), 0);
  const finished = books.filter((b) => b.status === "done").sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  const reading = books.filter((b) => b.status === "reading");

  // 최근 14일 하루 쪽 수
  const days = useMemo(() => {
    const out: { day: string; pages: number }[] = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = toKey(d);
      out.push({ day: k, pages: logs.filter((l) => l.day === k).reduce((s, l) => s + pagesOf(l), 0) });
    }
    return out;
  }, [logs]);
  const maxDay = Math.max(10, ...days.map((d) => d.pages));

  const groups = useMemo(() => {
    const m = new Map<string, typeof logs>();
    for (const l of logs) m.set(l.day, [...(m.get(l.day) ?? []), l]);
    return [...m.entries()].sort((a, b) => b[0].localeCompare(a[0]));
  }, [logs]);

  if (!loaded) return <div className="h-[60vh]" aria-busy="true" />;

  return (
    <div className="mx-auto max-w-5xl pb-16">
      <header className="grid gap-6 border-b border-line pb-8 pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">독서</h1>
          <p className="mt-3 text-ink-2">
            홈에서 진행 바를 눌러 읽은 쪽 수를 적으면 여기에 쌓여요.{" "}
            <Link href="/settings#books" className="font-semibold text-accent hover:underline">
              책 관리
            </Link>
          </p>
        </div>
        <div className="flex gap-10">
          <Stat value={monthPages} unit="쪽" label={`${Number(month.slice(5))}월에 읽은 쪽`} />
          <Stat value={finished.length} unit="권" label="다 읽은 책" />
        </div>
      </header>

      {/* 최근 14일 */}
      <section className="border-b border-line-soft py-8">
        <h2 className="mb-4 text-sm font-bold text-ink-2">최근 2주</h2>
        <div className="grid h-[120px] grid-cols-14 items-end gap-1.5" style={{ gridTemplateColumns: "repeat(14, minmax(0, 1fr))" }}>
          {days.map((d) => {
            const isToday = d.day === today;
            const dow = new Date(`${d.day}T12:00:00`).getDay();
            return (
              <div key={d.day} className="flex h-full flex-col items-center justify-end gap-1" title={`${formatKorean(d.day)} · ${d.pages}쪽`}>
                <span className={`numeral text-[10px] tabular-nums ${d.pages ? "font-bold" : "text-ink-3"}`}>{d.pages || ""}</span>
                <span
                  className="w-full max-w-[26px] rounded-t-md"
                  style={{
                    height: d.pages ? `${Math.max(4, (d.pages / maxDay) * 80)}px` : "3px",
                    background: d.pages ? (isToday ? "var(--color-accent)" : "color-mix(in oklab, var(--color-accent) 50%, var(--color-sunken))") : "var(--color-sunken)",
                  }}
                />
                <span className={`text-[10px] ${isToday ? "font-bold text-accent" : dow === 0 ? "text-[#d4483b]/80" : "text-ink-3"}`}>
                  {isToday ? "오늘" : Number(d.day.slice(8))}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-10 pt-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* 날짜별 기록 */}
        <section>
          <h2 className="mb-4 text-sm font-bold text-ink-2">읽은 기록</h2>
          {groups.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-3">아직 기록이 없어요. 홈에서 진행 바를 눌러 첫 기록을 남겨 보세요.</p>
          ) : (
            <ol className="space-y-6">
              {groups.map(([day, list]) => {
                const total = list.reduce((s, l) => s + pagesOf(l), 0);
                const d = new Date(`${day}T12:00:00`);
                return (
                  <li key={day}>
                    <div className="mb-2 flex items-baseline justify-between">
                      <span className="text-sm font-bold">
                        {day === today ? "오늘 · " : ""}
                        {d.getMonth() + 1}월 {d.getDate()}일 ({WEEKDAYS[d.getDay()]})
                      </span>
                      {total > 0 && <span className="numeral text-sm font-bold text-[#0e8a6b]">+{total}쪽</span>}
                    </div>
                    <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface">
                      {list.map((l) => {
                        const b = byId.get(l.bookId);
                        const diff = l.toPage - l.fromPage;
                        const time = new Date(l.createdAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false });
                        return (
                          <li key={l.id} className="flex items-center gap-3 px-4 py-3">
                            {b && <BookCover src={b.cover} title={b.title} className="w-[30px] rounded-[3px] text-[8px]" />}
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-[14px] font-semibold">{b?.title ?? "지운 책"}</div>
                              <div className="text-[12px] tabular-nums text-ink-3">
                                p.{l.fromPage} → p.{l.toPage}
                                {b && l.toPage >= b.totalPages && <span className="ml-1.5 font-bold text-[#0e8a6b]">완독 🎉</span>}
                                <span className="ml-1.5">{time}</span>
                              </div>
                            </div>
                            <span className={`numeral shrink-0 text-sm font-bold tabular-nums ${diff > 0 ? "text-[#0e8a6b]" : "text-ink-3"}`}>
                              {diff > 0 ? `+${diff}` : diff}쪽
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                );
              })}
            </ol>
          )}
        </section>

        <aside className="space-y-8">
          <section>
            <h2 className="mb-3 text-sm font-bold text-ink-2">읽는 중</h2>
            {reading.length === 0 ? (
              <p className="text-sm text-ink-3">읽고 있는 책이 없어요.</p>
            ) : (
              <ul className="space-y-3">
                {reading.map((b) => (
                  <BookLine key={b.id} book={b} />
                ))}
              </ul>
            )}
          </section>
          <section>
            <h2 className="mb-3 text-sm font-bold text-ink-2">다 읽은 책</h2>
            {finished.length === 0 ? (
              <p className="text-sm text-ink-3">아직 없어요.</p>
            ) : (
              <ul className="grid grid-cols-3 gap-3">
                {finished.map((b) => (
                  <li key={b.id} title={b.title}>
                    <BookCover src={b.cover} title={b.title} className="w-full" />
                    <div className="mt-1 truncate text-[11px] font-semibold">{b.title}</div>
                    {b.finishedAt && <div className="text-[10px] text-ink-3">{new Date(b.finishedAt).toLocaleDateString("ko-KR")}</div>}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}

function BookLine({ book }: { book: Book }) {
  const pct = Math.round((book.currentPage / book.totalPages) * 100);
  return (
    <li className="flex items-center gap-3">
      <BookCover src={book.cover} title={book.title} className="w-[40px] rounded-[4px] text-[9px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-semibold">{book.title}</div>
        <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-0.5 text-[11px] tabular-nums text-ink-3">
          p.{book.currentPage} / {book.totalPages} · {pct}%
        </div>
      </div>
    </li>
  );
}
