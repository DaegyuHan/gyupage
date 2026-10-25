"use client";

import { useEffect, useState } from "react";
import type { LolSummary } from "@/lib/games/lol";

const GOLD = "#c89b3c";
const WIN = "#3b82f6";
const LOSS = "#e5484d";
const SAVE_KEY = "gyupage.lol.last";

const TIER_KO: Record<string, string> = {
  IRON: "아이언",
  BRONZE: "브론즈",
  SILVER: "실버",
  GOLD: "골드",
  PLATINUM: "플래티넘",
  EMERALD: "에메랄드",
  DIAMOND: "다이아몬드",
  MASTER: "마스터",
  GRANDMASTER: "그랜드마스터",
  CHALLENGER: "챌린저",
};
const RANK_NUM: Record<string, string> = { I: "1", II: "2", III: "3", IV: "4" };
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function savedAgo(iso: string) {
  const h = Math.floor((Date.now() - Date.parse(iso)) / 3600_000);
  if (h < 1) return "방금";
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

function DayBars({ days }: { days: LolSummary["days"] }) {
  const max = Math.max(3, ...days.map((d) => d.games));
  return (
    <div className="relative grid h-[130px] grid-cols-7 items-end gap-2">
      {days.every((d) => d.games === 0) && (
        <span className="absolute inset-x-0 top-8 text-center text-[11px] text-ink-3">이번 주는 플레이한 판이 없어요</span>
      )}
      {days.map((d, i) => {
        const today = i === days.length - 1;
        const dow = WEEK[new Date(`${d.date}T12:00:00+09:00`).getUTCDay()];
        const h = (n: number) => `${(n / max) * 88}px`;
        return (
          <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1" title={`${d.date} · ${d.games}판 ${d.wins}승 ${d.losses}패`}>
            <span className={`numeral text-[11px] tabular-nums ${d.games ? "font-extrabold" : "text-ink-3"}`}>{d.games || "–"}</span>
            <span className="flex w-full max-w-[28px] flex-col overflow-hidden rounded-t-md">
              {d.games === 0 ? (
                <span className="h-[3px] bg-sunken" />
              ) : (
                <>
                  <span style={{ height: h(d.losses), background: LOSS, opacity: 0.85 }} />
                  <span style={{ height: h(d.wins), background: WIN }} />
                </>
              )}
            </span>
            <span className={`text-[10px] ${today ? "font-bold" : "text-ink-3"}`} style={today ? { color: GOLD } : undefined}>
              {today ? "오늘" : dow}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function Setup() {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-sm leading-relaxed text-ink-2">
      <p className="font-bold text-ink">LoL 연결 준비</p>
      <p className="mt-2">
        <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">.env.local</code> 에{" "}
        <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">RIOT_API_KEY</code> 와{" "}
        <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">RIOT_ID</code>(게임이름#태그)를 넣으면 최근 7일 판수가 나와요.
      </p>
    </div>
  );
}

/** LoL 탭: 최근 7일 하루 판수와 승패 */
export default function LolPanel() {
  const [data, setData] = useState<LolSummary | null>(null);
  const [stale, setStale] = useState<string | null>(null);
  const [setup, setSetup] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const fallback = (why: string) => {
      // 키가 만료돼도 마지막 기록은 보여줌
      try {
        const last = JSON.parse(localStorage.getItem(SAVE_KEY) ?? "null") as LolSummary | null;
        if (last) {
          setData(last);
          setStale(why);
          return;
        }
      } catch {}
      setFailed(why);
    };
    fetch("/api/lol")
      .then(async (r) => {
        const j = await r.json();
        if (j.setup) return setSetup(true);
        if (!r.ok) return fallback(j.expired ? "Riot API 키가 만료됐어요" : (j.detail ?? j.error ?? "불러오지 못했어요"));
        setData(j as LolSummary);
        try {
          localStorage.setItem(SAVE_KEY, JSON.stringify(j));
        } catch {}
      })
      .catch(() => fallback("불러오지 못했어요"));
  }, []);

  if (setup) return <Setup />;
  if (failed) return <p className="py-6 text-sm text-ink-3">LoL 기록을 불러오지 못했어요. ({failed})</p>;
  if (!data) return <div className="h-[200px] rounded-2xl bg-sunken/70" aria-busy="true" />;

  const { total } = data;
  const rate = total.games ? Math.round((total.wins / total.games) * 100) : 0;
  const [name, tag] = data.riotId.split("#");

  return (
    <div>
      {stale && (
        <p className="mb-4 rounded-lg bg-[#f59f00]/10 px-3 py-2 text-xs font-medium text-[#b26b00]">
          {stale}. {savedAgo(data.updatedAt)}에 받아 둔 기록을 보여주고 있어요.
        </p>
      )}
      <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
        <div className="min-w-0">
          <div className="flex items-center gap-4">
            <div className="relative shrink-0">
              {data.icon ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={data.icon} alt="" width={64} height={64} className="h-16 w-16 rounded-2xl ring-2" style={{ ["--tw-ring-color" as string]: GOLD }} />
              ) : (
                <div className="h-16 w-16 rounded-2xl bg-sunken" />
              )}
              {data.level != null && (
                <span className="numeral absolute -bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-ink px-1.5 py-px text-[10px] font-bold text-paper">
                  {data.level}
                </span>
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate text-xl font-extrabold tracking-tight">
                {name}
                <span className="ml-1 text-sm font-semibold text-ink-3">#{tag}</span>
              </div>
              <div className="mt-1 text-[12px] text-ink-2">
                {data.solo ? (
                  <>
                    <span className="font-bold" style={{ color: GOLD }}>
                      솔로랭크 {TIER_KO[data.solo.tier] ?? data.solo.tier}
                      {!["MASTER", "GRANDMASTER", "CHALLENGER"].includes(data.solo.tier) && ` ${RANK_NUM[data.solo.rank] ?? data.solo.rank}`}
                    </span>{" "}
                    {data.solo.lp}LP · {data.solo.wins}승 {data.solo.losses}패
                  </>
                ) : (
                  <span className="text-ink-3">솔로랭크 기록 없음</span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-3 gap-2">
            <div className="rounded-xl bg-sunken/60 px-3 py-2.5">
              <div className="text-[11px] text-ink-3">이번 주</div>
              <div className="numeral mt-0.5 text-[17px] font-extrabold">
                {total.games}
                <span className="text-xs font-bold text-ink-3">판</span>
              </div>
            </div>
            <div className="rounded-xl bg-sunken/60 px-3 py-2.5">
              <div className="text-[11px] text-ink-3">승패</div>
              <div className="numeral mt-0.5 text-[17px] font-extrabold">
                <span style={{ color: WIN }}>{total.wins}</span>
                <span className="text-xs text-ink-3"> / </span>
                <span style={{ color: LOSS }}>{total.losses}</span>
              </div>
            </div>
            <div className="rounded-xl bg-sunken/60 px-3 py-2.5">
              <div className="text-[11px] text-ink-3">승률</div>
              <div className="numeral mt-0.5 text-[17px] font-extrabold">
                {total.games ? rate : "–"}
                {total.games > 0 && <span className="text-xs font-bold text-ink-3">%</span>}
              </div>
            </div>
          </div>

          {data.topChamps.length > 0 && (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <span className="text-[11px] font-bold text-ink-2">많이 한 챔피언</span>
              {data.topChamps.map((c) => (
                <span key={c.name} className="flex items-center gap-1.5 text-[12px]" title={`${c.name} ${c.games}판 ${c.wins}승`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={c.icon} alt="" width={22} height={22} className="h-[22px] w-[22px] rounded-md" />
                  <span className="numeral font-semibold tabular-nums">{c.games}판</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="min-w-0 lg:border-l lg:border-line-soft lg:pl-8">
          <div className="mb-2 flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold text-ink-2">최근 7일 판수</h3>
            <span className="flex items-center gap-2 text-[10px] text-ink-3">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: WIN }} />승
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-sm" style={{ background: LOSS }} />패
              </span>
            </span>
          </div>
          <DayBars days={data.days} />
        </div>
      </div>
    </div>
  );
}
