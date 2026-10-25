"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useAuth } from "./auth-client";
import type { CalendarEvent } from "./types";

/**
 * 일정 저장소 — Neon DB (어느 기기에서든 같은 일정).
 * 화면은 먼저 바꾸고(낙관적 업데이트) 서버 저장이 실패하면 다시 불러와요.
 * 로그인하지 않으면 일정은 비어 있어요.
 */
export const LEGACY_EVENTS_KEY = "gyupage.events.v1";

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export type EventInput = Omit<CalendarEvent, "id" | "createdAt" | "updatedAt">;

/** 할일(홈 '오늘 꼭 할 일')은 todos 표에 있어서, 캘린더에서는 일정 모양으로 바꿔 보여줌 */
interface TodoRow {
  id: string;
  day: string;
  text: string;
  done: boolean;
}
const TODO_PREFIX = "todo:";
const isTodoId = (id: string) => id.startsWith(TODO_PREFIX);
const todoId = (id: string) => id.slice(TODO_PREFIX.length);
function todoToEvent(t: TodoRow): CalendarEvent {
  return { id: TODO_PREFIX + t.id, title: t.text, category: "todo", start: t.day, end: t.day, done: t.done, createdAt: 0, updatedAt: 0 };
}

/** 할일로 저장 / 일정으로 저장 */
function createRemote(ev: CalendarEvent) {
  if (ev.category === "todo") {
    return api("/api/todos", { method: "POST", body: { day: ev.start, items: [{ id: todoId(ev.id), text: ev.title, done: !!ev.done }] } });
  }
  return api("/api/events", { method: "POST", body: ev });
}
function deleteRemote(id: string) {
  return isTodoId(id) ? api(`/api/todos/${encodeURIComponent(todoId(id))}`, { method: "DELETE" }) : api(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" });
}

export function useEvents() {
  const auth = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [j, t] = await Promise.all([
        api<{ events: CalendarEvent[] }>("/api/events"),
        api<{ todos: TodoRow[] }>("/api/todos?all=1").catch(() => ({ todos: [] as TodoRow[] })),
      ]);
      setEvents([...j.events, ...t.todos.map(todoToEvent)]);
    } catch (e) {
      setError(`일정을 불러오지 못했어요 (${String(e).replace(/^Error: /, "")})`);
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.authed) {
      setEvents([]);
      setLoaded(true);
      return;
    }
    reload();
  }, [auth.loading, auth.authed, reload]);

  /** 화면 먼저 바꾸고 저장, 실패하면 서버 기준으로 되돌림 */
  const persist = useCallback(
    (fn: () => Promise<unknown>) => {
      fn()
        .then(() => setError(null))
        .catch((e) => {
          setError(`저장하지 못했어요 (${String(e).replace(/^Error: /, "")})`);
          reload();
        });
    },
    [reload],
  );

  const add = useCallback(
    (input: EventInput) => {
      const now = Date.now();
      const base = input.category === "todo" ? TODO_PREFIX + newId() : newId();
      const ev: CalendarEvent = { ...input, id: base, createdAt: now, updatedAt: now, ...(input.category === "todo" ? { end: input.start, time: undefined, memo: undefined } : {}) };
      setEvents((prev) => [...prev, ev]);
      persist(() => createRemote(ev));
    },
    [persist],
  );

  const update = useCallback(
    (id: string, input: EventInput) => {
      const updatedAt = Date.now();
      const wasTodo = isTodoId(id);
      const nowTodo = input.category === "todo";
      if (wasTodo !== nowTodo) {
        // 할일 ↔ 일정으로 바뀌면 지우고 새로 만듦
        const ev: CalendarEvent = { ...input, id: nowTodo ? TODO_PREFIX + newId() : newId(), createdAt: updatedAt, updatedAt, ...(nowTodo ? { end: input.start } : {}) };
        setEvents((prev) => [...prev.filter((e) => e.id !== id), ev]);
        persist(async () => {
          await createRemote(ev);
          await deleteRemote(id);
        });
        return;
      }
      if (nowTodo) {
        setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, end: input.start } : e)));
        persist(() => api(`/api/todos/${encodeURIComponent(todoId(id))}`, { method: "PATCH", body: { text: input.title, day: input.start, done: !!input.done } }));
        return;
      }
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt } : e)));
      persist(() => api(`/api/events/${encodeURIComponent(id)}`, { method: "PUT", body: { ...input, id, updatedAt } }));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      persist(() => deleteRemote(id));
    },
    [persist],
  );

  /** 백업 파일 불러오기: 전부 이걸로 바꿈 */
  const replaceAll = useCallback(
    (next: CalendarEvent[]) => {
      const plain = next.filter((e) => e.category !== "todo" && !isTodoId(e.id));
      setEvents((prev) => [...plain, ...prev.filter((e) => e.category === "todo")]);
      persist(async () => {
        await api("/api/events/import", { method: "POST", body: { mode: "replace", events: plain } });
        await reload();
      });
    },
    [persist, reload],
  );

  /** 다른 곳(브라우저 데이터 옮기기 등)에서 바뀐 뒤 다시 읽기 */
  return { events, loaded, error, add, update, remove, replaceAll, reload, authed: auth.authed };
}
