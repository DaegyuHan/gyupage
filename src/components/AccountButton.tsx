"use client";

import Link from "next/link";
import { logout, useAuth } from "@/lib/auth-client";

/** 머리 오른쪽: 로그인 / 로그아웃 */
export default function AccountButton() {
  const auth = useAuth();
  if (auth.loading) return <span className="h-9 w-9" />;
  const cls = "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-ink-2 transition hover:bg-sunken hover:text-ink";
  if (!auth.authed) {
    return (
      <Link href="/login" className={cls} aria-label="로그인" title="로그인">
        <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
          <rect x="4.5" y="9" width="11" height="8" rx="2" />
          <path d="M7 9V6.5a3 3 0 0 1 6 0V9" strokeLinecap="round" />
        </svg>
      </Link>
    );
  }
  return (
    <button
      onClick={() => {
        if (confirm("로그아웃할까요?")) logout();
      }}
      className={cls}
      aria-label="로그아웃"
      title="로그인됨 · 누르면 로그아웃"
    >
      <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
        <circle cx="10" cy="7" r="3" />
        <path d="M4 17c.8-3 3.2-4.5 6-4.5s5.2 1.5 6 4.5" strokeLinecap="round" />
      </svg>
    </button>
  );
}
