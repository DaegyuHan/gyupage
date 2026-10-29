"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";

/** 설정 > 아이폰 캘린더 연동: '약속' 카테고리 구독 주소 */
export default function CalendarFeedSettings() {
  const [data, setData] = useState<{ webcal: string; https: string; local: boolean } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api<{ webcal: string; https: string; local: boolean }>("/api/calendar/feed-url")
      .then(setData)
      .catch((e) => setErr(String(e).replace(/^Error: /, "")));
  }, []);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.webcal);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErr("복사하지 못했어요. 아래 주소를 길게 눌러 복사해 주세요.");
    }
  };

  return (
    <section id="calendar-sync" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">아이폰 캘린더 연동</h2>
      <p className="mt-1 text-sm text-ink-2">
        캘린더의 <b>약속</b> 일정이 아이폰 기본 캘린더에 &lsquo;규페이지 약속&rsquo;으로 보여요. 규페이지 → 아이폰 한 방향이고, 보통 15분~1시간 안에 반영돼요.
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          {err && <p className="text-sm text-[#e5484d]">{err}</p>}
          {!data && !err && <div className="h-20 animate-pulse rounded-lg bg-sunken/70" />}
          {data && (
            <>
              {data.local && (
                <p className="rounded-lg bg-[#f5a524]/12 px-3 py-2 text-xs text-ink-2">지금은 내 PC 주소예요. 배포된 사이트의 설정에서 추가해야 아이폰에서 열려요.</p>
              )}
              <a
                href={data.webcal}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-on-accent"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
                  <rect x="3.5" y="5" width="17" height="15" rx="3" />
                  <path d="M3.5 10h17M8 3v4M16 3v4" strokeLinecap="round" />
                </svg>
                아이폰 캘린더에 추가
              </a>
              <div className="flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2.5 py-2 text-[11px] text-ink-2">{data.webcal}</code>
                <button onClick={copy} className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:border-ink-3">
                  {copied ? "복사됨" : "주소 복사"}
                </button>
              </div>
              <p className="text-[11px] text-ink-3">이 주소를 아는 사람은 약속을 볼 수 있어요. 새어 나가면 Vercel 에 CALENDAR_TOKEN 을 새로 넣으면 예전 주소는 막혀요.</p>
            </>
          )}
        </div>

        <ol className="space-y-2.5 rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed">
          {[
            <>아이폰에서 규페이지 설정을 열고 <b>아이폰 캘린더에 추가</b>를 눌러요.</>,
            <>&lsquo;구독&rsquo; 화면이 뜨면 <b>구독</b>을 눌러요. (안 뜨면 주소를 복사해서 설정 → 캘린더 → 계정 → 계정 추가 → 기타 → <b>구독한 캘린더 추가</b>에 붙여 넣기)</>,
            <>30분 전 알림을 받고 싶으면 <b>알림 제거</b>를 꺼 두세요.</>,
            <>아이폰 설정 → 캘린더 → 계정 → <b>데이터 가져오기</b>를 15분마다로 두면 더 빨리 반영돼요.</>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="numeral flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
