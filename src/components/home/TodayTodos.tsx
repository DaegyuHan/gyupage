"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import { fromKey, todayKey, toKey } from "@/lib/date";

/** 오늘 꼭 할 일 — 가볍게 적고 체크. DB 에 날짜별로 저장 (어느 기기에서든 같음) */
interface Todo {
  id: string;
  text: string;
  done: boolean;
}

export const LEGACY_TODOS_KEY = "gyupage.todos.v1";
const MAX = 6;

type Store = Record<string, Todo[]>;

const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);

export default function TodayTodos() {
  const auth = useAuth();
  const today = todayKey();
  const yesterday = (() => {
    const d = fromKey(today);
    d.setDate(d.getDate() - 1);
    return toKey(d);
  })();

  const [store, setStore] = useState<Store>({});
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const reload = useCallback(async () => {
    try {
      const j = await api<{ todos: (Todo & { day: string })[] }>(`/api/todos?day=${today}&day=${yesterday}`);
      const next: Store = { [today]: [], [yesterday]: [] };
      for (const t of j.todos) next[t.day]?.push({ id: t.id, text: t.text, done: t.done });
      setStore(next);
    } catch {
      /* 다음에 다시 */
    } finally {
      setLoaded(true);
    }
  }, [today, yesterday]);

  useEffect(() => {
    if (auth.authed) reload();
  }, [auth.authed, reload]);

  // 서버 저장이 실패하면 서버 기준으로 다시 읽음
  const persist = (p: Promise<unknown>) => p.catch(() => reload());

  const list = store[today] ?? [];
  const leftover = (store[yesterday] ?? []).filter((t) => !t.done && !list.some((x) => x.text === t.text));
  const doneCount = list.filter((t) => t.done).length;

  const setToday = (fn: (list: Todo[]) => Todo[]) => setStore((s) => ({ ...s, [today]: fn(s[today] ?? []) }));

  const addItems = (items: Todo[]) => {
    setToday((l) => [...l, ...items]);
    persist(api("/api/todos", { method: "POST", body: { day: today, items } }));
  };
  const toggle = (t: Todo) => {
    setToday((l) => l.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)));
    persist(api(`/api/todos/${t.id}`, { method: "PATCH", body: { done: !t.done } }));
  };
  const removeItem = (t: Todo) => {
    setToday((l) => l.filter((x) => x.id !== t.id));
    persist(api(`/api/todos/${t.id}`, { method: "DELETE" }));
  };

  const add = () => {
    const v = text.trim();
    if (!v || list.length >= MAX) return;
    addItems([{ id: newId(), text: v, done: false }]);
    setText("");
  };

  if (!auth.loading && !auth.authed) {
    return (
      <div className="mt-5 w-full max-w-[520px]">
        <h2 className="mb-2 text-sm font-bold">오늘 꼭 할 일</h2>
        <Link
          href="/login?next=/"
          className="flex items-center gap-2 rounded-xl border border-dashed border-line px-3 py-2.5 text-sm text-ink-3 hover:border-accent hover:text-accent"
        >
          로그인하면 할 일을 적고 볼 수 있어요
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-5 w-full max-w-[520px]">
      <div className="mb-2 flex items-baseline gap-2">
        <h2 className="text-sm font-bold">오늘 꼭 할 일</h2>
        {list.length > 0 && (
          <span className="numeral text-xs font-semibold tabular-nums text-ink-3">
            {doneCount}/{list.length}
          </span>
        )}
        {loaded && leftover.length > 0 && (
          <button
            onClick={() => addItems(leftover.slice(0, MAX - list.length).map((t) => ({ ...t, id: newId() })))}
            className="ml-auto text-xs font-semibold text-accent hover:underline"
          >
            어제 못 한 일 {leftover.length}개 가져오기
          </button>
        )}
      </div>

      {list.length > 0 && (
        <ul className="mb-2 space-y-0.5">
          {list.map((t) => (
            <li key={t.id} className="group flex items-center gap-2.5 rounded-lg px-1 py-1 hover:bg-sunken/60">
              <button
                role="checkbox"
                aria-checked={t.done}
                aria-label={t.done ? "다 한 일 되돌리기" : "다 했어요"}
                onClick={() => toggle(t)}
                className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-md border-[1.5px] transition ${
                  t.done ? "border-accent bg-accent text-on-accent" : "border-ink-3/60 hover:border-accent"
                }`}
              >
                {t.done && (
                  <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                    <path d="M2.5 6.5l2.2 2.2L9.5 3.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>
              <span className={`min-w-0 flex-1 truncate text-[15px] ${t.done ? "text-ink-3 line-through" : "font-medium"}`}>{t.text}</span>
              <button
                onClick={() => removeItem(t)}
                aria-label="지우기"
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-ink-3 touch-visible opacity-0 transition hover:bg-sunken hover:text-ink focus-visible:opacity-100 group-hover:opacity-100"
              >
                <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
                  <path d="M3 3l6 6M9 3l-6 6" strokeLinecap="round" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {list.length < MAX ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
          className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 transition focus-within:border-accent"
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4 shrink-0 text-ink-3" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
            <path d="M8 3v10M3 8h10" strokeLinecap="round" />
          </svg>
          <input
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={list.length ? "하나 더 적기" : "오늘 꼭 해야 할 일"}
            maxLength={80}
            // 테두리 상자가 이미 포커스를 보여줘서 입력칸 자체 테두리는 끔
            style={{ outline: "none" }}
            size={1}
            className="w-0 min-w-0 flex-1 bg-transparent text-[15px] placeholder:text-ink-3"
          />
          {text.trim() && (
            <button type="submit" className="shrink-0 rounded-md bg-ink px-2.5 py-1 text-xs font-semibold text-paper">
              추가
            </button>
          )}
        </form>
      ) : (
        <p className="text-xs text-ink-3">오늘은 {MAX}개까지만 적어요. 꼭 할 일만 남겨 두세요.</p>
      )}
    </div>
  );
}
