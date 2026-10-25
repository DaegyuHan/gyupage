"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import AccountButton from "./AccountButton";
import ThemeToggle from "./ThemeToggle";

const MENUS = [
  { href: "/", label: "홈" },
  { href: "/calendar", label: "캘린더" },
  { href: "/football", label: "축구" },
  { href: "/history", label: "히스토리" },
];

export default function Nav() {
  const pathname = usePathname();
  return (
    <header className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-5 pt-6 pb-2 sm:px-8">
      <Link href="/" className="flex shrink-0 items-baseline gap-1.5 text-[17px] font-extrabold tracking-tight">
        규페이지
        <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden />
      </Link>
      <div className="flex min-w-0 items-center gap-2">
        <nav className="flex min-w-0 items-center gap-0.5 overflow-x-auto rounded-full bg-sunken p-1 text-sm">
          {MENUS.map((m) => {
            const active = m.href === "/" ? pathname === "/" : pathname.startsWith(m.href);
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
        <AccountButton />
      </div>
    </header>
  );
}
