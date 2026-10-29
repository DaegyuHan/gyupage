"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Book } from "@/lib/books/types";
import { useBooks } from "@/lib/books/useBooks";
import SaveError from "@/components/SaveError";
import BookCover from "./BookCover";

/** 진행 바 — 누르면 지금 몇 쪽까지 읽었는지 적는 칸이 열림 */
function ProgressEditor({ book, onSave }: { book: Book; onSave: (page: number) => Promise<unknown> }) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(String(book.currentPage));
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const pct = Math.round((book.currentPage / book.totalPages) * 100);
  const done = book.currentPage >= book.totalPages;

  useEffect(() => {
    if (open) {
      setValue(String(book.currentPage));
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [open, book.currentPage]);

  const save = async () => {
    const n = Math.round(Number(value));
    if (!Number.isFinite(n) || n < 0 || n > book.totalPages) return;
    setBusy(true);
    try {
      await onSave(n);
      setOpen(false);
    } catch {
      /* 안내는 위에서 */
    } finally {
      setBusy(false);
    }
  };

  const n = Number(value);
  const invalid = value !== "" && (!Number.isFinite(n) || n < 0 || n > book.totalPages);
  const diff = Number.isFinite(n) ? Math.round(n) - book.currentPage : 0;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="group block w-full text-left"
        aria-label={`${book.title} 읽은 쪽 수 바꾸기`}
        aria-expanded={open}
      >
        <div className="mb-1.5 flex items-baseline justify-between text-[12px]">
          <span className="text-ink-3 group-hover:text-accent">
            {done ? "다 읽었어요 🎉" : open ? "몇 쪽까지 읽었나요?" : "눌러서 읽은 쪽 수 적기"}
          </span>
          <span className="numeral font-bold tabular-nums">
            p.{book.currentPage}
            <span className="font-medium text-ink-3"> / {book.totalPages}</span>
            <span className="ml-1.5 text-accent">{pct}%</span>
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-sunken ring-accent/40 transition group-hover:ring-2">
          <div
            className="h-full rounded-full transition-[width] duration-500"
            style={{ width: `${pct}%`, background: done ? "#0e8a6b" : "linear-gradient(90deg, var(--color-accent), #7c5cff)" }}
          />
        </div>
      </button>

      {open && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
          className="anim-pop mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2.5"
        >
          <span className="text-sm font-semibold text-ink-2">p.</span>
          <input
            ref={inputRef}
            type="number"
            inputMode="numeric"
            min={0}
            max={book.totalPages}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
            style={{ outline: "none" }}
            className={`numeral w-20 rounded-lg border bg-paper px-2 py-1.5 text-center text-[15px] font-bold tabular-nums ${invalid ? "border-[#d64545]" : "border-line focus:border-accent"}`}
          />
          <span className="text-sm text-ink-3">/ {book.totalPages}</span>
          {!invalid && diff !== 0 && (
            <span className={`text-xs font-bold ${diff > 0 ? "text-[#0e8a6b]" : "text-ink-3"}`}>
              {diff > 0 ? `+${diff}쪽` : `${diff}쪽`}
            </span>
          )}
          <span className="ml-auto flex gap-1.5">
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg px-3 py-1.5 text-sm font-semibold text-ink-2 hover:bg-sunken">
              취소
            </button>
            <button type="submit" disabled={busy || invalid || value === ""} className="rounded-lg bg-ink px-3 py-1.5 text-sm font-bold text-paper disabled:opacity-40">
              {busy ? "저장 중…" : "저장"}
            </button>
          </span>
        </form>
      )}
    </div>
  );
}

/**
 * 홈: 책 두 권까지 — 읽는 중인 책이 먼저, 칸이 남으면 가장 최근에 다 읽은 책
 * (한 권을 다 읽고 다음 책으로 넘어가도 방금 끝낸 책이 옆에 같이 보임)
 */
export default function ReadingSection() {
  const { books, loaded, authed, authLoading, error, setProgress } = useBooks({ logs: false });
  const lastDone = books
    .filter((b) => b.status === "done")
    .sort((a, b) => (b.finishedAt ?? b.updatedAt) - (a.finishedAt ?? a.updatedAt))[0];
  const nowReading = books.filter((b) => b.status === "reading").slice(0, 2);
  const reading = nowReading.length < 2 && lastDone ? [...nowReading, lastDone] : nowReading;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">독서</h2>
        {authed && (
          <span className="flex gap-3 text-xs font-semibold">
            <Link href="/reading" className="text-ink-3 hover:text-accent">
              읽은 기록
            </Link>
            <Link href="/settings#books" className="text-ink-3 hover:text-accent">
              책 관리
            </Link>
          </span>
        )}
      </div>
      <SaveError message={error} />

      {!authLoading && !authed ? (
        <Link
          href="/login?next=/"
          className="flex items-center justify-center rounded-2xl border border-dashed border-line p-6 text-sm text-ink-3 hover:border-accent hover:text-accent"
        >
          로그인하면 읽고 있는 책이 보여요
        </Link>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {!loaded ? (
            <div className="h-[150px] rounded-2xl bg-sunken/70" aria-busy="true" />
          ) : reading.length === 0 ? (
            <Link
              href="/settings#books"
              className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-line p-8 text-center text-sm text-ink-3 hover:border-accent hover:text-accent"
            >
              <span className="font-semibold text-ink-2">지금 읽고 있는 책이 없어요</span>
              설정에서 책을 추가해 보세요 →
            </Link>
          ) : (
            reading.map((b) => (
              <div key={b.id} className="flex gap-4 rounded-2xl border border-line bg-surface p-4">
                <BookCover src={b.cover} title={b.title} className="w-[76px]" />
                <div className="flex min-w-0 flex-1 flex-col">
                  <h3 className="line-clamp-2 text-[16px] font-extrabold leading-snug tracking-tight" title={b.title}>
                    {b.title}
                  </h3>
                  <p className="mt-0.5 text-[11px] text-ink-3">
                    {b.status === "done" ? (
                      <span className="font-semibold text-[#0e8a6b]">
                        다 읽음{b.finishedAt ? ` · ${new Date(b.finishedAt + 9 * 3600_000).getUTCMonth() + 1}/${new Date(b.finishedAt + 9 * 3600_000).getUTCDate()} 완독` : ""}
                      </span>
                    ) : b.totalPages - b.currentPage > 0 ? (
                      `${(b.totalPages - b.currentPage).toLocaleString()}쪽 남았어요`
                    ) : (
                      "완독"
                    )}
                  </p>
                  <div className="mt-auto pt-3">
                    <ProgressEditor book={b} onSave={(p) => setProgress(b.id, p)} />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </section>
  );
}
