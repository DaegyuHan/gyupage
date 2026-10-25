/**
 * My Team — 응원하는 팀의 다음 경기·지난 경기·최근 흐름 (키 필요 없음, 30분 캐시)
 * - 바이에른·맨유: ESPN 팀 일정 (리그·컵·챔스 모든 대회)
 * - 수원 삼성: 네이버 스포츠 K리그 일정
 * - 순위·승점: 축구 순위 페이지와 같은 데이터
 */
import { cached } from "../football/apiFootball";
import { getStandings } from "../football/standings";
import type { LeagueId } from "../football/types";
import type { Form, MtMatch, MyTeam } from "./types";

export * from "./types";

interface TeamConfig {
  id: string;
  name: string;
  color: string;
  league: string;
  standings: LeagueId;
  source: { kind: "espn"; espnId: string } | { kind: "naver"; code: string };
}

const TEAMS: TeamConfig[] = [
  { id: "suwon", name: "수원 삼성", color: "#1d4fa0", league: "K리그2", standings: "K2", source: { kind: "naver", code: "02" } },
  { id: "bayern", name: "바이에른 뮌헨", color: "#dc052d", league: "분데스리가", standings: "BL1", source: { kind: "espn", espnId: "132" } },
  { id: "manutd", name: "맨유", color: "#c70101", league: "프리미어리그", standings: "PL", source: { kind: "espn", espnId: "360" } },
];

/* ───────── 이름 한글로 ───────── */

const COMP_KO: [RegExp, string][] = [
  [/Premier League/i, "프리미어리그"],
  [/2\. Bundesliga/i, "2. 분데스리가"],
  [/Bundesliga/i, "분데스리가"],
  [/Champions League/i, "챔피언스리그"],
  [/Europa League/i, "유로파리그"],
  [/Conference League/i, "컨퍼런스리그"],
  [/DFB|German Cup|Pokal/i, "DFB 포칼"],
  [/Supercup|Super Cup/i, "슈퍼컵"],
  [/Carabao|League Cup|EFL Cup/i, "카라바오컵"],
  [/FA Cup/i, "FA컵"],
  [/Community Shield/i, "커뮤니티 실드"],
  [/Club World Cup/i, "클럽 월드컵"],
  [/Friendly/i, "친선경기"],
];

const TEAM_KO: Record<string, string> = {
  // 프리미어리그
  Arsenal: "아스널", "Aston Villa": "애스턴 빌라", "AFC Bournemouth": "본머스", Bournemouth: "본머스", Brentford: "브렌트퍼드",
  "Brighton & Hove Albion": "브라이턴", Brighton: "브라이턴", Burnley: "번리", Chelsea: "첼시", "Crystal Palace": "크리스털 팰리스",
  Everton: "에버턴", Fulham: "풀럼", "Leeds United": "리즈", Liverpool: "리버풀", "Manchester City": "맨시티",
  "Newcastle United": "뉴캐슬", "Nottingham Forest": "노팅엄", Sunderland: "선덜랜드", "Tottenham Hotspur": "토트넘",
  "West Ham United": "웨스트햄", "Wolverhampton Wanderers": "울버햄튼", "Leicester City": "레스터", "Ipswich Town": "입스위치",
  Southampton: "사우샘프턴", "Coventry City": "코번트리", "Sheffield United": "셰필드 유나이티드", "Hull City": "헐 시티",
  // 분데스리가
  "Borussia Dortmund": "도르트문트", "Bayer Leverkusen": "레버쿠젠", "RB Leipzig": "라이프치히", "Eintracht Frankfurt": "프랑크푸르트",
  "VfB Stuttgart": "슈투트가르트", "SC Freiburg": "프라이부르크", "VfL Wolfsburg": "볼프스부르크", "Borussia Mönchengladbach": "묀헨글라트바흐",
  "Borussia Monchengladbach": "묀헨글라트바흐", "Werder Bremen": "브레멘", "1. FC Union Berlin": "우니온 베를린", "Union Berlin": "우니온 베를린",
  "TSG Hoffenheim": "호펜하임", "1899 Hoffenheim": "호펜하임", "FC Augsburg": "아우크스부르크", Augsburg: "아우크스부르크",
  "Mainz": "마인츠", "1. FSV Mainz 05": "마인츠", "Mainz 05": "마인츠", "FC Heidenheim": "하이덴하임", "1. FC Heidenheim 1846": "하이덴하임",
  "FC St. Pauli": "장크트파울리", "St. Pauli": "장크트파울리", "Hamburg SV": "함부르크", "Hamburger SV": "함부르크", "1. FC Köln": "쾰른", "FC Cologne": "쾰른",
  "Holstein Kiel": "킬", Magdeburg: "마그데부르크", "1. FC Magdeburg": "마그데부르크", "Hannover 96": "하노버", "Fortuna Düsseldorf": "뒤셀도르프",
  "Karlsruher SC": "카를스루에", "SC Paderborn 07": "파더보른", "Hertha BSC": "헤르타", "1. FC Kaiserslautern": "카이저슬라우테른", "1. FC Nürnberg": "뉘른베르크", "VfL Bochum": "보훔", "Schalke 04": "샬케", "Hertha Berlin": "헤르타",
  // 그 밖에 자주 만나는 팀
  "Real Madrid": "레알 마드리드", Barcelona: "바르셀로나", "Atlético Madrid": "AT 마드리드", "Atletico Madrid": "AT 마드리드",
  "Paris Saint-Germain": "PSG", Juventus: "유벤투스", "Internazionale": "인테르", "Inter Milan": "인테르", "AC Milan": "AC 밀란", Napoli: "나폴리",
  Benfica: "벤피카", Porto: "포르투", "Sporting CP": "스포르팅", PSV: "PSV", "PSV Eindhoven": "PSV", Ajax: "아약스", Feyenoord: "페예노르트",
  Celtic: "셀틱", "Club Brugge": "브뤼헤", Galatasaray: "갈라타사라이", Como: "코모", Atalanta: "아탈란타", Roma: "AS 로마",
  Monaco: "모나코", Marseille: "마르세유", Lille: "릴", "Bodo/Glimt": "보되/글림트", Copenhagen: "코펜하겐", "Slavia Prague": "슬라비아 프라하",
};

const compKo = (s: string) => COMP_KO.find(([re]) => re.test(s))?.[1] ?? s;

/* ───────── ESPN ───────── */

interface EspnCompetitor {
  homeAway: "home" | "away";
  team: { id: string; displayName: string; shortDisplayName?: string; logo?: string; logos?: { href: string }[] };
  score?: { value?: number; displayValue?: string } | string;
  winner?: boolean;
}
interface EspnEvent {
  date: string;
  league?: { name?: string };
  competitions: { status?: { type?: { name?: string; completed?: boolean; state?: string } }; competitors: EspnCompetitor[] }[];
}

async function espnEvents(teamId: string, fixture: boolean): Promise<EspnEvent[]> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/all/teams/${teamId}/schedule${fixture ? "?fixture=true" : ""}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`espn ${res.status}`);
  return ((await res.json()) as { events?: EspnEvent[] }).events ?? [];
}

const scoreOf = (c: EspnCompetitor) => {
  const s = c.score;
  const v = typeof s === "string" ? Number(s) : s?.value ?? Number(s?.displayValue);
  return Number.isFinite(v) ? Number(v) : null;
};

function espnMatch(e: EspnEvent, teamId: string): MtMatch | null {
  const comp = e.competitions?.[0];
  const me = comp?.competitors.find((c) => c.team.id === teamId);
  const op = comp?.competitors.find((c) => c.team.id !== teamId);
  if (!me || !op) return null;
  const st = comp.status?.type;
  const state: MtMatch["state"] = st?.completed ? "done" : st?.state === "in" ? "live" : /POSTPONED|CANCELED/.test(st?.name ?? "") ? "off" : "pre";
  return {
    kickoff: e.date,
    competition: compKo(e.league?.name ?? ""),
    opponent: {
      name: TEAM_KO[op.team.displayName] ?? op.team.shortDisplayName ?? op.team.displayName,
      logo: op.team.logos?.[0]?.href ?? op.team.logo,
    },
    home: me.homeAway === "home",
    state,
    goalsFor: scoreOf(me),
    goalsAgainst: scoreOf(op),
  };
}

async function fromEspn(teamId: string) {
  const [past, next] = await Promise.all([espnEvents(teamId, false), espnEvents(teamId, true)]);
  const all = [...past, ...next].map((e) => espnMatch(e, teamId)).filter((m): m is MtMatch => !!m);
  const logo = past[0]?.competitions?.[0]?.competitors.find((c) => c.team.id === teamId)?.team.logos?.[0]?.href ?? `https://a.espncdn.com/i/teamlogos/soccer/500/${teamId}.png`;
  return { matches: all, logo };
}

/* ───────── 네이버 (K리그) ───────── */

interface NaverGame {
  gameDateTime: string; // KST, 오프셋 없음
  categoryId: string;
  homeTeamCode: string;
  homeTeamName: string;
  homeTeamScore: number;
  awayTeamCode: string;
  awayTeamName: string;
  awayTeamScore: number;
  statusCode: string; // BEFORE | STARTED | RESULT ...
  cancel?: boolean;
  homeTeamEmblemUrl?: string;
  awayTeamEmblemUrl?: string;
}

/** 네이버 엠블럼은 외부 사이트에서 막혀서 K리그 공식 엠블럼으로 (팀 코드가 같음) */
const kEmblem = (code: string) => `https://www.kleague.com/assets/images/emblem/emblem_K${code}.png`;

const ymd = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

async function fromNaver(code: string) {
  const from = ymd(Date.now() - 70 * 86400_000);
  const to = ymd(Date.now() + 40 * 86400_000);
  // 승격·강등에 상관없이 찾도록 1·2부 둘 다
  const lists = await Promise.all(
    ["kleague", "kleague2"].map(async (cat) => {
      const res = await fetch(
        `https://api-gw.sports.naver.com/schedule/games?fields=basic&upperCategoryId=kfootball&categoryId=${cat}&fromDate=${from}&toDate=${to}&size=500`,
        { headers: { Referer: "https://m.sports.naver.com/" }, cache: "no-store" },
      );
      if (!res.ok) return [] as NaverGame[];
      return ((await res.json()) as { result?: { games?: NaverGame[] } }).result?.games ?? [];
    }),
  );
  let logo: string | undefined;
  const matches = lists
    .flat()
    .filter((g) => g.homeTeamCode === code || g.awayTeamCode === code)
    .map((g): MtMatch => {
      const home = g.homeTeamCode === code;
      logo ??= kEmblem(code);
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
    });
  return { matches, logo };
}

/* ───────── 합치기 ───────── */

const resultOf = (m: MtMatch): Form => (m.goalsFor! > m.goalsAgainst! ? "W" : m.goalsFor! < m.goalsAgainst! ? "L" : "D");

async function loadTeam(cfg: TeamConfig): Promise<MyTeam> {
  const [{ matches, logo }, table] = await Promise.all([
    cfg.source.kind === "espn" ? fromEspn(cfg.source.espnId) : fromNaver(cfg.source.code),
    getStandings(cfg.standings).catch(() => null),
  ]);

  const sorted = [...matches].sort((a, b) => a.kickoff.localeCompare(b.kickoff));
  // 친선경기는 흐름 계산에서 뺌
  const played = sorted.filter((m) => m.state === "done" && m.goalsFor != null && m.goalsAgainst != null && m.competition !== "친선경기");
  const next = sorted.find((m) => m.state === "live") ?? sorted.find((m) => m.state === "pre" && Date.parse(m.kickoff) > Date.now() - 3 * 3600_000);

  const myId = cfg.source.kind === "espn" ? cfg.source.espnId : cfg.source.code;
  const row = table?.groups.flatMap((g) => g.rows).find((r) => r.teamId === myId);

  return {
    id: cfg.id,
    name: cfg.name,
    logo,
    color: cfg.color,
    league: cfg.league,
    rank: row?.rank,
    points: row?.points,
    next: next ?? undefined,
    last: played[played.length - 1],
    form: played.slice(-5).map(resultOf),
    // 홈 주간 일정표용: 어제부터 8일 뒤까지 (연기·취소 제외)
    week: sorted.filter((m) => {
      const t = Date.parse(m.kickoff);
      return m.state !== "off" && t > Date.now() - 36 * 3600_000 && t < Date.now() + 8 * 86400_000;
    }),
  };
}

async function load(): Promise<MyTeam[]> {
  const results = await Promise.allSettled(TEAMS.map(loadTeam));
  const ok = results.flatMap((r, i) => {
    if (r.status === "fulfilled") return [r.value];
    console.error("[myteam]", TEAMS[i].id, r.reason);
    return [];
  });
  if (ok.length === 0) {
    throw new Error(`myteam: 모든 팀 불러오기 실패 (${results.map((r) => (r.status === "rejected" ? String(r.reason) : "ok")).join(" / ")})`);
  }
  return ok;
}

export const getMyTeams = cached("myteam-v6", 60 * 30, load);
