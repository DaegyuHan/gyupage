/**
 * K리그 경기 상세: /football/match/kl-2026-11-01-02-07  (날짜-홈팀코드-원정팀코드)
 * K리그 공식 일정 데이터로 만들어요 (추가 호출 거의 없음 — 시즌 일정은 이미 캐시돼 있음)
 * - 경기 정보: 라운드·경기장·관중·중계·주심
 * - 두 팀 최근 5경기, 이번 시즌 맞대결, 관련 뉴스
 */
import type { FormGame, MatchDetail } from "./detail";
import { kleagueGames, type KGame } from "./kleague";
import type { MatchStatus } from "./types";
import { searchNews } from "../news";

const kEmblem = (code: string) => `https://www.kleague.com/assets/images/emblem/emblem_K${code}.png`;

const statusOf = (g: KGame): MatchStatus =>
  g.cancel ? "postponed" : g.statusCode === "RESULT" ? "finished" : g.statusCode === "BEFORE" ? "scheduled" : "live";

/** 팀 code 기준으로 본 경기 한 줄 */
function formOf(g: KGame, code: string): FormGame {
  const home = g.homeTeamCode === code;
  const gf = home ? g.homeTeamScore : g.awayTeamScore;
  const ga = home ? g.awayTeamScore : g.homeTeamScore;
  return {
    date: g.gameDate,
    opponent: home ? g.awayTeamName : g.homeTeamName,
    opponentLogo: kEmblem(home ? g.awayTeamCode : g.homeTeamCode),
    home,
    score: `${g.homeTeamScore}-${g.awayTeamScore}`,
    result: gf > ga ? "W" : gf < ga ? "L" : "D",
    competition: g.categoryId === "kleague" ? "K리그1" : "K리그2",
  };
}

export const kleagueMatchId = (g: Pick<KGame, "gameDate" | "homeTeamCode" | "awayTeamCode">) => `kl-${g.gameDate}-${g.homeTeamCode}-${g.awayTeamCode}`;

export async function getKleagueDetail(idText: string): Promise<MatchDetail | null> {
  const m = idText.match(/^kl-(\d{4})-(\d{2})-(\d{2})-(\d+)-(\d+)$/);
  if (!m) return null;
  const [, y, mo, d, hc, ac] = m;
  const date = `${y}-${mo}-${d}`;
  // 이번 시즌 전체 (팀 페이지와 같은 캐시)
  const season = await kleagueGames(`${y}-02-01`, `${y}-12-31`);
  const g = season.find((x) => x.gameDate === date && x.homeTeamCode === hc && x.awayTeamCode === ac);
  if (!g) return null;

  const status = statusOf(g);
  const scored = status === "finished" || status === "live";
  const before = (x: KGame) => x.statusCode === "RESULT" && !x.cancel && x.gameDateTime < g.gameDateTime;
  const recent = (code: string) =>
    season
      .filter((x) => before(x) && (x.homeTeamCode === code || x.awayTeamCode === code))
      .sort((a, b) => b.gameDateTime.localeCompare(a.gameDateTime))
      .slice(0, 5)
      .map((x) => formOf(x, code));
  const h2h = season
    .filter((x) => x !== g && x.statusCode === "RESULT" && !x.cancel && [x.homeTeamCode, x.awayTeamCode].sort().join() === [hc, ac].sort().join())
    .sort((a, b) => b.gameDateTime.localeCompare(a.gameDateTime))
    .map((x) => formOf(x, hc));

  const news = await searchNews(`${g.homeTeamName} ${g.awayTeamName} K리그`, 4, 5).catch(() => []);

  return {
    id: 0,
    league: g.categoryId === "kleague" ? "K1" : "K2",
    round: g.round ? `Regular Season - ${g.round}` : undefined,
    kickoff: new Date(`${g.gameDateTime}+09:00`).toISOString(),
    status,
    statusShort: status === "finished" ? "FT" : status === "postponed" ? "PST" : status === "live" ? "LIVE" : "NS",
    venue: g.venue,
    referee: g.referee,
    attendance: g.attendance,
    broadcast: g.broadcast,
    home: { id: Number(hc), name: g.homeTeamName, logo: kEmblem(hc), score: scored ? g.homeTeamScore : null },
    away: { id: Number(ac), name: g.awayTeamName, logo: kEmblem(ac), score: scored ? g.awayTeamScore : null },
    events: [],
    stats: [],
    lineups: {},
    form: { home: recent(hc), away: recent(ac) },
    h2h,
    news: news.map((n) => ({ title: n.title, href: n.link })),
    source: "K리그",
  };
}
