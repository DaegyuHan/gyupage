"use client";

import { useEffect, useState } from "react";
import type { EsportsMatch, EsportsResponse, EsportsTeam } from "@/lib/esports";
import { kickoffLabel } from "@/lib/football/format";

const TEAM_COLOR: Record<string, string> = { T1: "#e2012d", HLE: "#f37321" };

/** 팀 로고 (대부분 어두운 배경용이라 짙은 타일 위에 올림) */
function Logo({ t, size = 24 }: { t: EsportsTeam; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center rounded-md bg-[#141a24] ring-1 ring-inset ring-white/5"
      style={{ width: size, height: size }}
    >
      {t.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={t.image} alt="" width={size - 6} height={size - 6} loading="lazy" className="object-contain" style={{ width: size - 6, height: size - 6 }} />
      )}
    </span>
  );
}

function TeamCell({ t, align }: { t: EsportsTeam; align: "left" | "right" }) {
  const right = align === "right";
  return (
    <span className={`min-w-0 ${right ? "text-right" : ""}`}>
      {/* 로고와 팀 코드를 한 줄에서 가운데 맞춤 */}
      <span className={`flex min-w-0 items-center gap-2 ${right ? "flex-row-reverse" : ""}`}>
        <Logo t={t} />
        <span
          className={`truncate text-[13px] leading-6 ${t.mine ? "font-extrabold" : "font-medium text-ink-2"}`}
          style={t.mine ? { color: TEAM_COLOR[t.code] } : undefined}
        >
          {t.code}
        </span>
      </span>
      {/* 전적은 팀 코드 바로 아래 (로고 폭만큼 들여씀) */}
      {t.record && (
        <span className={`block text-[10px] leading-tight tabular-nums text-ink-3 ${right ? "pr-8" : "pl-8"}`}>
          {t.record.wins}승 {t.record.losses}패
        </span>
      )}
    </span>
  );
}

/**
 * 끝난 경기 → 네이버 검색 "2026년 10월 29일 Movistar KOI T1"
 * (날짜는 한국 시간, 상대 팀 → 응원 팀 순서, 팀 이름은 풀네임)
 */
function highlightUrl(m: EsportsMatch) {
  const d = new Date(Date.parse(m.start) + 9 * 3600_000);
  const date = `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  const teams = [...m.teams].sort((x, y) => Number(x.mine) - Number(y.mine));
  const q = `${date} ${teams.map((t) => t.name || t.code).join(" ")}`.replace(/\s+/g, " ").trim();
  return `https://search.naver.com/search.naver?query=${encodeURIComponent(q)}`;
}

function Row({ m }: { m: EsportsMatch }) {
  const [a, b] = m.teams;
  const live = m.state === "inProgress";
  const done = m.state === "completed";
  const mine = m.teams.find((t) => t.mine);
  const won = done && mine?.outcome === "win";

  const body = (
    <>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[11px] text-ink-3">
        <span className="truncate">
          {m.league}
          {m.block && ` · ${m.block}`} · Bo{m.bestOf}
        </span>
        {live ? (
          <span className="flex shrink-0 items-center gap-1 font-bold text-[#d4483b]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4483b] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#d4483b]" />
            </span>
            진행 중
          </span>
        ) : (
          <span className="shrink-0 tabular-nums">{kickoffLabel(m.start)}</span>
        )}
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-2">
        <TeamCell t={a} align="left" />
        {done || live ? (
          <span className="flex h-6 items-center">
            <span className={`numeral rounded-md px-2 text-[15px] font-extrabold leading-6 tabular-nums ${live ? "bg-[#d4483b]/10 text-[#d4483b]" : "bg-sunken"}`}>
              {a.wins ?? 0} : {b.wins ?? 0}
            </span>
          </span>
        ) : (
          <span className="text-xs font-medium leading-6 text-ink-3">vs</span>
        )}
        <TeamCell t={b} align="right" />
      </div>
      {done && mine && (
        <div className="mt-1 text-right">
          <span
            className="rounded-full px-2 py-0.5 text-[10px] font-bold"
            style={
              won
                ? { color: "#0e8a6b", background: "color-mix(in oklab, #0e8a6b 14%, var(--color-surface))" }
                : { color: "#c92a2a", background: "color-mix(in oklab, #e03a3a 12%, var(--color-surface))" }
            }
          >
            {mine.name} {won ? "승리" : "패배"}
          </span>
        </div>
      )}
    </>
  );

  // 끝난 경기는 누르면 하이라이트 검색으로
  if (done) {
    return (
      <li>
        <a
          href={highlightUrl(m)}
          target="_blank"
          rel="noopener noreferrer"
          title="네이버에서 하이라이트 보기"
          className="group -mx-2 block rounded-xl px-2 py-2.5 transition-colors hover:bg-sunken/70"
        >
          {body}
          <span className="mt-1 flex items-center justify-end gap-1 text-[10px] font-semibold text-ink-3 group-hover:text-accent">
            하이라이트 보기
            <svg width="9" height="9" viewBox="0 0 12 12" aria-hidden>
              <path d="M4 2h6v6M10 2 3 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        </a>
      </li>
    );
  }
  return <li className="py-2.5">{body}</li>;
}

/** LoL e스포츠: T1·한화생명 다음 경기와 팀별 최근 결과 */
export default function EsportsCard() {
  const [data, setData] = useState<EsportsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const load = () =>
      fetch("/api/esports")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: EsportsResponse) => {
          setData(d);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    const t = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-bold">LoL e스포츠</h2>
        <span className="ml-auto flex gap-1">
          {[
            ["T1", "T1"],
            ["HLE", "한화생명"],
          ].map(([code, name]) => (
            <span
              key={code}
              className="rounded-full px-2 py-0.5 text-[11px] font-bold"
              style={{ color: TEAM_COLOR[code], background: `color-mix(in oklab, ${TEAM_COLOR[code]} 12%, var(--color-surface))` }}
            >
              {name}
            </span>
          ))}
        </span>
      </div>

      {failed && <p className="text-sm text-ink-3">e스포츠 일정을 불러오지 못했어요.</p>}
      {!data && !failed && <div className="h-28 rounded-xl bg-sunken/70" aria-busy="true" />}

      {data && (
        <div className="space-y-4">
          <div>
            <h3 className="text-xs font-bold text-ink-2">다음 경기</h3>
            {data.upcoming.length === 0 ? (
              <p className="py-2 text-sm text-ink-3">잡힌 경기가 없어요.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {data.upcoming.map((m) => (
                  <Row key={m.id} m={m} />
                ))}
              </ul>
            )}
          </div>
          {data.recent.length > 0 && (
            <div>
              <h3 className="text-xs font-bold text-ink-2">최근 결과</h3>
              <ul className="divide-y divide-line-soft">
                {data.recent.map((m) => (
                  <Row key={m.id} m={m} />
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
