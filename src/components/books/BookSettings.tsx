"use client";

import { useRef, useState } from "react";
import { STATUS_LABEL, type Book, type BookStatus } from "@/lib/books/types";
import { resizeCover, useBooks } from "@/lib/books/useBooks";
import SaveError from "@/components/SaveError";
import BookCover from "./BookCover";

const inputCls =
  "w-full rounded-xl border border-line bg-paper px-3 py-2.5 text-[15px] placeholder:text-ink-3 focus:border-accent";

/** 표지 고르기: 파일 올리기(작게 줄여 저장) 또는 이미지 주소 */
function CoverPicker({ value, title, onChange }: { value: string | null; title: string; onChange: (v: string | null) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex gap-4">
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="group relative w-[92px] shrink-0"
        aria-label="표지 이미지 고르기"
      >
        {value ? (
          <BookCover src={value} title={title || "책"} className="w-full" />
        ) : (
          <span className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-1 rounded-md border-2 border-dashed border-line text-[11px] font-semibold text-ink-3 group-hover:border-accent group-hover:text-accent">
            <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <rect x="3" y="4" width="14" height="12" rx="2" />
              <circle cx="8" cy="8.5" r="1.5" />
              <path d="M4 15l4-4 3 3 2-2 3 3" strokeLinejoin="round" />
            </svg>
            {busy ? "줄이는 중…" : "표지 올리기"}
          </span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (!f) return;
          setBusy(true);
          try {
            onChange(await resizeCover(f));
          } finally {
            setBusy(false);
          }
        }}
      />
      <div className="min-w-0 flex-1 space-y-2 text-[12px] text-ink-3">
        <p>표지를 눌러 이미지 파일을 올리거나, 인터넷 서점의 표지 이미지 주소를 붙여 넣어요.</p>
        <div className="flex gap-2">
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…jpg" className={`${inputCls} py-2 text-sm`} />
          <button
            type="button"
            disabled={!/^https?:\/\//.test(url)}
            onClick={() => {
              onChange(url.trim());
              setUrl("");
            }}
            className="shrink-0 rounded-xl border border-line px-3 text-sm font-semibold text-ink-2 hover:border-ink-3 disabled:opacity-40"
          >
            넣기
          </button>
        </div>
        {value && (
          <button type="button" onClick={() => onChange(null)} className="font-semibold hover:text-[#d64545]">
            표지 빼기
          </button>
        )}
      </div>
    </div>
  );
}

function AddBook({ onAdd }: { onAdd: (b: { title: string; cover: string | null; totalPages: number }) => Promise<unknown> }) {
  const [title, setTitle] = useState("");
  const [pages, setPages] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const total = Math.round(Number(pages));
  const ok = title.trim() && total > 0;

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        if (!ok || busy) return;
        setBusy(true);
        try {
          await onAdd({ title: title.trim(), cover, totalPages: total });
          setTitle("");
          setPages("");
          setCover(null);
        } catch {
          /* 안내는 위에서 */
        } finally {
          setBusy(false);
        }
      }}
      className="space-y-4 rounded-2xl border border-line bg-surface p-5"
    >
      <h3 className="font-bold">새 책 추가</h3>
      <CoverPicker value={cover} title={title} onChange={setCover} />
      <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">제목</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="예: 클린 아키텍처" maxLength={200} className={inputCls} />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-ink-2">전체 쪽 수</span>
          <input value={pages} onChange={(e) => setPages(e.target.value)} type="number" inputMode="numeric" min={1} placeholder="예: 420" className={`${inputCls} numeral`} />
        </label>
      </div>
      <button type="submit" disabled={!ok || busy} className="rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-paper disabled:opacity-40">
        {busy ? "추가하는 중…" : "추가하기"}
      </button>
    </form>
  );
}

function BookRow({
  book,
  onUpdate,
  onRemove,
}: {
  book: Book;
  onUpdate: (patch: Partial<{ title: string; cover: string | null; totalPages: number; status: BookStatus }>) => Promise<unknown>;
  onRemove: () => Promise<unknown>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(book.title);
  const [pages, setPages] = useState(String(book.totalPages));
  const [cover, setCover] = useState(book.cover);
  const pct = Math.round((book.currentPage / book.totalPages) * 100);

  if (editing) {
    return (
      <li className="space-y-3 rounded-2xl border border-accent/40 bg-surface p-4">
        <CoverPicker value={cover} title={title} onChange={setCover} />
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_140px]">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputCls} />
          <input value={pages} onChange={(e) => setPages(e.target.value)} type="number" min={1} className={`${inputCls} numeral`} />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={() => setEditing(false)} className="rounded-xl px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-sunken">
            취소
          </button>
          <button
            onClick={async () => {
              await onUpdate({ title, cover, totalPages: Math.round(Number(pages)) || book.totalPages }).catch(() => {});
              setEditing(false);
            }}
            className="rounded-xl bg-ink px-4 py-2 text-sm font-bold text-paper"
          >
            저장
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-4 rounded-2xl border border-line bg-surface p-3">
      <BookCover src={book.cover} title={book.title} className="w-[52px]" />
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{book.title}</div>
        <div className="mt-0.5 text-[12px] text-ink-3">
          p.{book.currentPage} / {book.totalPages} · {pct}%
        </div>
      </div>
      <select
        value={book.status}
        onChange={(e) => onUpdate({ status: e.target.value as BookStatus }).catch(() => {})}
        className="shrink-0 rounded-lg border border-line bg-paper px-2 py-1.5 text-sm"
        aria-label="상태"
      >
        {(Object.keys(STATUS_LABEL) as BookStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <button onClick={() => setEditing(true)} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-2 hover:bg-sunken">
        수정
      </button>
      <button
        onClick={() => {
          if (confirm(`'${book.title}'와 읽은 기록을 모두 지울까요?`)) onRemove().catch(() => {});
        }}
        className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-3 hover:bg-[#d64545]/10 hover:text-[#d64545]"
      >
        삭제
      </button>
    </li>
  );
}

/** 설정 > 책: 추가·수정·상태·삭제 */
export default function BookSettings() {
  const { books, loaded, error, add, update, remove } = useBooks({ logs: false });
  return (
    <section id="books" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">읽는 책</h2>
      <p className="mt-1 text-sm text-ink-2">
        &lsquo;읽는 중&rsquo;인 책이 홈 맨 아래 독서 칸에 나와요. 홈에서 진행 바를 눌러 읽은 쪽 수를 적으면 독서 탭에 기록이 쌓여요.
      </p>
      <SaveError message={error} />
      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <AddBook onAdd={add} />
        <div>
          <h3 className="mb-3 font-bold">내 책 {books.length > 0 && <span className="text-ink-3">{books.length}</span>}</h3>
          {!loaded ? (
            <div className="h-24 rounded-2xl bg-sunken/70" aria-busy="true" />
          ) : books.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-3">아직 추가한 책이 없어요.</p>
          ) : (
            <ul className="space-y-2">
              {books.map((b) => (
                <BookRow key={b.id} book={b} onUpdate={(p) => update(b.id, p)} onRemove={() => remove(b.id)} />
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
