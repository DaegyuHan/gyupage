"use client";

import { useEffect, useState } from "react";

import { THEME_KEY as KEY } from "@/lib/theme";

type Theme = "light" | "dark";

function apply(theme: Theme, animate: boolean) {
  const root = document.documentElement;
  if (animate) {
    root.classList.add("theme-switching");
    window.setTimeout(() => root.classList.remove("theme-switching"), 260);
  }
  root.dataset.theme = theme;
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    // 기본은 다크 (직접 라이트로 바꾼 경우만 라이트)
    setTheme((document.documentElement.dataset.theme as Theme) ?? "dark");
  }, []);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    apply(next, true);
    setTheme(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* 시크릿 모드 등에서는 저장 안 됨 */
    }
  };

  const dark = theme === "dark";
  return (
    <button
      onClick={toggle}
      className="flex h-9 w-9 items-center justify-center rounded-full bg-sunken text-ink-2 transition-colors hover:text-ink"
      aria-label={dark ? "라이트 모드로 바꾸기" : "다크 모드로 바꾸기"}
      title={dark ? "라이트 모드" : "다크 모드"}
    >
      {/* 마운트 전에는 빈 자리 (서버/클라이언트 불일치 방지) */}
      {theme === null ? null : dark ? (
        // 해
        <svg width="17" height="17" viewBox="0 0 20 20" aria-hidden>
          <circle cx="10" cy="10" r="3.6" fill="currentColor" />
          <g stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
            <path d="M10 1.8v2M10 16.2v2M1.8 10h2M16.2 10h2M4.2 4.2l1.4 1.4M14.4 14.4l1.4 1.4M4.2 15.8l1.4-1.4M14.4 5.6l1.4-1.4" />
          </g>
        </svg>
      ) : (
        // 달
        <svg width="16" height="16" viewBox="0 0 20 20" aria-hidden>
          <path d="M16.5 12.6A7 7 0 0 1 7.4 3.5a7 7 0 1 0 9.1 9.1Z" fill="currentColor" />
        </svg>
      )}
    </button>
  );
}
