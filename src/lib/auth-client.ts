"use client";

import { useEffect, useState } from "react";

/** 로그인 상태 (페이지 안에서 한 번만 물어보고 나눠 씀) */
export interface AuthState {
  authed: boolean;
  /** 서버에 DB 가 연결돼 있는지 */
  db: boolean;
  loading: boolean;
}

let state: AuthState = { authed: false, db: false, loading: true };
let inflight: Promise<void> | null = null;
const listeners = new Set<(s: AuthState) => void>();

function emit(next: AuthState) {
  state = next;
  listeners.forEach((l) => l(state));
}

export function refreshAuth() {
  inflight = fetch("/api/auth/me", { cache: "no-store" })
    .then((r) => r.json())
    .then((j: { authed: boolean; db: boolean }) => emit({ authed: !!j.authed, db: !!j.db, loading: false }))
    .catch(() => emit({ authed: false, db: false, loading: false }));
  return inflight;
}

/** 로그인 표시 쿠키가 있으면 서버에 묻기 전에 바로 '로그인됨'으로 시작 (서버 확인은 뒤에서) */
function hinted() {
  try {
    return document.cookie.split("; ").includes("gp_in=1");
  } catch {
    return false;
  }
}

export function useAuth() {
  const [s, setS] = useState(state);
  useEffect(() => {
    listeners.add(setS);
    if (state.loading && hinted()) emit({ authed: true, db: true, loading: false });
    if (!inflight) refreshAuth();
    else setS(state);
    return () => {
      listeners.delete(setS);
    };
  }, []);
  return s;
}

export async function logout() {
  await fetch("/api/auth/logout", { method: "POST" });
  await refreshAuth();
}

/** JSON 요청 도우미 (실패하면 던짐) */
export async function api<T>(url: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(url, {
    method: init?.method ?? "GET",
    headers: init?.body !== undefined ? { "content-type": "application/json" } : undefined,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) refreshAuth();
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string; detail?: string };
    throw new Error(j.detail || j.error || `${url} ${res.status}`);
  }
  return (await res.json()) as T;
}
