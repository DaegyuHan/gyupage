"use client";

import Link from "next/link";
import { useState } from "react";
import { CS_CATEGORY, type CsCategory, type CsNote } from "@/lib/cs/types";
import { formatKorean } from "@/lib/date";
import { CsChip } from "./CsCard";
import { useCsRead } from "./useCsRead";

/** Daily CS 전체 글: 분야별로 걸러 보기 */
export default function CsList({ notes, sample }: { notes: CsNote[]; sample: boolean }) {
  const { read } = useCsRead();
  const [cat, setCat] = useState<CsCategory | "all">("all");
  const cats = [...new Set(notes.map((n) => n.category))];
  const shown = cat === "all" ? notes : notes.filter((n) => n.category === cat);
  const readCount = notes.filter((n) => read.has(n.date)).length;

  return (
    <div className="mx-auto max-w-[860px] pb-16">
      <header className="grid gap-6 border-b border-line pb-8 pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="flex items-center gap-3 text-4xl font-extrabold tracking-tight sm:text-5xl">
            Daily CS
            {sample && <span className="rounded-md bg-sunken px-2 py-1 text-xs font-bold tracking-normal text-ink-2">예시</span>}
          </h1>
          <p className="mt-3 text-ink-2">평일 아침마다 2년차 개발자가 알면 좋을 CS 한 편이 쌓여요.</p>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="numeral text-4xl font-extrabold">{notes.length}</div>
            <div className="text-sm text-ink-2">전체</div>
          </div>
          <div>
            <div className="numeral text-4xl font-extrabold text-[#0e8a6b]">{readCount}</div>
            <div className="text-sm text-ink-2">읽음</div>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {(["all", ...cats] as const).map((c) => {
          const on = cat === c;
          const color = c === "all" ? undefined : CS_CATEGORY[c].color;
          return (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setCat(c)}
              className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${on ? "border-transparent bg-ink text-paper" : "border-line text-ink-2 hover:border-ink-3"}`}
              style={on && color ? { background: color, color: "#fff" } : undefined}
            >
              {c === "all" ? "전체" : CS_CATEGORY[c].label}
            </button>
          );
        })}
      </div>

      <ul className="mt-6 divide-y divide-line-soft">
        {shown.map((n) => (
          <li key={n.date}>
            <Link href={`/cs/${n.date}`} className="group grid gap-x-6 gap-y-1 py-5 sm:grid-cols-[110px_1fr]">
              <div className="text-sm text-ink-3">
                <div className="numeral font-bold text-ink-2">No.{n.no}</div>
                <div>{formatKorean(n.date)}</div>
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <CsChip category={n.category} />
                  {read.has(n.date) && <span className="text-[11px] font-semibold text-[#0e8a6b]">✓ 읽음</span>}
                </div>
                <h2 className="mt-1.5 text-lg font-bold leading-snug group-hover:text-accent">{n.title}</h2>
                <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-ink-2">{n.summary}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
