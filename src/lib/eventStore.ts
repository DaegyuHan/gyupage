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

export function useEvents() {
  const auth = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const j = await api<{ events: CalendarEvent[] }>("/api/events");
      setEvents(j.events);
      setError(null);
    } catch {
      setError("일정을 불러오지 못했어요");
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
      fn().catch(() => {
        setError("저장하지 못했어요. 다시 시도해 주세요");
        reload();
      });
    },
    [reload],
  );

  const add = useCallback(
    (input: EventInput) => {
      const now = Date.now();
      const ev: CalendarEvent = { ...input, id: newId(), createdAt: now, updatedAt: now };
      setEvents((prev) => [...prev, ev]);
      persist(() => api("/api/events", { method: "POST", body: ev }));
    },
    [persist],
  );

  const update = useCallback(
    (id: string, input: EventInput) => {
      const updatedAt = Date.now();
      setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...input, updatedAt } : e)));
      persist(() => api(`/api/events/${encodeURIComponent(id)}`, { method: "PUT", body: { ...input, id, updatedAt } }));
    },
    [persist],
  );

  const remove = useCallback(
    (id: string) => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
      persist(() => api(`/api/events/${encodeURIComponent(id)}`, { method: "DELETE" }));
    },
    [persist],
  );

  /** 백업 파일 불러오기: 전부 이걸로 바꿈 */
  const replaceAll = useCallback(
    (next: CalendarEvent[]) => {
      setEvents(next);
      persist(async () => {
        const j = await api<{ events: CalendarEvent[] }>("/api/events/import", { method: "POST", body: { mode: "replace", events: next } });
        setEvents(j.events);
      });
    },
    [persist],
  );

  /** 다른 곳(브라우저 데이터 옮기기 등)에서 바뀐 뒤 다시 읽기 */
  return { events, loaded, error, add, update, remove, replaceAll, reload, authed: auth.authed };
}
