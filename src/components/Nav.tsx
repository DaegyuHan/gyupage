"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountButton from "./AccountButton";
import ThemeToggle from "./ThemeToggle";

const MENUS = [
  { href: "/", label: "홈", icon: "M3.5 9.5L10 4l6.5 5.5V16a1 1 0 0 1-1 1h-3.5v-4.5h-4V17H4.5a1 1 0 0 1-1-1z" },
  { href: "/calendar", label: "캘린더", icon: "M4 5.5h12a1 1 0 0 1 1 1V16a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6.5a1 1 0 0 1 1-1zM3 9h14M7 3.5v3M13 3.5v3" },
  { href: "/football", label: "축구", icon: "M10 3a7 7 0 1 0 0 14a7 7 0 0 0 0-14zM10 7l2.8 2-1 3.3H8.2l-1-3.3zM10 3v4M12.8 9l3.7-1.2M11.8 12.3l2.2 3M8.2 12.3l-2.2 3M7.2 9L3.5 7.8" },
  { href: "/reading", label: "독서", icon: "M10 5.5C8.5 4.5 6.5 4 3.5 4v11.5c3 0 5 .5 6.5 1.5 1.5-1 3.5-1.5 6.5-1.5V4c-3 0-5 .5-6.5 1.5zM10 5.5V17" },
  { href: "/history", label: "히스토리", icon: "M10 3.5a6.5 6.5 0 1 1-6.1 4.3M3.5 4v4h4M10 6.5V10l2.5 2" },
];

const isActive = (pathname: string, href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

/** 휴대폰: 화면 아래 탭 바 (아이폰 홈 바 영역만큼 띄움) */
function BottomTabs({ pathname }: { pathname: string }) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper/85 backdrop-blur-xl md:hidden"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom), 6px)" }}
      aria-label="메뉴"
    >
      <ul className="mx-auto grid max-w-md grid-cols-5">
        {MENUS.map((m) => {
          const active = isActive(pathname, m.href);
          return (
            <li key={m.href}>
              <Link
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-0.5 pb-1 pt-2 text-[10px] font-semibold transition-colors ${active ? "text-accent" : "text-ink-3"}`}
              >
                <svg viewBox="0 0 20 20" className="h-[22px] w-[22px]" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d={m.icon} />
                </svg>
                {m.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export default function Nav() {
  const pathname = usePathname();
  return (
    <>
    <header
      className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 pb-2 pt-6 sm:px-8"
      style={{ paddingTop: "max(env(safe-area-inset-top), 1.5rem)" }}
    >
      <Link href="/" className="flex shrink-0 items-baseline gap-1.5 text-[17px] font-extrabold tracking-tight">
        규페이지
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        {/* 넓은 화면: 위쪽 메뉴 / 휴대폰: 아래 탭 바 */}
        <nav className="hidden min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunken p-1 text-sm [scrollbar-width:none] md:flex [&::-webkit-scrollbar]:hidden">
          {MENUS.map((m) => {
            const active = isActive(pathname, m.href);
            return (
              <Link
                key={m.href}
                href={m.href}
                aria-current={active ? "page" : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 font-medium transition-colors sm:px-4 ${
                  active ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,28,43,0.08)]" : "text-ink-2 hover:text-ink"
                }`}
              >
                {m.label}
              </Link>
            );
          })}
        </nav>
        <ThemeToggle />
        <Link
          href="/settings"
          aria-label="설정"
          title="설정"
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition hover:bg-sunken hover:text-ink ${pathname.startsWith("/settings") ? "bg-sunken text-ink" : "text-ink-2"}`}
        >
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" aria-hidden>
            <path d="M10.3 3.6a1.7 1.7 0 0 1 3.4 0l.2 1a1.7 1.7 0 0 0 2.4 1.1l.9-.5a1.7 1.7 0 0 1 2.4 2.4l-.5.9a1.7 1.7 0 0 0 1.1 2.4l1 .2a1.7 1.7 0 0 1 0 3.4l-1 .2a1.7 1.7 0 0 0-1.1 2.4l.5.9a1.7 1.7 0 0 1-2.4 2.4l-.9-.5a1.7 1.7 0 0 0-2.4 1.1l-.2 1a1.7 1.7 0 0 1-3.4 0l-.2-1a1.7 1.7 0 0 0-2.4-1.1l-.9.5a1.7 1.7 0 0 1-2.4-2.4l.5-.9a1.7 1.7 0 0 0-1.1-2.4l-1-.2a1.7 1.7 0 0 1 0-3.4l1-.2a1.7 1.7 0 0 0 1.1-2.4l-.5-.9a1.7 1.7 0 0 1 2.4-2.4l.9.5a1.7 1.7 0 0 0 2.4-1.1z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
        </Link>
        <AccountButton />
      </div>
    </header>
    <BottomTabs pathname={pathname} />
    </>
  );
}
