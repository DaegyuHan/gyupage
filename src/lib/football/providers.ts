import { addDays, kstDate } from "./kst";
import { afGet, cached, TTL } from "./apiFootball";
import { API_FOOTBALL_LEAGUES, FOOTBALL_DATA_CODES, teamName } from "./leagues";
import type { Match, MatchStatus } from "./types";

/** football-data.org(예비용) 캐시 시간 */
const TTL_TODAY = 60 * 30;

/* ───────── 해외: football-data.org ───────── */

interface FDMatch {
  id: number;
  utcDate: string;
  status: string;
  minute?: number | null;
  competition: { code: string };
  homeTeam: { name: string; shortName?: string; crest?: string };
  awayTeam: { name: string; shortName?: string; crest?: string };
  score: { fullTime: { home: number | null; away: number | null } };
}

function fdStatus(s: string): MatchStatus {
  if (s === "IN_PLAY" || s === "PAUSED" || s === "LIVE") return "live";
  if (s === "FINISHED" || s === "AWARDED") return "finished";
  if (s === "POSTPONED" || s === "SUSPENDED" || s === "CANCELLED") return "postponed";
  return "scheduled";
}

/** KST 어제~오늘을 덮도록 UTC 기준으로 넉넉히 조회한 뒤, 호출한 쪽에서 KST 날짜로 나눔 */
export async function fetchOverseas(yesterday: string, today: string): Promise<Match[]> {
  const token = process.env.FOOTBALL_DATA_TOKEN;
  if (!token) throw new Error("NO_KEY");

  const url = new URL("https://api.football-data.org/v4/matches");
  url.searchParams.set("competitions", FOOTBALL_DATA_CODES.join(","));
  url.searchParams.set("dateFrom", addDays(yesterday, -1));
  url.searchParams.set("dateTo", addDays(today, 1));

  const res = await fetch(url, {
    headers: { "X-Auth-Token": token },
    next: { revalidate: TTL_TODAY },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`football-data ${res.status} ${detail.slice(0, 150)}`);
  }
  const json = (await res.json()) as { matches: FDMatch[] };

  return json.matches.map((m) => ({
    id: `fd-${m.id}`,
    league: m.competition.code as Match["league"],
    kickoff: m.utcDate,
    status: fdStatus(m.status),
    minute: m.minute ?? undefined,
    home: { name: m.homeTeam.shortName || m.homeTeam.name, crest: m.homeTeam.crest, score: m.score.fullTime.home },
    away: { name: m.awayTeam.shortName || m.awayTeam.name, crest: m.awayTeam.crest, score: m.score.fullTime.away },
  }));
}

/* ───────── API-Football (K리그 + 해외 4개 리그) ───────── */

interface AFFixture {
  fixture: { id: number; date: string; status: { short: string; elapsed: number | null } };
  league: { id: number };
  teams: { home: { id: number; name: string; logo?: string }; away: { id: number; name: string; logo?: string } };
  goals: { home: number | null; away: number | null };
}

export function afStatus(s: string): MatchStatus {
  if (["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT"].includes(s)) return "live";
  if (["FT", "AET", "PEN", "AWD", "WO"].includes(s)) return "finished";
  if (["PST", "CANC", "ABD", "SUSP"].includes(s)) return "postponed";
  return "scheduled";
}

/** 날짜 하나에 전 세계 경기가 한 번에 옴 → 관심 리그만 걸러서 '작게' 저장 (호출 1회) */
async function loadDay(date: string): Promise<Match[]> {
  const rows = await afGet<AFFixture>("fixtures", { date, timezone: "Asia/Seoul" });
  return rows
    .filter((f) => f.league.id in API_FOOTBALL_LEAGUES)
    .map((f) => {
      const league = API_FOOTBALL_LEAGUES[f.league.id];
      return {
        id: `af-${f.fixture.id}`,
        league,
        kickoff: new Date(f.fixture.date).toISOString(),
        status: afStatus(f.fixture.status.short),
        minute: f.fixture.status.elapsed ?? undefined,
        home: { name: teamName(league, f.teams.home.name, f.teams.home.id), crest: f.teams.home.logo, score: f.goals.home },
        away: { name: teamName(league, f.teams.away.name, f.teams.away.id), crest: f.teams.away.logo, score: f.goals.away },
      };
    });
}

// 캐시 이름 끝의 v2: 팀 이름 변환을 고쳐서 예전에 저장된 결과를 버리기 위함
const loadToday = cached("day-v2", TTL.todayFixtures, loadDay);
const loadPast = cached("day-past-v2", TTL.pastFixtures, loadDay);

/** 아직 안 끝난 경기가 있는지 (자정을 넘겨 진행 중인 유럽 경기 등) */
const unsettled = (list: Match[]) =>
  list.some((m) => m.status === "live" || (m.status === "scheduled" && Date.parse(m.kickoff) < Date.now()));

export async function fetchApiFootball(yesterday: string, today: string): Promise<Match[]> {
  let [a, b] = await Promise.all([loadPast(yesterday), loadToday(today)]);
  // 어제 목록에 진행 중이던 경기가 남아 있으면 '오늘'처럼 30분 캐시로 다시 받음
  if (unsettled(a)) a = await loadToday(yesterday);
  return [...a, ...b];
}

/** KST 날짜로 어제/오늘 나누기 */
export function splitByDay(matches: Match[], yesterday: string, today: string) {
  const sort = (a: Match, b: Match) => a.kickoff.localeCompare(b.kickoff);
  return {
    yesterday: matches.filter((m) => kstDate(m.kickoff) === yesterday).sort(sort),
    today: matches.filter((m) => kstDate(m.kickoff) === today).sort(sort),
  };
}
