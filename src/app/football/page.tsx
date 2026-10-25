import Link from "next/link";
import MatchRow from "@/components/football/MatchRow";
import StandingsTable from "@/components/football/StandingsTable";
import TopScorers from "@/components/football/TopScorers";
import { addDays, kstDate } from "@/lib/football/kst";
import { currentSeason, isLeagueId, LEAGUE_MAP, LEAGUES, seasonLabel } from "@/lib/football/leagues";
import { fetchApiFootball, splitByDay } from "@/lib/football/providers";
import { getStandings, getTopScorers, type Scorer, type Standings } from "@/lib/football/standings";
import type { LeagueId, Match } from "@/lib/football/types";

export const metadata = { title: "축구 | 규페이지" };

type Props = { searchParams: Promise<{ league?: string }> };

async function settle<T>(p: Promise<T>): Promise<{ ok: true; v: T } | { ok: false; noKey: boolean; why: string }> {
  try {
    return { ok: true, v: await p };
  } catch (e) {
    console.error("[football page]", e);
    const why = e instanceof Error ? e.message : String(e);
    return { ok: false, noKey: why === "NO_KEY", why };
  }
}

export default async function FootballPage({ searchParams }: Props) {
  const { league: q } = await searchParams;
  const league: LeagueId = isLeagueId(q) ? q : "K1";
  const info = LEAGUE_MAP[league];
  const season = currentSeason(league);

  const today = kstDate(new Date());
  const yesterday = addDays(today, -1);

  const [standings, scorers, fixtures] = await Promise.all([
    settle<Standings>(getStandings(league)),
    settle<Scorer[]>(getTopScorers(league)),
    settle<Match[]>(fetchApiFootball(yesterday, today)),
  ]);

  const days = fixtures.ok ? splitByDay(fixtures.v.filter((m) => m.league === league), yesterday, today) : null;
  const noKey = [standings, scorers, fixtures].some((r) => !r.ok && r.noKey);

  return (
    <div className="pt-6">
      {/* 리그 선택 */}
      <nav aria-label="리그" className="-mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {LEAGUES.map((l) => {
            const on = l.id === league;
            return (
              <li key={l.id}>
                <Link
                  href={`/football?league=${l.id}`}
                  aria-current={on ? "page" : undefined}
                  className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                    on ? "border-ink bg-ink text-paper" : "border-line bg-surface text-ink-2 hover:text-ink"
                  }`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: l.color }} />
                  {l.name}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 리그 제목 */}
      <header className="mt-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div className="flex items-end gap-4">
          <span className="mb-2 h-12 w-2 rounded-full" style={{ background: info.color }} />
          <div>
            <p className="text-sm text-ink-2">{seasonLabel(league, season)}</p>
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">{info.name}</h1>
          </div>
        </div>
        {standings.ok && standings.v.groups[0]?.rows[0] && (
          <div className="text-right text-sm text-ink-2">
            선두{" "}
            <span className="font-bold text-ink">{standings.v.groups[0].rows[0].team}</span>
            <span className="numeral ml-2 text-2xl font-extrabold text-ink">{standings.v.groups[0].rows[0].points}</span>
            <span className="ml-0.5">점</span>
          </div>
        )}
      </header>

      {noKey && <p className="mt-6 rounded-lg bg-accent-soft px-4 py-3 text-sm text-ink-2">API 키가 없어서 순위를 불러올 수 없어요. README 의 축구 항목을 확인해 주세요.</p>}

      <div className="mt-8 grid gap-10 xl:grid-cols-[minmax(0,1fr)_360px]">
        {/* 순위표 */}
        <section aria-label="순위표">
          {standings.ok ? (
            <StandingsTable s={standings.v} />
          ) : (
            !noKey && (
              <div className="py-16 text-center text-sm text-ink-2">
                <p>순위표를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>
                {!standings.ok && <p className="mt-2 text-xs text-ink-3">{standings.why}</p>}
              </div>
            )
          )}
        </section>

        <aside className="space-y-10">
          {/* 이 리그 경기 */}
          <section>
            <h2 className="mb-3 font-bold">{info.name} 경기</h2>
            {!days ? (
              <p className="text-sm text-ink-3">경기 정보를 불러오지 못했어요.</p>
            ) : days.yesterday.length + days.today.length === 0 ? (
              <p className="text-sm text-ink-3">어제와 오늘은 {info.name} 경기가 없어요.</p>
            ) : (
              <div className="space-y-4">
                {(
                  [
                    ["오늘", days.today],
                    ["어제", days.yesterday],
                  ] as const
                )
                  .filter(([, list]) => list.length > 0)
                  .map(([label, list]) => (
                    <div key={label}>
                      <h3 className="text-xs font-bold text-ink-2">{label}</h3>
                      <ul className="divide-y divide-line-soft">
                        {list.map((m) => (
                          <MatchRow key={m.id} m={m} />
                        ))}
                      </ul>
                    </div>
                  ))}
              </div>
            )}
          </section>

          {/* 득점 순위 */}
          <section>
            <h2 className="mb-3 font-bold">득점 순위</h2>
            {scorers.ok ? <TopScorers list={scorers.v} /> : <p className="text-sm text-ink-3">득점 순위를 불러오지 못했어요.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}
