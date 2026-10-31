import Link from "next/link";
import LeaderTabs from "@/components/football/LeaderTabs";
import LeagueNews from "@/components/football/LeagueNews";
import StandingsTable from "@/components/football/StandingsTable";
import WeekSchedule from "@/components/football/WeekSchedule";
import { getLeagueNews, getLeagueWeek, type WeekSchedule as Week } from "@/lib/football/leagueExtras";
import { currentSeason, isLeagueId, LEAGUE_MAP, LEAGUES, seasonLabel } from "@/lib/football/leagues";
import { getLeaders, getStandings, type Leaders, type Standings } from "@/lib/football/standings";
import type { LeagueId } from "@/lib/football/types";
import type { NewsItem } from "@/lib/news";

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

  const [standings, leaders, week, news] = await Promise.all([
    settle<Standings>(getStandings(league)),
    settle<Leaders>(getLeaders(league)),
    settle<Week>(getLeagueWeek(league)),
    settle<NewsItem[]>(getLeagueNews(league)),
  ]);
  const noKey = false;
  const isK = league === "K1" || league === "K2";

  return (
    <div className="pt-6">
      {/* 리그 선택 */}
      <nav aria-label="리그" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
        <ul className="flex gap-1.5 whitespace-nowrap">
          {LEAGUES.filter((l) => l.tab !== false).map((l) => {
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
          <li>
            <Link
              href="/football/predictions"
              className="flex items-center gap-1.5 rounded-full border border-dashed border-line px-4 py-2 text-sm font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent"
            >
              🤖 AI 예측 성적
            </Link>
          </li>
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

          {/* 이번 주 일정·결과 */}
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight">이번 주 일정·결과</h2>
            {week.ok ? <WeekSchedule week={week.v} /> : <p className="text-sm text-ink-3">경기 일정을 불러오지 못했어요.</p>}
            <p className="mt-3 text-xs text-ink-3">{isK ? "K리그 공식 일정이에요." : "경기를 누르면 득점·통계·라인업·하이라이트를 볼 수 있어요."}</p>
          </div>

          {/* 리그 뉴스 */}
          <div className="mt-12">
            <h2 className="mb-4 text-xl font-bold tracking-tight">{info.name} 뉴스</h2>
            {news.ok ? <LeagueNews items={news.v} /> : <p className="text-sm text-ink-3">뉴스를 불러오지 못했어요.</p>}
          </div>
        </section>

        <aside className="space-y-10">
          {/* 득점 · 도움 · 공격포인트 */}
          <section>
            <h2 className="mb-3 font-bold">개인 순위</h2>
            {leaders.ok ? (
              <LeaderTabs data={leaders.v} note={isK ? "K리그 공식" : "ESPN · 공격포인트는 득점·도움 상위 선수로 계산"} />
            ) : (
              <p className="text-sm text-ink-3">개인 순위를 불러오지 못했어요.</p>
            )}
          </section>
        </aside>
      </div>
    </div>
  );
}
