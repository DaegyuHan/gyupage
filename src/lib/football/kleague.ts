/**
 * K리그 공식 사이트(kleague.com) 데이터 — K리그 일정·점수·순위·득점의 유일한 소스
 * (네이버 스포츠는 Vercel 서버에서 연결이 안 돼서 2026-10 부터 안 씀)
 * 키·한도 없음. 일정은 '리그 × 월' 단위로 받아요.
 *   POST /getScheduleList.do  {year, month, leagueId, teamId:""}   (JSON)
 *   POST /record/teamRank.do  leagueId=&year=&stadium=all          (폼)
 */
import { cached } from "./apiFootball";
import { mfetch } from "@/lib/server/monitor";

const BASE = "https://www.kleague.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
  Referer: `${BASE}/schedule.do`,
  Origin: BASE,
  Accept: "application/json, text/javascript, */*; q=0.01",
  "X-Requested-With": "XMLHttpRequest",
};

/** 네이버 일정과 같은 모양으로 맞춘 경기 하나 */
export interface KGame {
  /** YYYY-MM-DD (KST) */
  gameDate: string;
  /** YYYY-MM-DDTHH:MM:00 (KST, 오프셋 없음) */
  gameDateTime: string;
  categoryId: "kleague" | "kleague2";
  /** "02" 처럼 숫자만 (네이버 팀 코드·엠블럼 번호와 같음) */
  homeTeamCode: string;
  homeTeamName: string;
  homeTeamScore: number;
  awayTeamCode: string;
  awayTeamName: string;
  awayTeamScore: number;
  statusCode: "BEFORE" | "STARTED" | "RESULT";
  cancel?: boolean;
}

interface KlSchedule {
  gameDate: string; // 2026.10.25
  gameTime: string; // 14:00
  gameStatus: string; // "" 시작 전 · "FE" 종료 · 그 밖은 진행 중
  endYn: string;
  homeTeam: string; // K02
  homeTeamName: string;
  homeGoal: number | null;
  awayTeam: string;
  awayTeamName: string;
  awayGoal: number | null;
  leagueId: number;
}

async function post<T>(path: string, body: string, form = false): Promise<T> {
  const res = await mfetch(`${BASE}${path}`, {
    method: "POST",
    headers: { ...HEADERS, "Content-Type": form ? "application/x-www-form-urlencoded; charset=UTF-8" : "application/json; charset=UTF-8" },
    body,
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`kleague.com ${res.status}`);
  const j = (await res.json()) as { resultCode?: string; data?: T };
  if (j.resultCode !== "200" || !j.data) throw new Error(`kleague.com ${j.resultCode}`);
  return j.data;
}

const code = (teamId: string) => teamId.replace(/^K/, "");

function toGame(g: KlSchedule): KGame {
  const date = g.gameDate.replaceAll(".", "-");
  const finished = g.endYn === "Y" || g.gameStatus === "FE";
  const status: KGame["statusCode"] = finished ? "RESULT" : g.gameStatus ? "STARTED" : "BEFORE";
  return {
    gameDate: date,
    gameDateTime: `${date}T${g.gameTime || "00:00"}:00`,
    categoryId: g.leagueId === 1 ? "kleague" : "kleague2",
    homeTeamCode: code(g.homeTeam),
    homeTeamName: g.homeTeamName,
    homeTeamScore: g.homeGoal ?? 0,
    awayTeamCode: code(g.awayTeam),
    awayTeamName: g.awayTeamName,
    awayTeamScore: g.awayGoal ?? 0,
    statusCode: status,
  };
}

const fetchMonth = async (league: number, year: number, month: number) => {
  const data = await post<{ scheduleList?: KlSchedule[] }>(
    "/getScheduleList.do",
    JSON.stringify({ year: String(year), month: String(month).padStart(2, "0"), leagueId: String(league), teamId: "", ticketYn: "" }),
  );
  return (data.scheduleList ?? []).map(toGame);
};
// 지난 달은 거의 안 바뀌니 오래, 이번 달은 1분
const monthLive = cached("kl-month-live-v1", 60, fetchMonth);
const monthPast = cached("kl-month-past-v1", 60 * 60 * 6, fetchMonth);

/** from~to (YYYY-MM-DD) 사이 K리그1·2 경기 */
export async function kleagueGames(from: string, to: string): Promise<KGame[]> {
  const months: [number, number][] = [];
  let [y, m] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  while (y < ty || (y === ty && m <= tm)) {
    months.push([y, m]);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  const now = new Date(Date.now() + 9 * 3600_000);
  const cur = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const lists = await Promise.all(
    months.flatMap(([yy, mm]) =>
      [1, 2].map((league) => (yy * 12 + mm < cur ? monthPast : monthLive)(league, yy, mm).catch(() => [] as KGame[])),
    ),
  );
  return lists.flat().filter((g) => g.gameDate >= from && g.gameDate <= to);
}

/* ───────── 순위 ───────── */

export interface KRankRow {
  rank: number;
  teamId: string;
  teamName: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** 오른쪽이 최근 */
  form: ("W" | "D" | "L")[];
}

interface KlRank {
  rank: number;
  teamId: string;
  teamName: string;
  gameCount: number;
  winCnt: number;
  tieCnt: number;
  lossCnt: number;
  gainGoal: number;
  lossGoal: number;
  gapCnt: number;
  gainPoint: number;
  [k: `game0${number}`]: string | null | undefined;
}

const FORM: Record<string, "W" | "D" | "L"> = { 승: "W", 무: "D", 패: "L" };

export const kleagueRank = cached("kl-rank-v1", 60 * 30, async (league: number, year: number): Promise<KRankRow[]> => {
  const data = await post<{ teamRank?: KlRank[] }>("/record/teamRank.do", new URLSearchParams({ leagueId: String(league), year: String(year), stadium: "all" }).toString(), true);
  return (data.teamRank ?? []).map((t) => ({
    rank: t.rank,
    teamId: code(t.teamId),
    teamName: t.teamName,
    played: t.gameCount,
    win: t.winCnt,
    draw: t.tieCnt,
    lose: t.lossCnt,
    gf: t.gainGoal,
    ga: t.lossGoal,
    gd: t.gapCnt,
    points: t.gainPoint,
    // game01 이 가장 최근 → 뒤집어서 오른쪽이 최근
    form: [1, 2, 3, 4, 5]
      .map((i) => FORM[t[`game0${i}`] ?? ""])
      .filter((x): x is "W" | "D" | "L" => !!x)
      .reverse(),
  }));
});

/* ───────── 득점 순위 ───────── */

export interface KScorer {
  rank: number;
  name: string;
  teamId: string;
  teamName: string;
  goals: number;
  assists: number;
  apps: number;
}

interface KlPlayer {
  rank: number;
  name: string;
  teamId: string;
  teamName: string;
  goalQty: number | null;
  assistQty: number | null;
  gameQty: number | null;
}

export const kleagueScorers = cached("kl-scorers-v1", 60 * 30, async (league: number, year: number): Promise<KScorer[]> => {
  const data = await post<{ list?: KlPlayer[] }>("/record/rankSort.do", JSON.stringify({ year: String(year), leagueId: String(league), recordType: "GOAL" }));
  return (data.list ?? [])
    .filter((p) => (p.goalQty ?? 0) > 0)
    .sort((a, b) => a.rank - b.rank)
    .map((p) => ({
      rank: p.rank,
      name: p.name,
      teamId: code(p.teamId),
      teamName: p.teamName,
      goals: p.goalQty ?? 0,
      assists: p.assistQty ?? 0,
      apps: p.gameQty ?? 0,
    }));
});
