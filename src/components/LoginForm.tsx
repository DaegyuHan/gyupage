"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { refreshAuth, useAuth } from "@/lib/auth-client";

/** 혼자 쓰는 사이트라 비밀번호 하나로 로그인 (30일 기억) */
export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next")?.startsWith("/") ? params.get("next")! : "/";
  const auth = useAuth();
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pw || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password: pw }),
      });
      const j = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(j.error ?? "로그인하지 못했어요");
        return;
      }
      await refreshAuth();
      router.replace(next);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center py-16">
      <h1 className="text-3xl font-extrabold tracking-tight">로그인</h1>
      <p className="mt-2 text-sm text-ink-2">
        {auth.authed ? "이미 로그인돼 있어요." : "내 일정과 할 일은 로그인해야 보여요. 이 기기는 30일 동안 기억해요."}
      </p>
      <form onSubmit={submit} className="mt-8 space-y-3">
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          placeholder="비밀번호"
          className="w-full rounded-xl border border-line bg-surface px-4 py-3 text-[15px] placeholder:text-ink-3 focus:border-accent"
        />
        {error && <p className="text-sm font-medium text-[#d64545]">{error}</p>}
        <button
          type="submit"
          disabled={!pw || busy}
          className="w-full rounded-xl bg-ink py-3 text-sm font-bold text-paper transition disabled:opacity-40"
        >
          {busy ? "확인 중…" : "들어가기"}
        </button>
      </form>
    </div>
  );
}
