/**
 * 축구 탭 리그 화면에 더하는 것들 (API-Football 한도 안 씀)
 * - 이번 주 일정·결과: 지난 7일 + 다음 7일 (해외 ESPN, K리그 공식)
 * - 리그 뉴스: 한국어 Google 뉴스
 * - 팀 페이지: 팀의 이번 시즌 일정·결과 (해외 ESPN 팀 일정, K리그 공식 일정)
 */
import { cached } from "./apiFootball";
import { ESPN_SLUG } from "./espnDetail";
import { kleagueGames } from "./kleague";
import { addDays, kstDate } from "./kst";
import { currentSeason } from "./leagues";
import { espnBoard, espnToMatch, kleagueLists } from "./providers";
import type { LeagueId, Match } from "./types";
import { searchNews, type NewsItem } from "../news";
import { compKo, fromEspn, TEAM_KO, type MtMatch } from "../myteam";

const isK = (l: LeagueId) => l === "K1" || l === "K2";

/* ───────── 이번 주 일정·결과 ───────── */

export interface WeekSchedule {
  from: string;
  to: string;
  /** KST 날짜 → 경기 (킥오프 순) */
  days: { date: string; matches: Match[] }[];
}

const weekCached = cached("league-week-v1", 120, async (league: LeagueId, from: string, to: string): Promise<Match[]> => {
  if (isK(league)) return (await kleagueLists(from, to)).filter((m) => m.league === league);
  const slug = ESPN_SLUG[league];
  if (!slug) return [];
  // ESPN 날짜는 미국 기준이라 하루 앞부터
  const events = await espnBoard(slug, addDays(from, -1), to);
  const seen = new Set<string>();
  return events
    .map((e) => espnToMatch(league, e))
    .filter((m): m is Match => !!m && !seen.has(m.id) && (seen.add(m.id), true));
});

export async function getLeagueWeek(league: LeagueId): Promise<WeekSchedule> {
  const today = kstDate(new Date());
  const from = addDays(today, -7);
  const to = addDays(today, 7);
  const list = await weekCached(league, from, to);
  const byDay = new Map<string, Match[]>();
  for (const m of list) {
    const d = kstDate(m.kickoff);
    if (d < from || d > to) continue;
    if (!byDay.has(d)) byDay.set(d, []);
    byDay.get(d)!.push(m);
  }
  return {
    from,
    to,
    days: [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, matches]) => ({ date, matches: matches.sort((a, b) => a.kickoff.localeCompare(b.kickoff)) })),
  };
}

/* ───────── 리그 뉴스 ───────── */

const NEWS_QUERY: Record<LeagueId, string> = {
  K1: "K리그1",
  K2: "K리그2",
  PL: "프리미어리그",
  PD: "라리가",
  BL1: "분데스리가",
  CL: "챔피언스리그",
  EL: "유로파리그",
  EFL: "카라바오컵",
  DFB: "DFB 포칼",
};

export const getLeagueNews = cached("league-news-v1", 60 * 30, async (league: LeagueId): Promise<NewsItem[]> => searchNews(NEWS_QUERY[league], 3, 8));

/* ───────── 팀 페이지 ───────── */

export interface TeamSeason {
  league: LeagueId;
  teamId: string;
  name: string;
  logo?: string;
  /** 이번 시즌 경기 (킥오프 순) — 우리 팀 기준 득실 */
  matches: MtMatch[];
}

const kEmblem = (code: string) => `https://www.kleague.com/assets/images/emblem/emblem_K${code}.png`;

async function kleagueTeam(league: LeagueId, code: string): Promise<TeamSeason> {
  const y = currentSeason(league);
  const games = await kleagueGames(`${y}-02-01`, `${y}-12-31`);
  const mine = games.filter((g) => g.homeTeamCode === code || g.awayTeamCode === code);
  const name = mine[0] ? (mine[0].homeTeamCode === code ? mine[0].homeTeamName : mine[0].awayTeamName) : code;
  return {
    league,
    teamId: code,
    name,
    logo: kEmblem(code),
    matches: mine
      .map((g): MtMatch => {
        const home = g.homeTeamCode === code;
        const state: MtMatch["state"] = g.cancel ? "off" : g.statusCode === "RESULT" ? "done" : g.statusCode === "BEFORE" ? "pre" : "live";
        return {
          kickoff: new Date(`${g.gameDateTime}+09:00`).toISOString(),
          competition: g.categoryId === "kleague" ? "K리그1" : "K리그2",
          opponent: { name: home ? g.awayTeamName : g.homeTeamName, logo: kEmblem(home ? g.awayTeamCode : g.homeTeamCode) },
          home,
          state,
          goalsFor: state === "pre" ? null : home ? g.homeTeamScore : g.awayTeamScore,
          goalsAgainst: state === "pre" ? null : home ? g.awayTeamScore : g.homeTeamScore,
        };
      })
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}

async function espnTeam(league: LeagueId, teamId: string, name: string): Promise<TeamSeason> {
  const { matches, logo } = await fromEspn(teamId);
  // 이번 시즌(7월부터)만
  const y = currentSeason(league);
  const start = `${y}-07-01`;
  return {
    league,
    teamId,
    name: TEAM_KO[name] ?? name,
    logo,
    matches: matches
      .filter((m) => m.kickoff >= start)
      .map((m) => ({ ...m, competition: compKo(m.competition) }))
      .sort((a, b) => a.kickoff.localeCompare(b.kickoff)),
  };
}

export const getTeamSeason = cached("team-season-v1", 60 * 10, async (league: LeagueId, teamId: string, name: string): Promise<TeamSeason> =>
  isK(league) ? kleagueTeam(league, teamId) : espnTeam(league, teamId, name),
);
