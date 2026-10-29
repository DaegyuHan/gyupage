import Link from "next/link";
import { notFound } from "next/navigation";
import { Crest } from "@/components/football/icons";
import { getTeamSeason } from "@/lib/football/leagueExtras";
import { isLeagueId, LEAGUE_MAP } from "@/lib/football/leagues";
import { getLeaders, getStandings } from "@/lib/football/standings";
import type { MtMatch } from "@/lib/myteam";

type Props = { params: Promise<{ league: string; teamId: string }>; searchParams: Promise<{ name?: string }> };

export async function generateMetadata({ searchParams }: Props) {
  const { name } = await searchParams;
  return { title: `${name ?? "팀"} | 규페이지` };
}

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const kst = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000);
const dateText = (iso: string) => {
  const d = kst(iso);
  return `${d.getUTCMonth() + 1}.${d.getUTCDate()} (${WD[d.getUTCDay()]})`;
};
const timeText = (iso: string) => kst(iso).toISOString().slice(11, 16);
const result = (m: MtMatch) => (m.goalsFor == null || m.goalsAgainst == null ? null : m.goalsFor > m.goalsAgainst ? "W" : m.goalsFor < m.goalsAgainst ? "L" : "D");
const RES = { W: { t: "승", c: "#12a150" }, D: { t: "무", c: "#9aa3b2" }, L: { t: "패", c: "#e03a3a" } } as const;

function MatchLine({ m }: { m: MtMatch }) {
  const r = result(m);
  return (
    <li className="grid grid-cols-[76px_minmax(0,1fr)_auto] items-center gap-3 py-2.5 text-sm">
      <span className="text-xs text-ink-3">
        <span className="numeral block font-semibold text-ink-2">{dateText(m.kickoff)}</span>
        {m.competition}
      </span>
      <span className="flex min-w-0 items-center gap-2">
        <span className="w-7 shrink-0 text-[11px] text-ink-3">{m.home ? "홈" : "원정"}</span>
        <Crest src={m.opponent.logo} size={20} />
        <span className="truncate font-medium">{m.opponent.name}</span>
      </span>
      {m.state === "done" || m.state === "live" ? (
        <span className="flex items-center gap-2">
          <span className={`numeral tabular-nums font-bold ${m.state === "live" ? "text-[#d4483b]" : ""}`}>
            {m.goalsFor} : {m.goalsAgainst}
          </span>
          {r && m.state === "done" && (
            <span className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: RES[r].c }}>
              {RES[r].t}
            </span>
          )}
        </span>
      ) : m.state === "off" ? (
        <span className="text-xs text-ink-3">연기</span>
      ) : (
        <span className="numeral text-xs tabular-nums text-ink-2">{timeText(m.kickoff)}</span>
      )}
    </li>
  );
}

/** 팀 페이지: 순위표에서 팀 이름을 누르면 — 이번 시즌 일정·결과, 최근 흐름, 팀 내 개인 순위 */
export default async function TeamPage({ params, searchParams }: Props) {
  const { league: l, teamId: rawId } = await params;
  const { name: nameParam } = await searchParams;
  if (!isLeagueId(l)) notFound();
  const league = l;
  const teamId = decodeURIComponent(rawId);
  const info = LEAGUE_MAP[league];

  const [season, standings, leaders] = await Promise.all([
    getTeamSeason(league, teamId, nameParam ?? "").catch(() => null),
    getStandings(league).catch(() => null),
    getLeaders(league).catch(() => null),
  ]);
  const row = standings?.groups.flatMap((g) => g.rows).find((r) => r.teamId === teamId);
  const name = row?.team ?? season?.name ?? nameParam ?? "팀";
  const logo = row?.logo ?? season?.logo;
  const matches = season?.matches ?? [];
  const done = matches.filter((m) => m.state === "done");
  const upcoming = matches.filter((m) => m.state === "pre" || m.state === "live");
  const next = upcoming[0];
  const form = done.slice(-5);
  const wins = done.filter((m) => result(m) === "W").length;
  const draws = done.filter((m) => result(m) === "D").length;
  const losses = done.filter((m) => result(m) === "L").length;
  const gf = done.reduce((s, m) => s + (m.goalsFor ?? 0), 0);
  const ga = done.reduce((s, m) => s + (m.goalsAgainst ?? 0), 0);
  const mine = <T extends { teamId?: string; team: string }>(list: T[] = []): T[] => list.filter((p) => (p.teamId ? p.teamId === teamId : p.team === name));
  const myGoals = mine(leaders?.goals).slice(0, 5);
  const myAssists = mine(leaders?.assists).slice(0, 5);

  return (
    <div className="mx-auto max-w-6xl pt-6">
      <Link href={info.tab !== false ? `/football?league=${league}` : "/football"} className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {info.name} 순위
      </Link>

      <header className="mt-6 flex flex-wrap items-center gap-5 border-b border-line pb-8">
        <span className="flex h-20 w-20 items-center justify-center rounded-2xl bg-surface ring-1 ring-line">
          <Crest src={logo} size={56} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink-2">{info.name}</p>
          <h1 className="truncate text-4xl font-extrabold tracking-tight">{name}</h1>
          {form.length > 0 && (
            <div className="mt-2 flex items-center gap-1">
              <span className="mr-1 text-xs text-ink-3">최근 5경기</span>
              {form.map((m, i) => {
                const r = result(m);
                return r ? (
                  <span key={i} className="flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white" style={{ background: RES[r].c }} title={`${m.opponent.name} ${m.goalsFor}:${m.goalsAgainst}`}>
                    {RES[r].t}
                  </span>
                ) : null;
              })}
            </div>
          )}
        </div>
        {row && (
          <dl className="grid grid-cols-4 gap-x-6 gap-y-1 text-center">
            {[
              ["순위", `${row.rank}위`],
              ["승점", String(row.points)],
              ["전적", `${row.win}승 ${row.draw}무 ${row.lose}패`],
              ["득실", `${row.gf}:${row.ga}`],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs text-ink-3">{k}</dt>
                <dd className="numeral whitespace-nowrap text-lg font-extrabold">{v}</dd>
              </div>
            ))}
          </dl>
        )}
      </header>

      {!season ? (
        <p className="py-16 text-center text-ink-2">팀 일정을 불러오지 못했어요.</p>
      ) : (
        <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-10">
            {next && (
              <section className="rounded-2xl border border-line bg-surface p-5">
                <div className="text-xs font-semibold text-accent">{next.state === "live" ? "진행 중" : "다음 경기"}</div>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <Crest src={next.opponent.logo} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-extrabold">
                      {next.home ? "vs" : "@"} {next.opponent.name}
                    </div>
                    <div className="text-sm text-ink-2">
                      {dateText(next.kickoff)} {timeText(next.kickoff)} · {next.competition} · {next.home ? "홈" : "원정"}
                    </div>
                  </div>
                </div>
              </section>
            )}

            <section>
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-bold tracking-tight">이번 시즌 결과</h2>
                {done.length > 0 && (
                  <span className="text-sm text-ink-2">
                    {done.length}경기 {wins}승 {draws}무 {losses}패 · {gf}득점 {ga}실점
                  </span>
                )}
              </div>
              {done.length === 0 ? (
                <p className="text-sm text-ink-3">아직 끝난 경기가 없어요.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {[...done].reverse().map((m) => (
                    <MatchLine key={m.kickoff + m.opponent.name} m={m} />
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-10">
            <section>
              <h2 className="mb-2 text-xl font-bold tracking-tight">남은 일정</h2>
              {upcoming.length === 0 ? (
                <p className="text-sm text-ink-3">잡힌 일정이 없어요.</p>
              ) : (
                <ul className="divide-y divide-line-soft">
                  {upcoming.slice(0, 12).map((m) => (
                    <MatchLine key={m.kickoff + m.opponent.name} m={m} />
                  ))}
                </ul>
              )}
            </section>

            {(myGoals.length > 0 || myAssists.length > 0) && (
              <section>
                <h2 className="mb-3 text-xl font-bold tracking-tight">팀 내 기록</h2>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {(
                    [
                      ["득점", myGoals],
                      ["도움", myAssists],
                    ] as const
                  ).map(([label, list]) => (
                    <div key={label}>
                      <h3 className="mb-1 text-xs font-bold text-ink-2">{label}</h3>
                      <ol className="space-y-1">
                        {list.map((p) => (
                          <li key={p.name} className="flex items-center justify-between gap-2">
                            <span className="truncate">{p.name}</span>
                            <span className="numeral font-bold">{p.value}</span>
                          </li>
                        ))}
                        {list.length === 0 && <li className="text-ink-3">–</li>}
                      </ol>
                    </div>
                  ))}
                </div>
                <p className="mt-2 text-[11px] text-ink-3">리그 상위 20명 안에 든 선수만 보여요.</p>
              </section>
            )}
            <p className="text-xs text-ink-3">{league === "K1" || league === "K2" ? "자료: K리그 공식" : "자료: ESPN (리그·컵·유럽대회 모두)"}</p>
          </aside>
        </div>
      )}
    </div>
  );
}
