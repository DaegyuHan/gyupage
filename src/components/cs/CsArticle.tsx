"use client";

import Link from "next/link";
import { Marked } from "marked";
import { useEffect, useMemo, useState } from "react";
import { CS_CATEGORY, type CsNote } from "@/lib/cs/types";
import { formatKorean } from "@/lib/date";
import { CsChip } from "./CsCard";
import { useCsRead } from "./useCsRead";

const marked = new Marked({ gfm: true });

/**
 * 한글에서 '**굵게**이' 처럼 닫는 ** 뒤에 글자가 바로 붙으면 마크다운 규칙상 굵게가 안 먹어서
 * 코드 블록 밖의 **…** 를 미리 <strong> 으로 바꿔 둠
 */
function fixKoreanBold(md: string) {
  return md
    .split(/(```[\s\S]*?```|`[^`\n]*`)/)
    .map((part, i) => (i % 2 ? part : part.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")))
    .join("");
}

function Md({ source }: { source: string }) {
  const html = useMemo(() => marked.parse(fixKoreanBold(source), { async: false }) as string, [source]);
  return (
    <div
      className="prose prose-neutral max-w-none dark:prose-invert prose-headings:tracking-tight prose-h2:mb-3 prose-h2:mt-10 prose-h2:text-xl prose-p:leading-[1.8] prose-li:my-1 prose-strong:text-ink prose-code:rounded prose-code:bg-sunken prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[0.85em] prose-code:font-medium prose-code:before:content-none prose-code:after:content-none prose-table:text-sm prose-th:bg-sunken prose-th:px-3 prose-th:py-2 prose-td:px-3 prose-td:py-2 [&_table]:overflow-hidden [&_table]:rounded-lg"
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function Block({ label, icon, children }: { label: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-6">
      <h2 className="mb-3 flex items-center gap-2 text-base font-extrabold">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent-soft text-accent">{icon}</span>
        {label}
      </h2>
      {children}
    </section>
  );
}

const Icon = {
  work: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="6" width="14" height="10" rx="2" />
      <path d="M7.5 6V4.5h5V6" />
    </svg>
  ),
  ask: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path d="M4 5h12v8H9l-3.5 3v-3H4z" strokeLinejoin="round" />
    </svg>
  ),
  quiz: (
    <svg viewBox="0 0 20 20" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="10" cy="10" r="7" />
      <path d="M8 8a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V11.5M10 14h.01" strokeLinecap="round" />
    </svg>
  ),
};

function Reveal({ text, label }: { text: string; label: string }) {
  const [open, setOpen] = useState(false);
  return open ? (
    <p className="anim-fade mt-2 rounded-xl bg-sunken/70 p-4 text-[14px] leading-[1.8] text-ink-2">{text}</p>
  ) : (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="mt-2 w-full rounded-xl border border-dashed border-line py-3 text-sm font-semibold text-ink-2 transition hover:border-accent hover:text-accent"
    >
      {label}
    </button>
  );
}

function Interview({ interview }: { interview: CsNote["interview"] }) {
  const follow = interview.followUps ?? [];
  return (
    <>
      <p className="text-[15px] font-semibold leading-relaxed">Q. {interview.question}</p>
      <Reveal text={interview.answer} label="먼저 답을 떠올려 보고, 눌러서 모범 답안 보기" />
      {follow.length > 0 && (
        <div className="mt-5 space-y-4 border-t border-line-soft pt-4">
          <p className="text-xs font-bold text-ink-3">면접관의 꼬리 질문</p>
          {follow.map((f, i) => (
            <div key={i}>
              <p className="text-[14px] font-semibold leading-relaxed">
                <span className="mr-1 text-accent">↳</span>
                {f.question}
              </p>
              <Reveal text={f.answer} label="답 보기" />
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function Quiz({ quiz }: { quiz: CsNote["quiz"] }) {
  const [pick, setPick] = useState<number | null>(null);
  const done = pick !== null;
  const right = pick === quiz.answer;
  return (
    <>
      <p className="text-[15px] font-semibold leading-relaxed">{quiz.question}</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {quiz.options.map((o, i) => {
          const isAnswer = i === quiz.answer;
          const state = !done ? "idle" : isAnswer ? "right" : i === pick ? "wrong" : "dim";
          return (
            <button
              key={o}
              type="button"
              disabled={done}
              onClick={() => setPick(i)}
              className={`flex items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm font-medium transition ${
                state === "idle"
                  ? "border-line hover:border-accent hover:bg-accent-soft/40"
                  : state === "right"
                    ? "border-[#0e8a6b] bg-[#0e8a6b]/10 text-[#0e8a6b]"
                    : state === "wrong"
                      ? "border-[#e03a3a] bg-[#e03a3a]/10 text-[#c92a2a]"
                      : "border-line-soft text-ink-3"
              } disabled:cursor-default`}
            >
              <span
                className={`numeral flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                  state === "idle" ? "bg-sunken text-ink-2" : state === "dim" ? "bg-sunken text-ink-3" : "bg-current/15"
                }`}
              >
                {state === "right" ? "✓" : state === "wrong" ? "✕" : i + 1}
              </span>
              <span className="min-w-0 break-keep">{o}</span>
            </button>
          );
        })}
      </div>
      {done && (
        <div className="anim-fade mt-4 flex flex-wrap items-start gap-3 rounded-xl bg-sunken/70 p-4 text-[14px] leading-relaxed">
          <span className={`font-extrabold ${right ? "text-[#0e8a6b]" : "text-[#c92a2a]"}`}>{right ? "정답!" : "아쉬워요"}</span>
          <span className="min-w-0 flex-1 text-ink-2">{quiz.explain}</span>
          <button type="button" onClick={() => setPick(null)} className="text-xs font-semibold text-ink-3 hover:text-accent">
            다시 풀기
          </button>
        </div>
      )}
    </>
  );
}

function NavCard({ note, dir }: { note: CsNote | null; dir: "prev" | "next" }) {
  if (!note) return <div />;
  return (
    <Link
      href={`/cs/${note.date}`}
      className={`group rounded-2xl border border-line bg-surface p-4 transition hover:border-ink-3/40 ${dir === "next" ? "text-right" : ""}`}
    >
      <div className="text-xs text-ink-3">{dir === "prev" ? "← 이전 글" : "다음 글 →"}</div>
      <div className="mt-1 truncate text-sm font-bold group-hover:text-accent">{note.title}</div>
      <div className="mt-1 text-[11px]" style={{ color: CS_CATEGORY[note.category].color }}>
        {CS_CATEGORY[note.category].label}
      </div>
    </Link>
  );
}

export default function CsArticle({ note, prev, next, sample = false }: { note: CsNote; prev: CsNote | null; next: CsNote | null; sample?: boolean }) {
  const { read, set, canMark } = useCsRead();
  const isRead = read.has(note.date);
  const color = CS_CATEGORY[note.category].color;

  // 글을 바꿔 들어오면 맨 위부터
  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [note.date]);

  return (
    <article className="mx-auto max-w-[760px] pb-16">
      <div className="flex items-center justify-between pt-4 text-sm">
        <Link href="/" className="font-semibold text-ink-2 hover:text-accent">
          ← 홈
        </Link>
        <Link href="/cs" className="font-semibold text-ink-3 hover:text-accent">
          전체 글
        </Link>
      </div>

      <header className="border-b border-line pb-8 pt-8">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-ink-3">
          <CsChip category={note.category} size="md" />
          <span className="numeral font-bold text-ink-2">Daily CS No.{note.no}</span>
          <span>{formatKorean(note.date)}</span>
          <span>· 읽는 데 {note.minutes}분</span>
          {sample && <span className="rounded-md bg-sunken px-1.5 py-0.5 text-[11px] font-bold text-ink-2">예시</span>}
        </div>
        <h1 className="mt-4 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">{note.title}</h1>
        <p className="mt-5 border-l-[3px] pl-4 text-[16px] leading-[1.8] text-ink-2" style={{ borderColor: color }}>
          {note.summary}
        </p>
      </header>

      <div className="pt-2">
        <Md source={note.body} />
      </div>

      <div className="mt-12 space-y-5">
        <Block label="실무에서는" icon={Icon.work}>
          <Md source={note.practice} />
        </Block>
        <Block label="이직 면접에서 나온다면" icon={Icon.ask}>
          <Interview key={note.date} interview={note.interview} />
        </Block>
        <Block label="확인 퀴즈" icon={Icon.quiz}>
          <Quiz key={note.date} quiz={note.quiz} />
        </Block>
      </div>

      <div className="mt-10">
        <h2 className="mb-3 text-sm font-bold text-ink-2">같이 보면 좋은 키워드</h2>
        <div className="flex flex-wrap gap-2">
          {note.keywords.map((k) => (
            <a
              key={k}
              href={`https://www.google.com/search?q=${encodeURIComponent(k)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink-2 transition hover:border-accent hover:text-accent"
            >
              #{k}
            </a>
          ))}
        </div>
      </div>

      <div className="mt-12 flex justify-center">
        {!canMark ? (
          <Link href={`/login?next=/cs/${note.date}`} className="text-sm font-semibold text-ink-3 hover:text-accent">
            로그인하면 읽음 표시를 남길 수 있어요
          </Link>
        ) : (
        <button
          type="button"
          onClick={() => set(note.date, !isRead)}
          className={`inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-bold transition ${
            isRead ? "bg-[#0e8a6b]/12 text-[#0e8a6b] hover:bg-[#0e8a6b]/20" : "bg-ink text-paper hover:opacity-90"
          }`}
        >
          <svg viewBox="0 0 16 16" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
            <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {isRead ? "다 읽었어요" : "다 읽음으로 표시"}
        </button>
        )}
      </div>

      <nav className="mt-10 grid grid-cols-2 gap-3">
        <NavCard note={prev} dir="prev" />
        <NavCard note={next} dir="next" />
      </nav>
    </article>
  );
}
