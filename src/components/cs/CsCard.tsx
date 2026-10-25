"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CS_CATEGORY, type CsCategory, type CsNote } from "@/lib/cs/types";
import { formatKorean } from "@/lib/date";
import { useCsRead } from "./useCsRead";

export function CsChip({ category, size = "sm" }: { category: CsCategory; size?: "sm" | "md" }) {
  const c = CS_CATEGORY[category];
  return (
    <span
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full font-bold ${size === "md" ? "px-2.5 py-1 text-xs" : "px-2 py-0.5 text-[11px]"}`}
      style={{ color: c.color, background: `color-mix(in oklab, ${c.color} 13%, var(--color-surface))` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: c.color }} />
      {c.label}
    </span>
  );
}

function ReadMark({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#0e8a6b]">
      <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      읽음
    </span>
  );
}

/** 홈: 오늘의 CS — 오늘 글은 크게, 지난 글은 옆에 목록으로 */
type CsBrief = Pick<CsNote, "date" | "no" | "category" | "title" | "summary" | "minutes" | "keywords">;

export default function CsCard() {
  const [notes, setNotes] = useState<CsBrief[] | null>(null);
  const [sample, setSample] = useState(false);
  const { read } = useCsRead();

  useEffect(() => {
    fetch("/api/cs")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { sample: boolean; notes: CsBrief[] }) => {
        setNotes(d.notes);
        setSample(d.sample);
      })
      .catch(() => setNotes([]));
  }, []);

  if (!notes) return <div className="h-[220px] rounded-2xl bg-sunken/70" aria-busy="true" />;
  const [today, ...past] = notes;
  if (!today) return null;
  const color = CS_CATEGORY[today.category].color;

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="flex items-center gap-2 text-2xl font-extrabold tracking-tight">
          Daily CS
          {sample && (
            <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-bold tracking-normal text-ink-2">예시</span>
          )}
        </h2>
        <span className="text-xs text-ink-3">평일 아침 · 2년차 개발자를 위한 CS 한 편</span>
      </div>

      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        {/* 오늘 글 */}
        <Link
          href={`/cs/${today.date}`}
          className="group relative flex flex-col overflow-hidden rounded-2xl border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-ink-3/40 hover:shadow-[0_10px_30px_-12px_rgb(20_28_43/0.25)]"
        >
          {/* 분야 색 띠 */}
          <span className="absolute inset-y-0 left-0 w-1" style={{ background: color }} aria-hidden />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-3">
            <CsChip category={today.category} />
            <span className="numeral font-bold text-ink-2">No.{today.no}</span>
            <span>{formatKorean(today.date)}</span>
            <span>· {today.minutes}분</span>
            <span className="ml-auto">
              <ReadMark on={read.has(today.date)} />
            </span>
          </div>

          <h3 className="mt-3 text-xl font-extrabold leading-snug tracking-tight group-hover:text-accent sm:text-[22px]">{today.title}</h3>
          <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-ink-2">{today.summary}</p>

          <div className="mt-auto flex flex-wrap items-center gap-1.5 pt-4">
            {today.keywords.slice(0, 4).map((k) => (
              <span key={k} className="rounded-md bg-sunken px-2 py-0.5 text-[11px] font-medium text-ink-2">
                #{k}
              </span>
            ))}
            <span className="ml-auto inline-flex items-center gap-1 text-sm font-bold text-accent">
              자세히 읽기
              <span className="transition group-hover:translate-x-0.5" aria-hidden>
                →
              </span>
            </span>
          </div>
        </Link>

        {/* 지난 글 */}
        <div className="min-w-0">
          <div className="mb-1 flex items-center justify-between">
            <h3 className="text-sm font-bold text-ink-2">지난 글</h3>
            <Link href="/cs" className="text-xs font-semibold text-ink-3 hover:text-accent">
              전체 보기
            </Link>
          </div>
          {past.length === 0 && <p className="py-3 text-sm text-ink-3">아직 지난 글이 없어요. 평일마다 한 편씩 쌓여요.</p>}
          <ul className="divide-y divide-line-soft">
            {past.slice(0, 4).map((n) => (
              <li key={n.date}>
                <Link href={`/cs/${n.date}`} className="group block py-2.5">
                  <div className="flex items-center gap-2 text-[11px] text-ink-3">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: CS_CATEGORY[n.category].color }} />
                    {CS_CATEGORY[n.category].label}
                    <span className="tabular-nums">· {n.date.slice(5).replace("-", ".")}</span>
                    {read.has(n.date) && <span className="ml-auto text-[#0e8a6b]">✓</span>}
                  </div>
                  <div
                    className={`mt-0.5 truncate text-[14px] font-medium group-hover:text-accent ${read.has(n.date) ? "text-ink-2" : ""}`}
                    title={n.title}
                  >
                    {n.title}
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
