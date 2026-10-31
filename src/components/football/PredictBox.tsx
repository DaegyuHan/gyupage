"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import type { AiPrediction, Side } from "@/lib/football/aiPrediction";
import type { MatchStatus } from "@/lib/football/types";

interface Team {
  name: string;
  score: number | null;
}
interface Props {
  matchId: string;
  kickoff: string;
  status: MatchStatus;
  home: Team;
  away: Team;
}

const HOME_C = "var(--color-accent)";
const AWAY_C = "#e5484d";
const DRAW_C = "color-mix(in oklab, var(--color-ink-3) 55%, transparent)";

const outcome = (h: number, a: number) => (h > a ? "home" : h < a ? "away" : "draw");

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

function SideTag({ side, home, away }: { side: Side; home: string; away: string }) {
  const s = side === "home" ? { t: `${home} 유리`, c: HOME_C } : side === "away" ? { t: `${away} 유리`, c: AWAY_C } : { t: "중립", c: "var(--color-ink-3)" };
  return (
    <span className="shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold" style={{ color: s.c, borderColor: `color-mix(in oklab, ${s.c} 45%, transparent)` }}>
      {s.t}
    </span>
  );
}

function Result({ p, home, away, finished }: { p: AiPrediction; home: Team; away: Team; finished: boolean }) {
  const bar = [
    { k: "home", v: p.home, c: HOME_C, label: `${home.name} 승` },
    { k: "draw", v: p.draw, c: DRAW_C, label: "무승부" },
    { k: "away", v: p.away, c: AWAY_C, label: `${away.name} 승` },
  ];
  // 끝난 경기는 실제 결과와 비교
  const grade =
    finished && home.score != null && away.score != null
      ? p.score[0] === home.score && p.score[1] === away.score
        ? { t: "스코어까지 적중 🎯", c: "#12a150" }
        : outcome(p.score[0], p.score[1]) === outcome(home.score, away.score)
          ? { t: "승부 적중 ✓", c: "#0e8a6b" }
          : { t: `빗나감 · 실제 ${home.score}:${away.score}`, c: "#e5484d" }
      : null;
  const before = p.createdAt < Date.parse(p.kickoff);

  return (
    <div className="mt-5 space-y-6">
      {/* 결론 */}
      <div className="rounded-xl bg-sunken/60 p-4">
        <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-3">
          <span>예상 스코어</span>
          <span className="rounded-full bg-surface px-2 py-0.5 text-ink-2">확신도 {p.confidence}</span>
          {grade && (
            <span className="ml-auto rounded-full px-2.5 py-1 font-bold text-white" style={{ background: grade.c }}>
              {grade.t}
            </span>
          )}
        </div>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <span className="truncate text-right text-sm font-bold">{home.name}</span>
          <span className="numeral text-4xl font-extrabold tabular-nums">
            {p.score[0]} : {p.score[1]}
          </span>
          <span className="truncate text-sm font-bold">{away.name}</span>
        </div>
        <p className="mt-3 text-center text-base font-bold">{p.headline}</p>
      </div>

      {/* 확률 */}
      <div>
        <div className="flex h-3 overflow-hidden rounded-full bg-sunken">
          {bar.map((b) => (
            <span key={b.k} style={{ width: `${b.v}%`, background: b.c }} />
          ))}
        </div>
        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
          {bar.map((b, i) => (
            <span key={b.k} className={`min-w-0 ${i === 1 ? "text-center" : i === 2 ? "text-right" : ""}`}>
              <span className="numeral block text-lg font-extrabold tabular-nums text-ink">{b.v}%</span>
              <span className="block truncate text-ink-3">{b.label}</span>
            </span>
          ))}
        </div>
      </div>

      {/* 요약 */}
      <p className="text-[15px] leading-7 text-ink-2">{p.summary}</p>

      {/* 근거 */}
      <div>
        <h3 className="mb-3 text-sm font-bold">이렇게 예측한 이유</h3>
        <ol className="space-y-3">
          {p.reasons.map((r, i) => (
            <li key={i} className="rounded-xl border border-line-soft p-4">
              <div className="flex items-start justify-between gap-3">
                <span className="font-bold">
                  <span className="numeral mr-1.5 text-ink-3">{i + 1}</span>
                  {r.title}
                </span>
                <SideTag side={r.side} home={home.name} away={away.name} />
              </div>
              <p className="mt-2 text-sm leading-6 text-ink-2">{r.detail}</p>
            </li>
          ))}
        </ol>
      </div>

      {(p.injuries?.home || p.injuries?.away) && (
        <TwoCol title="부상·결장" home={home.name} away={away.name} a={p.injuries?.home} b={p.injuries?.away} />
      )}
      {(p.lineups?.home || p.lineups?.away) && (
        <TwoCol
          title={p.lineups?.confirmed ? "선발 명단 (공식 발표)" : "예상 선발"}
          home={home.name}
          away={away.name}
          a={p.lineups?.home}
          b={p.lineups?.away}
        />
      )}
      {p.odds ? (
        <VsMarket p={p} home={home.name} away={away.name} />
      ) : (
        p.market && (
          <div>
            <h3 className="mb-2 text-sm font-bold">배당·전문가 예측</h3>
            <p className="rounded-xl bg-sunken/40 px-4 py-3 text-sm leading-6 text-ink-2">{p.market}</p>
          </div>
        )
      )}

      {(p.keyPlayers.home || p.keyPlayers.away) && (
        <div>
          <h3 className="mb-3 text-sm font-bold">주목할 선수</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              [home.name, p.keyPlayers.home, HOME_C],
              [away.name, p.keyPlayers.away, AWAY_C],
            ]
              .filter((x) => x[1])
              .map(([t, s, c]) => (
                <div key={t} className="rounded-xl border-l-4 bg-sunken/40 px-4 py-3 text-sm leading-6" style={{ borderColor: c }}>
                  <div className="text-xs font-bold text-ink-3">{t}</div>
                  {s}
                </div>
              ))}
          </div>
        </div>
      )}

      {p.risk && (
        <div className="rounded-xl bg-[#e5484d]/8 px-4 py-3 text-sm leading-6">
          <div className="mb-1 text-xs font-bold text-[#e5484d]">이 예측이 틀릴 수 있는 이유</div>
          <span className="text-ink-2">{p.risk}</span>
        </div>
      )}

      {p.sources && p.sources.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer font-semibold text-ink-3 hover:text-ink">참고한 웹 페이지 {p.sources.length}곳</summary>
          <ul className="mt-2 space-y-1.5">
            {p.sources.map((s) => (
              <li key={s.url}>
                <a href={s.url} target="_blank" rel="noreferrer" className="line-clamp-1 text-ink-2 hover:text-accent">
                  {s.title} ↗
                </a>
              </li>
            ))}
          </ul>
        </details>
      )}

      <p className="text-[11px] leading-5 text-ink-3">
        Claude ({p.model}) · {ago(p.createdAt)}
        {p.usage && ` · 입력 ${(p.usage.input / 1000).toFixed(1)}k·출력 ${(p.usage.output / 1000).toFixed(1)}k 토큰 · 검색 ${p.usage.searches}회`} {before ? "경기 전 예측" : ""} · 자료: {p.basis.join(", ") || "경기 기본 정보"}
        <br />
        AI 예측은 틀릴 수 있어요. 선발이 발표되는 킥오프 1시간 전쯤 다시 예측하면 더 정확해요.{" "}
        <Link href="/football/predictions" className="font-semibold text-ink-2 underline-offset-2 hover:text-accent hover:underline">
          AI 예측 성적 보기 →
        </Link>
      </p>
    </div>
  );
}

/** AI 확률 vs 배당(시장) 확률 — AI 는 배당을 안 보고 예측해서 둘을 비교할 수 있음 */
function VsMarket({ p, home, away }: { p: AiPrediction; home: string; away: string }) {
  const o = p.odds!;
  const inv = [o.home, o.draw, o.away].map((x) => 1 / x);
  const sum = inv.reduce((a, b) => a + b, 0);
  const market = inv.map((x) => Math.round((x / sum) * 100));
  const ai = [p.home, p.draw, p.away];
  const dec = [o.home, o.draw, o.away];
  const rows = [`${home} 승`, "무승부", `${away} 승`].map((label, i) => ({
    label,
    ai: ai[i],
    market: market[i],
    diff: ai[i] - market[i],
    odd: dec[i],
    // AI 확률대로라면 1만 원 걸었을 때 평균 기대 손익
    ev: Math.round((ai[i] / 100) * dec[i] * 10000 - 10000),
  }));
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold">AI vs 배당</h3>
        <span className="text-[11px] text-ink-3">
          {o.provider} 배당 · AI 는 배당을 보지 않고 예측했어요
        </span>
      </div>
      <div className="overflow-hidden rounded-xl border border-line-soft text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_52px_52px_56px_64px] gap-1 bg-sunken/60 px-3 py-2 text-[11px] font-semibold text-ink-3">
          <span>결과</span>
          <span className="text-right">AI</span>
          <span className="text-right">배당</span>
          <span className="text-right">차이</span>
          <span className="text-right">배당률</span>
        </div>
        {rows.map((r) => {
          const big = r.diff >= 5;
          return (
            <div key={r.label} className={`grid grid-cols-[minmax(0,1fr)_52px_52px_56px_64px] items-center gap-1 border-t border-line-soft px-3 py-2.5 ${big ? "bg-accent/8" : ""}`}>
              <span className="truncate font-semibold">{r.label}</span>
              <span className="numeral text-right font-bold tabular-nums">{r.ai}%</span>
              <span className="numeral text-right tabular-nums text-ink-2">{r.market}%</span>
              <span className={`numeral text-right font-bold tabular-nums ${r.diff >= 5 ? "text-accent" : r.diff <= -5 ? "text-[#e5484d]" : "text-ink-3"}`}>
                {r.diff > 0 ? "+" : ""}
                {r.diff}%p
              </span>
              <span className="numeral text-right tabular-nums text-ink-2">{r.odd.toFixed(2)}</span>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] leading-5 text-ink-3">
        AI 가 배당보다 5%p 이상 높게 본 결과를 강조했어요
        {rows.some((r) => r.diff >= 5) &&
          ` (AI 확률이 맞다면 1만 원당 평균 ${rows
            .filter((r) => r.diff >= 5)
            .map((r) => `${r.label} ${r.ev >= 0 ? "+" : ""}${r.ev.toLocaleString("ko-KR")}원`)
            .join(", ")})`}
        . 차이가 크면 시장이 놓친 걸 수도 있지만, AI 가 모르는 정보가 배당에 반영됐을 가능성이 더 높아요.
      </p>
    </div>
  );
}

function TwoCol({ title, home, away, a, b }: { title: string; home: string; away: string; a?: string; b?: string }) {
  return (
    <div>
      <h3 className="mb-3 text-sm font-bold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        {[
          [home, a, HOME_C],
          [away, b, AWAY_C],
        ].map(([t, s, c]) => (
          <div key={t} className="rounded-xl border-l-4 bg-sunken/40 px-4 py-3 text-sm leading-6" style={{ borderColor: c }}>
            <div className="text-xs font-bold text-ink-3">{t}</div>
            <span className="text-ink-2">{s || "확인 못 함"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** 경기 상세: '승부 예측 보기' → Claude 가 경기 결과를 예측하고 이유를 설명 */
export default function PredictBox({ matchId, kickoff, status, home, away }: Props) {
  const { authed, loading } = useAuth();
  const [saved, setSaved] = useState<AiPrediction | null | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const before = status === "scheduled" && Date.parse(kickoff) > Date.now();
  const finished = status === "finished";

  useEffect(() => {
    if (!authed) return;
    api<{ prediction: AiPrediction | null }>(`/api/ai-predict?id=${encodeURIComponent(matchId)}`)
      .then((r) => setSaved(r.prediction))
      .catch(() => setSaved(null));
  }, [authed, matchId]);

  const run = async (refresh = false) => {
    setBusy(true);
    setErr(null);
    setOpen(true);
    try {
      const r = await api<{ prediction: AiPrediction }>("/api/ai-predict", { method: "POST", body: { id: matchId, refresh } });
      setSaved(r.prediction);
    } catch (e) {
      setErr(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  if (loading || !authed) return null;
  // 시작한 경기인데 경기 전에 받아 둔 예측도 없으면 보여줄 게 없음
  if (!before && saved === null) return null;
  if (saved === undefined) return null;

  const onClick = () => (saved ? setOpen((o) => !o) : run());
  const canRefresh = !!saved && before && Date.now() - saved.createdAt > 3600_000;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold tracking-tight">승부 예측</h2>
          <p className="text-xs text-ink-3">{saved ? `Claude 가 ${ago(saved.createdAt)} 예측했어요` : "Claude 가 부상·선발까지 검색해서 배당과 따로 예측해요"}</p>
        </div>
        <button
          type="button"
          onClick={onClick}
          disabled={busy}
          aria-expanded={open}
          className="inline-flex items-center gap-2 rounded-full bg-accent px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:brightness-110 disabled:opacity-70"
        >
          {busy ? (
            <>
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden />
              분석 중…
            </>
          ) : open && saved ? (
            "접기"
          ) : (
            "🤖 승부 예측 보기"
          )}
        </button>
      </div>

      {busy && !saved && <p className="mt-4 text-sm text-ink-3">Claude 가 부상·선발을 검색하고 분석 중이에요. 30초~1분쯤 걸려요.</p>}
      {err && <p className="mt-4 text-sm text-[#e5484d]">{err}</p>}
      {open && saved && (
        <>
          <Result p={saved} home={home} away={away} finished={finished} />
          {canRefresh && (
            <button type="button" onClick={() => run(true)} disabled={busy} className="mt-4 text-xs font-semibold text-ink-3 underline-offset-2 hover:text-accent hover:underline">
              최신 자료로 다시 예측하기
            </button>
          )}
        </>
      )}
    </section>
  );
}
