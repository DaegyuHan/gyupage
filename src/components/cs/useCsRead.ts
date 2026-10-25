"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";

/** 읽은 Daily CS 글(날짜) — 로그인하면 DB 에 저장해서 어느 기기에서든 같음 */
let cache: Set<string> | null = null;
const listeners = new Set<(s: Set<string>) => void>();

export function useCsRead() {
  const auth = useAuth();
  const [read, setRead] = useState<Set<string>>(cache ?? new Set());

  useEffect(() => {
    listeners.add(setRead);
    return () => {
      listeners.delete(setRead);
    };
  }, []);

  useEffect(() => {
    if (!auth.authed || cache) return;
    api<{ value: string[] | null }>("/api/prefs/csRead")
      .then((j) => {
        cache = new Set(j.value ?? []);
        listeners.forEach((l) => l(cache!));
      })
      .catch(() => {});
  }, [auth.authed]);

  const set = useCallback(
    (date: string, value: boolean) => {
      if (!auth.authed) return;
      const next = new Set(cache ?? []);
      if (value) next.add(date);
      else next.delete(date);
      cache = next;
      listeners.forEach((l) => l(next));
      api("/api/prefs/csRead", { method: "PUT", body: { value: [...next].sort().slice(-1000) } }).catch(() => {});
    },
    [auth.authed],
  );

  return { read, set, canMark: auth.authed };
}
