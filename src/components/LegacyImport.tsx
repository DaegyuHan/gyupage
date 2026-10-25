"use client";

import { useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import { LEGACY_EVENTS_KEY } from "@/lib/eventStore";
import type { CalendarEvent } from "@/lib/types";

/**
 * 예전에 이 브라우저에만 저장했던 일정·할 일·읽음 표시를 DB 로 한 번 옮기기.
 * 옮기고 나면 다시 묻지 않아요.
 */
const DONE_KEY = "gyupage.migrated.v1";
const TODOS_KEY = "gyupage.todos.v1";
const CS_KEY = "gyupage.cs.read";
const PLACE_KEY = "gyupage.weatherPlace";

function readJson<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export default function LegacyImport({ onDone }: { onDone?: () => void }) {
  const auth = useAuth();
  const [counts, setCounts] = useState<{ events: number; todos: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!auth.authed) return;
    try {
      if (localStorage.getItem(DONE_KEY) || sessionStorage.getItem(DONE_KEY)) return;
    } catch {
      return;
    }
    const events = readJson<CalendarEvent[]>(LEGACY_EVENTS_KEY) ?? [];
    const todos = Object.values(readJson<Record<string, unknown[]>>(TODOS_KEY) ?? {}).flat();
    if (events.length || todos.length) setCounts({ events: events.length, todos: todos.length });
  }, [auth.authed]);

  if (!counts) return null;

  const run = async () => {
    setBusy(true);
    try {
      const events = readJson<CalendarEvent[]>(LEGACY_EVENTS_KEY) ?? [];
      if (events.length) await api("/api/events/import", { method: "POST", body: { mode: "merge", events } });

      const todos = readJson<Record<string, { id: string; text: string; done: boolean }[]>>(TODOS_KEY) ?? {};
      for (const [day, items] of Object.entries(todos)) {
        if (items.length) await api("/api/todos", { method: "POST", body: { day, items } });
      }

      const csRead = readJson<string[]>(CS_KEY);
      if (csRead?.length) {
        const cur = await api<{ value: string[] | null }>("/api/prefs/csRead");
        await api("/api/prefs/csRead", { method: "PUT", body: { value: [...new Set([...(cur.value ?? []), ...csRead])] } });
      }
      const place = readJson(PLACE_KEY);
      if (place) {
        const cur = await api<{ value: unknown }>("/api/prefs/weatherPlace");
        if (!cur.value) await api("/api/prefs/weatherPlace", { method: "PUT", body: { value: place } });
      }

      localStorage.setItem(DONE_KEY, String(Date.now()));
      setMsg(`일정 ${counts.events}개, 할 일 ${counts.todos}개를 옮겼어요. 이제 어느 기기에서든 보여요.`);
      onDone?.();
      setTimeout(() => setCounts(null), 4000);
    } catch {
      setMsg("옮기다가 문제가 생겼어요. 잠시 뒤 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 rounded-2xl border border-accent/30 bg-accent-soft/50 px-4 py-3 text-sm">
      <span className="min-w-0 flex-1">
        {msg ?? (
          <>
            이 브라우저에만 저장돼 있던 <b>일정 {counts.events}개</b>
            {counts.todos > 0 && (
              <>
                , <b>할 일 {counts.todos}개</b>
              </>
            )}
            를 DB 로 옮길까요?
          </>
        )}
      </span>
      {!msg && (
        <span className="flex shrink-0 gap-2">
          <button
            onClick={() => {
              try {
                sessionStorage.setItem(DONE_KEY, "later");
              } catch {}
              setCounts(null);
            }}
            className="rounded-full px-3 py-1.5 font-semibold text-ink-2 hover:bg-surface"
          >
            나중에
          </button>
          <button onClick={run} disabled={busy} className="rounded-full bg-accent px-4 py-1.5 font-bold text-on-accent disabled:opacity-50">
            {busy ? "옮기는 중…" : "옮기기"}
          </button>
        </span>
      )}
    </div>
  );
}
