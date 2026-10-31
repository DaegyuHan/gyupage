"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { kickoffLabel } from "@/lib/football/format";
import type { Form, MtTeamRef, MyTeam } from "@/lib/myteam/types";

const FORM: Record<Form, { label: string; color: string }> = {
  W: { label: "승", color: "#0e8a6b" },
  D: { label: "무", color: "#8a94a6" },
  L: { label: "패", color: "#d64545" },
};

function Crest({ t, size = 28 }: { t: MtTeamRef; size?: number }) {
  const [broken, setBroken] = useState(false);
  if (!t.logo || broken) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-sunken text-[11px] font-bold text-ink-2"
        style={{ width: size, height: size }}
      >
        {t.name.slice(0, 1)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={t.logo}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      onError={() => setBroken(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}

/** "D-2", "오늘", "1시간 20분 뒤" */
function countdown(iso: string, now: number) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return { big: "경기 중", small: "" };
  const min = Math.floor(ms / 60000);
  if (min < 60) return { big: `${min}분`, small: "뒤 킥오프" };
  const h = Math.floor(min / 60);
  if (h < 24) return { big: `${h}시간 ${min % 60}분`, small: "뒤 킥오프" };
  const kst = (t: number) => Math.floor((t + 9 * 3600_000) / 86400000);
  return { big: `D-${kst(new Date(iso).getTime()) - kst(now)}`, small: "" };
}

function FormChips({ form }: { form: Form[] }) {
  return (
    <span className="flex gap-1" aria-label={`최근 5경기 ${form.map((f) => FORM[f].label).join(" ")}`}>
      {form.map((f, i) => (
        <span
          key={i}
          className={`flex h-[18px] w-[18px] items-center justify-center rounded-[5px] text-[10px] font-bold text-white ${i === form.length - 1 ? "ring-2 ring-offset-1 ring-offset-surface" : ""}`}
          style={{ background: FORM[f].color, ["--tw-ring-color" as string]: `color-mix(in oklab, ${FORM[f].color} 40%, transparent)` }}
        >
          {FORM[f].label}
        </span>
      ))}
    </span>
  );
}

/** 가장 가까운 경기 하나를 크게 */
function NextUp({ team, now }: { team: MyTeam; now: number }) {
  const n = team.next!;
  const live = n.state === "live";
  const cd = live ? { big: `${n.goalsFor ?? 0} : ${n.goalsAgainst ?? 0}`, small: "" } : countdown(n.kickoff, now);
  const home = n.home ? team : n.opponent;
  const away = n.home ? n.opponent : team;
  const Box = n.detailId ? Link : "div";
  return (
    <Box
      href={n.detailId ? `/football/match/${n.detailId}` : (undefined as unknown as string)}
      aria-label={n.detailId ? `${home.name} 대 ${away.name} 경기 상세` : undefined}
      className={`relative block overflow-hidden rounded-2xl p-4 ${n.detailId ? "transition hover:ring-1 hover:ring-line focus-visible:ring-2 focus-visible:ring-accent" : ""}`}
      style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${team.color} 16%, var(--color-surface)), var(--color-surface) 70%)` }}
    >
      <div className="flex items-center justify-between text-[11px] font-semibold text-ink-2">
        <span>
          {live ? (
            <span className="font-bold text-[#d4483b]">● 진행 중</span>
          ) : (
            "다음 경기"
          )}{" "}
          · <span style={{ color: team.color }}>{team.name}</span>
        </span>
        <span className="flex items-center gap-1">
          {n.competition}
          {n.detailId && (
            <svg width="6" height="10" viewBox="0 0 8 12" aria-hidden className="text-ink-3">
              <path d="M1.5 1 6.5 6l-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Crest t={home} size={40} />
          <span className="w-full truncate text-[13px] font-bold">{home.name}</span>
        </div>
        <div className="text-center">
          <div className="numeral text-2xl font-extrabold leading-none tracking-tight" style={{ color: team.color }}>
            {cd.big}
          </div>
          {cd.small && <div className="mt-1 text-[10px] text-ink-3">{cd.small}</div>}
          <div className="mt-1.5 text-[11px] font-medium tabular-nums text-ink-2">{kickoffLabel(n.kickoff, new Date(now))}</div>
        </div>
        <div className="flex min-w-0 flex-col items-center gap-1.5 text-center">
          <Crest t={away} size={40} />
          <span className="w-full truncate text-[13px] font-bold">{away.name}</span>
        </div>
      </div>
    </Box>
  );
}

function TeamRow({ team, now }: { team: MyTeam; now: number }) {
  const last = team.last;
  const res =
    last && last.goalsFor != null && last.goalsAgainst != null
      ? last.goalsFor > last.goalsAgainst
        ? "W"
        : last.goalsFor < last.goalsAgainst
          ? "L"
          : "D"
      : null;
  return (
    <li className="py-3">
      <div className="flex items-center gap-2.5">
        <Crest t={team} size={26} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14px] font-bold">{team.name}</div>
          <div className="text-[11px] text-ink-3">
            {team.league}
            {team.rank != null && (
              <>
                {" "}
                <span className="font-semibold text-ink-2">{team.rank}위</span>
              </>
            )}
            {team.points != null && ` · ${team.points}점`}
          </div>
        </div>
        <FormChips form={team.form} />
      </div>
      <dl className="mt-2 grid grid-cols-[34px_1fr] gap-x-2 gap-y-1 pl-[36px] text-[12px]">
        {team.next && (
          <>
            <dt className="text-ink-3">다음</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              <span className="shrink-0 tabular-nums text-ink-2">{kickoffLabel(team.next.kickoff, new Date(now))}</span>
              <span className="truncate font-medium">
                vs {team.next.opponent.name} <span className="text-ink-3">({team.next.home ? "홈" : "원정"})</span>
              </span>
            </dd>
          </>
        )}
        {last && res && (
          <>
            <dt className="text-ink-3">지난</dt>
            <dd className="flex min-w-0 items-center gap-1.5">
              <span className="numeral shrink-0 font-bold tabular-nums" style={{ color: FORM[res].color }}>
                {last.goalsFor}:{last.goalsAgainst} {FORM[res].label}
              </span>
              <span className="truncate text-ink-2">
                vs {last.opponent.name} <span className="text-ink-3">· {last.competition}</span>
              </span>
            </dd>
          </>
        )}
      </dl>
    </li>
  );
}

/** 홈: 응원하는 팀(바이에른·수원 삼성·맨유) 다음 경기 카운트다운과 최근 흐름 */
export default function MyTeamCard() {
  const [teams, setTeams] = useState<MyTeam[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const load = () =>
      fetch("/api/myteam")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { teams: MyTeam[] }) => {
          setTeams(d.teams);
          setFailed(false);
        })
        .catch(() => setFailed(true));
    load();
    const poll = setInterval(load, 10 * 60_000);
    const tick = setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  // 목록은 정해 둔 순서(수원 삼성 → 바이에른 → 맨유), 맨 위 카운트다운만 킥오프가 가장 가까운 경기
  const sorted = teams ?? [];
  const first = [...sorted].filter((t) => t.next).sort((a, b) => a.next!.kickoff.localeCompare(b.next!.kickoff))[0];

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="font-bold">My Team</h2>
        <span className="ml-auto text-[11px] text-ink-3">최근 5경기 · 오른쪽이 최신</span>
      </div>
      {failed && !teams && <p className="text-sm text-ink-3">팀 정보를 불러오지 못했어요.</p>}
      {!teams && !failed && <div className="h-64 rounded-2xl bg-sunken/70" aria-busy="true" />}
      {teams && (
        <>
          {first && <NextUp team={first} now={now} />}
          <ul className="mt-1 divide-y divide-line-soft">
            {sorted.map((t) => (
              <TeamRow key={t.id} team={t} now={now} />
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
