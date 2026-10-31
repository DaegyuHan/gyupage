"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import { aiPick, marketProbs, outcomeOf, type AiPrediction, type RecordStats } from "@/lib/football/aiPrediction";
import { LEAGUE_MAP } from "@/lib/football/leagues";
import type { LeagueId } from "@/lib/football/types";

type Item = Pick<AiPrediction, "matchId" | "kickoff" | "home" | "draw" | "away" | "score" | "home_name" | "away_name" | "league" | "result" | "odds" | "confidence" | "headline">;

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const when = (iso: string) => {
  const d = new Date(Date.parse(iso) + 9 * 3600_000);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()} (${WD[d.getUTCDay()]}) ${d.toISOString().slice(11, 16)}`;
};
const won = (n: number) => `${n > 0 ? "+" : ""}${n.toLocaleString("ko-KR")}원`;
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "–");

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <div className="text-xs font-semibold text-ink-3">{label}</div>
      <div className={`numeral mt-1 text-2xl font-extrabold tabular-nums ${tone === "good" ? "text-[#12a150]" : tone === "bad" ? "text-[#e5484d]" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-ink-3">{sub}</div>}
    </div>
  );
}

function Row({ p }: { p: Item }) {
  const pick = aiPick(p);
  const names = { home: `${p.home_name ?? "홈"} 승`, draw: "무승부", away: `${p.away_name ?? "원정"} 승` };
  const real = p.result ? outcomeOf(p.result.home, p.result.away) : null;
  const exact = p.result && p.result.home === p.score[0] && p.result.away === p.score[1];
  const mk = p.odds ? marketProbs(p.odds).map((x) => Math.round(x * 100)) : null;
  const ai = [p.home, p.draw, p.away];
  const value = mk ? ai.map((v, i) => v - mk[i] >= 5) : null;
  const badge = !p.result
    ? { t: Date.parse(p.kickoff) > Date.now() ? "경기 전" : "채점 대기", c: "var(--color-ink-3)", bg: "transparent" }
    : exact
      ? { t: "스코어 적중", c: "#fff", bg: "#12a150" }
      : real === pick
        ? { t: "승부 적중", c: "#fff", bg: "#0e8a6b" }
        : { t: "빗나감", c: "#fff", bg: "#e5484d" };
  return (
    <li>
      <Link href={`/football/match/${p.matchId}`} className="grid gap-2 rounded-xl px-3 py-3 transition hover:bg-sunken/50 sm:grid-cols-[110px_minmax(0,1fr)_auto] sm:items-center sm:gap-4">
        <div className="text-xs text-ink-3">
          <span className="numeral block font-semibold text-ink-2">{when(p.kickoff)}</span>
          {p.league && LEAGUE_MAP[p.league as LeagueId]?.name}
        </div>
        <div className="min-w-0">
          <div className="truncate font-bold">
            {p.home_name ?? "?"} <span className="text-ink-3">vs</span> {p.away_name ?? "?"}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-ink-2">
            <span>
              AI 픽 <b className="text-ink">{names[pick]}</b> {ai[["home", "draw", "away"].indexOf(pick)]}%
            </span>
            <span>
              예상 <b className="numeral text-ink">{p.score[0]}:{p.score[1]}</b>
            </span>
            {mk && (
              <span className="text-ink-3">
                배당 {mk[0]}/{mk[1]}/{mk[2]}%
                {value?.some(Boolean) && <b className="ml-1 text-accent">· 가치: {(["home", "draw", "away"] as const).filter((_, i) => value[i]).map((k) => names[k]).join(", ")}</b>}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 sm:justify-end">
          {p.result && (
            <span className="numeral text-lg font-extrabold tabular-nums">
              {p.result.home}:{p.result.away}
            </span>
          )}
          <span className="rounded-full px-2.5 py-1 text-[11px] font-bold" style={{ color: badge.c, background: badge.bg, border: badge.bg === "transparent" ? "1px solid var(--color-line)" : undefined }}>
            {badge.t}
          </span>
        </div>
      </Link>
    </li>
  );
}

/** AI 승부 예측 성적표 — 적중률, 배당(시장)과 비교, 가상 베팅 손익 */
export default function AiRecord() {
  const { authed, loading } = useAuth();
  const [data, setData] = useState<{ stats: RecordStats; items: Item[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authed) return;
    api<{ stats: RecordStats; items: Item[] }>("/api/ai-predict/record")
      .then(setData)
      .catch((e) => setErr(String(e).replace(/^Error: /, "")));
  }, [authed]);

  const s = data?.stats;
  return (
    <div className="mx-auto max-w-5xl pt-6">
      <Link href="/football" className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        축구
      </Link>
      <header className="mt-6 border-b border-line pb-6">
        <h1 className="text-4xl font-extrabold tracking-tight">AI 예측 성적</h1>
        <p className="mt-2 text-sm text-ink-2">Claude 가 배당을 보지 않고 낸 예측이 실제로 얼마나 맞았는지, 시장(배당)보다 나았는지 기록해요.</p>
      </header>

      {!loading && !authed && <p className="py-16 text-center text-ink-2">로그인하면 볼 수 있어요.</p>}
      {err && <p className="py-8 text-center text-[#e5484d]">{err}</p>}
      {authed && !data && !err && <div className="mt-8 h-40 animate-pulse rounded-2xl bg-sunken/70" />}

      {s && data && (
        <>
          <section className="mt-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="채점된 예측" value={`${s.settled}경기`} sub={`전체 ${s.total}경기 · 나머지는 경기 전·대기`} />
            <Stat label="승부 적중률 (AI 픽)" value={pct(s.pickHits, s.settled)} sub={`${s.pickHits}/${s.settled} · 스코어 적중 ${s.scoreHits}`} />
            <Stat
              label="배당 1순위 적중률"
              value={pct(s.marketPickHits, s.withOdds)}
              sub={`같은 경기 비교 · 배당 있던 ${s.withOdds}경기`}
            />
            <Stat
              label="정확도 점수 (낮을수록 좋음)"
              value={s.brierAi != null ? s.brierAi.toFixed(3) : "–"}
              sub={s.brierMarket != null ? `배당 ${s.brierMarket.toFixed(3)} · ${s.brierAi! < s.brierMarket ? "AI 가 더 정확" : "배당이 더 정확"}` : "배당 있는 경기가 끝나면 계산"}
              tone={s.brierAi != null && s.brierMarket != null ? (s.brierAi < s.brierMarket ? "good" : "bad") : undefined}
            />
          </section>

          <section className="mt-3 grid gap-3 sm:grid-cols-2">
            <Stat
              label="가상 베팅 ① AI 픽에 매번 1만 원"
              value={s.betAll.bets ? won(s.betAll.profit) : "–"}
              sub={s.betAll.bets ? `${s.betAll.bets}번 · 수익률 ${Math.round((s.betAll.profit / (s.betAll.bets * 10000)) * 100)}%` : "배당 있는 경기가 끝나면 계산"}
              tone={s.betAll.bets ? (s.betAll.profit >= 0 ? "good" : "bad") : undefined}
            />
            <Stat
              label="가상 베팅 ② AI 가 배당보다 5%p↑ 본 결과에만 1만 원"
              value={s.betValue.bets ? won(s.betValue.profit) : "–"}
              sub={s.betValue.bets ? `${s.betValue.bets}번 · 수익률 ${Math.round((s.betValue.profit / (s.betValue.bets * 10000)) * 100)}%` : "해당 경기가 끝나면 계산"}
              tone={s.betValue.bets ? (s.betValue.profit >= 0 ? "good" : "bad") : undefined}
            />
          </section>

          <p className="mt-3 text-[11px] leading-5 text-ink-3">
            정확도 점수는 브라이어 점수예요. 확률을 얼마나 잘 맞혔는지 재는 값이라 픽 적중률보다 공정한 비교예요. 경기 수가 30~50개는 넘어야 우연이 아닌 차이로 볼 수 있어요. 가상 베팅은 예측 당시 배당 기준이고 실제 토토 배당과는 달라요.
          </p>

          <section className="mt-10">
            <h2 className="mb-2 text-xl font-bold tracking-tight">예측 기록</h2>
            {data.items.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-3">아직 예측이 없어요. 경기 상세에서 &lsquo;승부 예측 보기&rsquo;를 눌러 보세요.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.items.map((p) => (
                  <Row key={p.matchId} p={p} />
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}
