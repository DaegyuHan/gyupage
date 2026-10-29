import { addDays, kstDate } from "./kst";
import { AF_SAVER, afGet, cached, TTL } from "./apiFootball";
import { API_FOOTBALL_LEAGUES, FOOTBALL_DATA_CODES, teamName } from "./leagues";
import type { Match, MatchStatus } from "./types";
import { mfetch } from "@/lib/server/monitor";
import { kleagueGames } from "./kleague";
import { ESPN_SLUG } from "./espnDetail";

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

  const res = await mfetch(url, {
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
// 모드마다 캐시 이름을 달리 해서, 스위치를 바꾸면 바로 그 방식의 캐시 시간으로 동작
const loadToday = cached(AF_SAVER ? "day-v3" : "day-v2-asis", TTL.todayFixtures, loadDay);

/** 아직 안 끝난 경기가 있는지 (예전 방식에서만 씀) */
const unsettled = (list: Match[]) =>
  list.some((m) => m.status === "live" || (m.status === "scheduled" && Date.parse(m.kickoff) < Date.now()));
const loadPast = cached("day-past-v2", TTL.pastFixtures, loadDay);

/* ───────── K리그 실시간 보정: 네이버 스포츠 (키·호출 한도 없음, 1분 캐시) ─────────
 * API-Football 은 무료 한도(하루 100회) 때문에 30분 캐시 + 한도가 차면 예전 값이 그대로 남아
 * '45분'처럼 멈춰 보일 수 있어요. K리그는 네이버 일정의 점수·상태로 덮어써요.
 */
interface NaverGame {
  gameDate: string; // YYYY-MM-DD (KST)
  homeTeamName: string;
  awayTeamName: string;
  homeTeamScore: number;
  awayTeamScore: number;
  statusCode: string; // BEFORE | STARTED | RESULT ...
  statusInfo?: string; // "후반 23분" 등
  cancel?: boolean;
}

/** 팀 이름 맞추기: 우리 표기(수원 삼성) ↔ 네이버 표기(수원) */
function normK(name: string) {
  const n = name.replace(/\s+/g, "");
  const alias: Record<string, string> = { 수원삼성: "수원", 울산HD: "울산", FC서울: "서울", 서울이랜드: "서울E", 김천상무: "김천" };
  return alias[n] ?? n;
}

/** K리그 일정·점수: K리그 공식 사이트 (1분 캐시) */
const naverK = (from: string, to: string): Promise<NaverGame[]> => kleagueGames(from, to);

function minuteFrom(info?: string) {
  const m = info?.match(/(\d+)/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return /후반/.test(info!) && n <= 45 ? n + 45 : n;
}

async function overlayKLeague(list: Match[], from: string, to: string): Promise<Match[]> {
  if (!list.some((m) => m.league === "K1" || m.league === "K2")) return list;
  const games = await naverK(from, to).catch(() => [] as NaverGame[]);
  if (!games.length) return list;
  return list.map((m) => {
    if (m.league !== "K1" && m.league !== "K2") return m;
    const day = kstDate(m.kickoff);
    const g = games.find(
      (x) => x.gameDate === day && (normK(x.homeTeamName) === normK(m.home.name) || normK(x.awayTeamName) === normK(m.away.name)),
    );
    if (!g) return m;
    const status: Match["status"] = g.cancel ? "postponed" : g.statusCode === "RESULT" ? "finished" : g.statusCode === "BEFORE" ? "scheduled" : "live";
    const scored = status !== "scheduled";
    return {
      ...m,
      status,
      minute: status === "live" ? (minuteFrom(g.statusInfo) ?? m.minute) : undefined,
      home: { ...m.home, score: scored ? g.homeTeamScore : null },
      away: { ...m.away, score: scored ? g.awayTeamScore : null },
    };
  });
}

/* ───────── 해외 실시간 보정: ESPN 스코어보드 (키·호출 한도 없음, 90초 캐시) ─────────
 * API-Football 경기 목록은 '어떤 경기가 몇 시에 있는지'만 알면 되니까 3시간에 한 번만 받고,
 * 진행 중 점수·분·종료 여부는 ESPN 으로 덮어써요. → API-Football 하루 사용량이 크게 줄어요.
 */

export interface EspnEvent {
  id?: string;
  date: string;
  season?: { slug?: string };
  links?: { text?: string; href?: string; rel?: string[] }[];
  competitions?: {
    venue?: { fullName?: string; address?: { city?: string } };
    attendance?: number;
    broadcasts?: { names?: string[] }[];
    details?: {
      type?: { text?: string };
      clock?: { displayValue?: string };
      team?: { id?: string };
      scoringPlay?: boolean;
      yellowCard?: boolean;
      redCard?: boolean;
      penaltyKick?: boolean;
      ownGoal?: boolean;
      athletesInvolved?: { displayName?: string }[];
    }[];
    headlines?: { type?: string; shortLinkText?: string; description?: string }[];
    competitors: {
      id?: string;
      homeAway: "home" | "away";
      score?: string;
      shootoutScore?: number;
      form?: string;
      statistics?: { name?: string; displayValue?: string }[];
      team: { displayName?: string; shortDisplayName?: string; name?: string; location?: string; logo?: string };
    }[];
    status?: { displayClock?: string; type?: { state?: "pre" | "in" | "post"; completed?: boolean; name?: string } };
  }[];
}

/**
 * ESPN 스코어보드 하루치 — dates=YYYYMMDD (하루만 됨, 기간 범위는 400 에러)
 * ESPN 날짜는 미국 기준이라 KST 하루를 덮으려면 전날까지 같이 봄
 */
const espnFetchDay = async (slug: string, day: string): Promise<EspnEvent[]> => {
  const res = await mfetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/scoreboard?dates=${day.replaceAll("-", "")}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) return [];
  return ((await res.json()) as { events?: EspnEvent[] }).events ?? [];
};
// 진행 중일 수 있는 날(어제~내일)은 90초, 지난 날은 끝난 경기뿐이라 6시간, 먼 앞날은 일정만이라 30분
const espnDayLive = cached("espn-day-live-v1", 90, espnFetchDay);
const espnDayPast = cached("espn-day-past-v1", 60 * 60 * 6, espnFetchDay);
const espnDayFuture = cached("espn-day-future-v1", 60 * 30, espnFetchDay);

/** ESPN 날짜(미국 기준) from~to 의 경기 — 날마다 따로 받아서 합침 */
export async function espnBoard(slug: string, from: string, to: string): Promise<EspnEvent[]> {
  const today = kstDate(new Date());
  const days: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) days.push(d);
  const pick = (d: string) => (d < addDays(today, -2) ? espnDayPast : d > addDays(today, 1) ? espnDayFuture : espnDayLive);
  const lists = await Promise.all(days.map((d) => pick(d)(slug, d).catch(() => [] as EspnEvent[])));
  return lists.flat();
}

const STOP = new Set(["fc", "cf", "afc", "sc", "ac", "as", "ssc", "club", "de", "the", "1", "real"]);
/** "Bayern München" / "Bayern Munich" → {bayern, munchen} / {bayern, munich} */
function tokens(...names: (string | undefined)[]) {
  const out = new Set<string>();
  for (const n of names) {
    if (!n) continue;
    n.normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 1 && !STOP.has(t))
      .forEach((t) => out.add(t));
  }
  return out;
}
const overlap = (a: Set<string>, b: Set<string>) => [...a].filter((t) => b.has(t)).length;

function espnStatus(e: EspnEvent): Match["status"] {
  const st = e.competitions?.[0]?.status?.type;
  const name = st?.name ?? "";
  return /POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(name)
    ? "postponed"
    : st?.state === "post" || st?.completed
      ? "finished"
      : st?.state === "in"
        ? "live"
        : "scheduled";
}

/**
 * ESPN 경기 → 우리 경기 모양
 * API-Football 무료 요금제가 이번 시즌 경기를 안 줄 때도 해외 리그·컵 대회 결과가 뜨도록 목록 자체를 ESPN 에서도 받음
 */
export function espnToMatch(league: Match["league"], e: EspnEvent): Match | null {
  const comp = e.competitions?.[0];
  const h = comp?.competitors.find((x) => x.homeAway === "home");
  const a = comp?.competitors.find((x) => x.homeAway === "away");
  if (!comp || !h || !a) return null;
  const status = espnStatus(e);
  const score = (v?: string) => (status === "scheduled" || v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  const clock = comp.status?.displayClock?.match(/(\d+)/);
  return {
    // 상세 주소: /football/match/espn-PL-401921834
    id: e.id ? `espn-${league}-${e.id}` : `espnx-${league}-${e.date}-${h.team.displayName}`,
    league,
    kickoff: new Date(e.date).toISOString(),
    status,
    minute: status === "live" && clock ? Number(clock[1]) : undefined,
    home: { name: h.team.displayName || h.team.name || "?", crest: h.team.logo, score: score(h.score) },
    away: { name: a.team.displayName || a.team.name || "?", crest: a.team.logo, score: score(a.score) },
  };
}

async function espnLists(from: string, to: string): Promise<Match[]> {
  const leagues = Object.keys(ESPN_SLUG) as Match["league"][];
  const lists = await Promise.all(
    leagues.map(async (l) => {
      const events = await espnBoard(ESPN_SLUG[l]!, addDays(from, -1), to).catch(() => [] as EspnEvent[]);
      return events.map((e) => espnToMatch(l, e)).filter((m): m is Match => !!m);
    }),
  );
  return lists.flat();
}

/** K리그 공식 경기 → 우리 경기 모양 */
export async function kleagueLists(from: string, to: string): Promise<Match[]> {
  const games = await kleagueGames(from, to).catch(() => []);
  return games.map((g) => {
    const status: Match["status"] = g.cancel ? "postponed" : g.statusCode === "RESULT" ? "finished" : g.statusCode === "BEFORE" ? "scheduled" : "live";
    const scored = status !== "scheduled";
    return {
      id: `kl-${g.gameDate}-${g.homeTeamCode}-${g.awayTeamCode}`,
      league: g.categoryId === "kleague" ? "K1" : "K2",
      kickoff: new Date(`${g.gameDateTime}+09:00`).toISOString(),
      status,
      home: { name: g.homeTeamName, crest: `https://www.kleague.com/assets/images/emblem/emblem_K${g.homeTeamCode}.png`, score: scored ? g.homeTeamScore : null },
      away: { name: g.awayTeamName, crest: `https://www.kleague.com/assets/images/emblem/emblem_K${g.awayTeamCode}.png`, score: scored ? g.awayTeamScore : null },
    } satisfies Match;
  });
}

/** 이미 있는 경기(API-Football)와 같은 경기인지 — 같은 대회, 킥오프 20분 안, 팀 이름이 겹침 */
function sameMatch(a: Match, b: Match) {
  if (a.league !== b.league || Math.abs(Date.parse(a.kickoff) - Date.parse(b.kickoff)) > 20 * 60_000) return false;
  if (a.league === "K1" || a.league === "K2") return normK(a.home.name) === normK(b.home.name) || normK(a.away.name) === normK(b.away.name);
  return overlap(tokens(a.home.name), tokens(b.home.name)) + overlap(tokens(a.away.name), tokens(b.away.name)) > 0;
}

/** API-Football 목록에 없는 경기만 더함 (있는 건 상세 화면 링크가 되는 API-Football 쪽을 씀) */
function mergeMissing(base: Match[], extra: Match[]) {
  const out = [...base];
  for (const m of extra) if (!out.some((x) => sameMatch(x, m))) out.push(m);
  return out;
}

async function overlayOverseas(list: Match[], from: string, to: string): Promise<Match[]> {
  const leagues = [...new Set(list.map((m) => m.league))].filter((l) => ESPN_SLUG[l]);
  if (!leagues.length) return list;
  // KST 하루가 미국 시간으로는 이틀에 걸쳐서 앞뒤로 하루씩 넉넉히
  const boards = new Map(
    await Promise.all(leagues.map(async (l) => [l, await espnBoard(ESPN_SLUG[l]!, addDays(from, -1), to).catch(() => [] as EspnEvent[])] as const)),
  );
  return list.map((m) => {
    const events = boards.get(m.league);
    if (!events?.length) return m;
    const kick = Date.parse(m.kickoff);
    const th = tokens(m.home.name);
    const ta = tokens(m.away.name);
    let best: { e: EspnEvent; score: number } | null = null;
    for (const e of events) {
      if (Math.abs(Date.parse(e.date) - kick) > 20 * 60_000) continue;
      const c = e.competitions?.[0]?.competitors ?? [];
      const h = c.find((x) => x.homeAway === "home")?.team;
      const a = c.find((x) => x.homeAway === "away")?.team;
      const score = overlap(th, tokens(h?.displayName, h?.shortDisplayName, h?.name, h?.location)) + overlap(ta, tokens(a?.displayName, a?.shortDisplayName, a?.name, a?.location));
      if (score > 0 && (!best || score > best.score)) best = { e, score };
    }
    if (!best) return m;
    const comp = best.e.competitions![0];
    const status = espnStatus(best.e);
    if (status === "scheduled") return m.status === "live" ? m : { ...m, status };
    const num = (side: "home" | "away") => {
      const v = comp.competitors.find((x) => x.homeAway === side)?.score;
      return v != null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : null;
    };
    const clock = comp.status?.displayClock?.match(/(\d+)/);
    return {
      ...m,
      status,
      minute: status === "live" ? (clock ? Number(clock[1]) : m.minute) : undefined,
      home: { ...m.home, score: num("home") ?? m.home.score },
      away: { ...m.away, score: num("away") ?? m.away.score },
    };
  });
}

/** 마지막 안전장치: 킥오프 4시간이 지났는데도 '진행 중'이면 끝난 것으로 봄 (값이 멈춘 경우) */
function settleStale(list: Match[]): Match[] {
  const limit = Date.now() - 4 * 3600_000;
  return list.map((m) => (m.status === "live" && Date.parse(m.kickoff) < limit ? { ...m, status: "finished", minute: undefined } : m));
}

export async function fetchApiFootball(yesterday: string, today: string): Promise<Match[]> {
  let [a, b] = await Promise.all([loadPast(yesterday), loadToday(today)]);
  if (!AF_SAVER) {
    // 예전 방식: 어제 목록에 진행 중이던 경기가 남아 있으면 '오늘'처럼 30분 캐시로 다시 받음
    if (unsettled(a)) a = await loadToday(yesterday);
    return settleStale(await overlayKLeague([...a, ...b], yesterday, today));
  }
  // 진행 중 점수는 API-Football 을 다시 부르지 않고 무료 소스로 덮어씀 (K리그: 공식 사이트, 해외: ESPN)
  const k = await overlayKLeague([...a, ...b], yesterday, today);
  const overlaid = await overlayOverseas(k, yesterday, today).catch(() => k);
  // API-Football 에 없는 경기(무료 요금제 제한 등)는 ESPN·K리그 공식 목록에서 채움
  const [espn, kl] = await Promise.all([espnLists(yesterday, today).catch(() => []), kleagueLists(yesterday, today).catch(() => [])]);
  return settleStale(mergeMissing(overlaid, [...espn, ...kl]));
}

/** KST 날짜로 어제/오늘 나누기 */
export function splitByDay(matches: Match[], yesterday: string, today: string) {
  const sort = (a: Match, b: Match) => a.kickoff.localeCompare(b.kickoff);
  return {
    yesterday: matches.filter((m) => kstDate(m.kickoff) === yesterday).sort(sort),
    today: matches.filter((m) => kstDate(m.kickoff) === today).sort(sort),
  };
}
