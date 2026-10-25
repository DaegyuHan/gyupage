import { afGet, cached, TTL } from "./apiFootball";
import { API_FOOTBALL_LEAGUES, LEAGUE_MAP, teamName } from "./leagues";
import { addDays, kstDate } from "./kst";
import { afStatus, fetchApiFootball } from "./providers";
import type { LeagueId, MatchStatus } from "./types";

/* ───────── 화면에서 쓰는 형태 ───────── */

export type Side = "home" | "away";

export interface DetailTeam {
  id: number;
  name: string;
  logo?: string;
  score: number | null;
}

export type EventKind =
  | "goal"
  | "penalty"
  | "owngoal"
  | "missedpen"
  | "yellow"
  | "red"
  | "secondyellow"
  | "sub"
  | "var";

export interface DetailEvent {
  minute: number;
  extra?: number;
  side: Side;
  kind: EventKind;
  /** 골/카드: 해당 선수, 교체: 들어간 선수 */
  player: string;
  /** 골: 도움, 교체: 나간 선수 */
  second?: string;
  /** VAR 등 원문 설명 */
  note?: string;
  /** 이 이벤트 직후 스코어 (골일 때) */
  scoreAfter?: [number, number];
}

export interface StatRow {
  label: string;
  home: number;
  away: number;
  homeText: string;
  awayText: string;
}

export interface LineupPlayer {
  id: number;
  name: string;
  number: number | null;
  pos: string | null;
  /** [줄, 칸] — 1줄이 골키퍼 */
  grid?: [number, number];
  rating?: number;
  goals?: number;
  assists?: number;
  yellow?: boolean;
  red?: boolean;
  subOut?: number;
  subIn?: number;
  captain?: boolean;
}

export interface Lineup {
  formation: string | null;
  coach?: string;
  color: string;
  numberColor: string;
  gkColor: string;
  startXI: LineupPlayer[];
  subs: LineupPlayer[];
}

export type AbsenceKind = "injury" | "suspension" | "doubtful";

export interface Absence {
  name: string;
  photo?: string;
  kind: AbsenceKind;
  reason: string;
}

export interface MatchDetail {
  id: number;
  league: LeagueId;
  round?: string;
  kickoff: string;
  status: MatchStatus;
  statusShort: string;
  elapsed?: number;
  venue?: string;
  referee?: string;
  home: DetailTeam;
  away: DetailTeam;
  halftime?: [number, number];
  penalty?: [number, number];
  events: DetailEvent[];
  stats: StatRow[];
  lineups: { home?: Lineup; away?: Lineup };
  absences?: { home: Absence[]; away: Absence[] };
}

/* ───────── API-Football 원본 형태 (필요한 것만) ───────── */

interface AFPerson {
  id: number | null;
  name: string | null;
}
interface AFFixtureFull {
  fixture: {
    id: number;
    date: string;
    referee: string | null;
    venue: { name: string | null; city: string | null };
    status: { short: string; elapsed: number | null };
  };
  league: { id: number; round?: string };
  teams: { home: { id: number; name: string; logo?: string }; away: { id: number; name: string; logo?: string } };
  goals: { home: number | null; away: number | null };
  score: {
    halftime: { home: number | null; away: number | null };
    penalty: { home: number | null; away: number | null };
  };
  events?: {
    time: { elapsed: number; extra: number | null };
    team: { id: number };
    player: AFPerson;
    assist: AFPerson;
    type: string;
    detail: string;
    comments: string | null;
  }[];
  lineups?: {
    team: {
      id: number;
      colors?: {
        player?: { primary?: string; number?: string };
        goalkeeper?: { primary?: string; number?: string };
      } | null;
    };
    coach?: { name?: string | null };
    formation: string | null;
    startXI: { player: { id: number; name: string; number: number | null; pos: string | null; grid: string | null } }[];
    substitutes: { player: { id: number; name: string; number: number | null; pos: string | null; grid: string | null } }[];
  }[];
  statistics?: { team: { id: number }; statistics: { type: string; value: number | string | null }[] }[];
  players?: { team: { id: number }; players: AFPlayerEntry[] }[];
}

interface AFPlayerEntry {
  player: { id: number };
  statistics: {
    games: { rating: string | null; captain: boolean };
    goals: { total: number | null; assists: number | null };
    cards: { yellow: number; red: number };
  }[];
}

interface AFInjury {
  player: { id: number; name: string; photo?: string; type: string; reason: string };
  team: { id: number };
}

/* ───────── 변환 ───────── */

const STAT_LABELS: [string, string][] = [
  ["Ball Possession", "점유율"],
  ["expected_goals", "기대 득점(xG)"],
  ["Total Shots", "슈팅"],
  ["Shots on Goal", "유효 슈팅"],
  ["Shots insidebox", "박스 안 슈팅"],
  ["Blocked Shots", "막힌 슈팅"],
  ["Corner Kicks", "코너킥"],
  ["Total passes", "패스"],
  ["Passes %", "패스 성공률"],
  ["Fouls", "파울"],
  ["Offsides", "오프사이드"],
  ["Goalkeeper Saves", "선방"],
  ["Yellow Cards", "경고"],
  ["Red Cards", "퇴장"],
];

function num(v: number | string | null | undefined): number {
  if (v === null || v === undefined) return 0;
  if (typeof v === "number") return v;
  const n = parseFloat(v.replace("%", ""));
  return Number.isFinite(n) ? n : 0;
}

function text(v: number | string | null | undefined): string {
  if (v === null || v === undefined) return "0";
  return String(v);
}

/** 영어 결장 사유 → 한글 */
const BODY: [RegExp, string][] = [
  [/hamstring/i, "햄스트링"],
  [/knee|acl|cruciate|meniscus/i, "무릎"],
  [/ankle/i, "발목"],
  [/calf/i, "종아리"],
  [/thigh|quadriceps/i, "허벅지"],
  [/groin|adductor/i, "사타구니"],
  [/muscle/i, "근육"],
  [/foot|toe/i, "발"],
  [/back|lumbar/i, "허리"],
  [/shoulder/i, "어깨"],
  [/hip/i, "엉덩이"],
  [/achilles/i, "아킬레스건"],
  [/head|concussion/i, "머리"],
  [/jaw|face|nose|cheek|eye/i, "얼굴"],
  [/collarbone|clavicle/i, "쇄골"],
  [/leg|tibia|fibula|shin/i, "다리"],
  [/rib|chest/i, "갈비뼈"],
  [/hand|wrist|finger|arm/i, "손·팔"],
  [/illness|sick|virus|flu/i, "질병"],
];

export function translateAbsence(type: string, reason: string): { kind: AbsenceKind; reason: string } {
  if (/suspend|red card|yellow cards|card/i.test(reason)) {
    const why = /red card/i.test(reason) ? "퇴장 징계" : /yellow/i.test(reason) ? "경고 누적" : "출전 정지";
    return { kind: "suspension", reason: why };
  }
  const doubtful = /questionable|doubtful/i.test(type);
  if (/international duty|national/i.test(reason)) return { kind: doubtful ? "doubtful" : "injury", reason: "대표팀 차출" };
  if (/coach|personal|rest|inactive/i.test(reason)) return { kind: doubtful ? "doubtful" : "injury", reason: "개인 사정" };
  const part = BODY.find(([re]) => re.test(reason))?.[1];
  const broken = /broken|fracture/i.test(reason);
  const label = part
    ? part === "질병"
      ? "질병"
      : `${part} ${broken ? "골절" : "부상"}`
    : broken
      ? "골절"
      : /surgery/i.test(reason)
        ? "수술 후 회복"
        : "부상";
  return { kind: doubtful ? "doubtful" : "injury", reason: label };
}

function shortName(full: string): string {
  // "Son Heung-Min" 은 그대로, "Bukayo Saka" → "Saka" 처럼 피치에선 성만
  const parts = full.trim().split(/\s+/);
  if (parts.length <= 1) return full;
  if (/[가-힣]/.test(full)) return full;
  return parts.slice(1).join(" ");
}

function normalize(f: AFFixtureFull): MatchDetail {
  const league = API_FOOTBALL_LEAGUES[f.league.id] ?? "PL";
  const homeId = f.teams.home.id;
  const sideOf = (teamId: number): Side => (teamId === homeId ? "home" : "away");

  /* 라인업 + 선수 평점 */
  const playerStats = new Map<number, AFPlayerEntry>();
  for (const t of f.players ?? []) for (const p of t.players) playerStats.set(p.player.id, p);

  const lineups: MatchDetail["lineups"] = {};
  const starters = new Set<number>();
  for (const l of f.lineups ?? []) {
    const toPlayer = (p: { id: number; name: string; number: number | null; pos: string | null; grid: string | null }): LineupPlayer => {
      const s = playerStats.get(p.id)?.statistics?.[0];
      const g = p.grid?.split(":").map(Number);
      return {
        id: p.id,
        name: shortName(p.name),
        number: p.number,
        pos: p.pos,
        grid: g && g.length === 2 && g.every(Number.isFinite) ? [g[0], g[1]] : undefined,
        rating: s?.games.rating ? Number(s.games.rating) : undefined,
        goals: s?.goals.total ?? undefined,
        assists: s?.goals.assists ?? undefined,
        yellow: (s?.cards.yellow ?? 0) > 0,
        red: (s?.cards.red ?? 0) > 0,
        captain: s?.games.captain,
      };
    };
    l.startXI.forEach((x) => starters.add(x.player.id));
    const c = l.team.colors;
    lineups[sideOf(l.team.id)] = {
      formation: l.formation,
      coach: l.coach?.name ?? undefined,
      color: c?.player?.primary ? `#${c.player.primary}` : "#2c4bd4",
      numberColor: c?.player?.number ? `#${c.player.number}` : "#ffffff",
      gkColor: c?.goalkeeper?.primary ? `#${c.goalkeeper.primary}` : "#1f2937",
      startXI: l.startXI.map((x) => toPlayer(x.player)),
      subs: l.substitutes.map((x) => toPlayer(x.player)),
    };
  }

  /* 이벤트 */
  const onPitch = new Set(starters);
  let hs = 0;
  let as = 0;
  const events: DetailEvent[] = [];
  const sorted = [...(f.events ?? [])].sort(
    (a, b) => a.time.elapsed - b.time.elapsed || (a.time.extra ?? 0) - (b.time.extra ?? 0),
  );
  // 자책골의 team 이 '실점한 팀'인지 '득점한 팀'인지 → 최종 스코어와 맞는 해석을 고름
  const tally = (flip: boolean) => {
    let h = 0;
    let a = 0;
    for (const e of sorted) {
      if (e.type.toLowerCase() !== "goal" || e.detail.toLowerCase().includes("missed")) continue;
      const own = e.detail.toLowerCase().includes("own");
      const sd = sideOf(e.team.id);
      const b = own && flip ? (sd === "home" ? "away" : "home") : sd;
      if (b === "home") h++;
      else a++;
    }
    return h === (f.goals.home ?? -1) && a === (f.goals.away ?? -1);
  };
  const ownFlip = !tally(false) && tally(true);
  for (const e of sorted) {
    const side = sideOf(e.team.id);
    const base = { minute: e.time.elapsed, extra: e.time.extra ?? undefined, side };
    const who = e.player.name ?? "";
    const type = e.type.toLowerCase();
    const detail = e.detail.toLowerCase();

    if (type === "goal") {
      if (detail.includes("missed")) {
        events.push({ ...base, kind: "missedpen", player: who });
        continue;
      }
      const own = detail.includes("own");
      // 득점한 팀(점수가 올라가는 팀). 자책골은 API 표기 방식에 따라 뒤집힐 수 있어 아래에서 보정
      const benefit: Side = own && ownFlip ? (side === "home" ? "away" : "home") : side;
      if (benefit === "home") hs++;
      else as++;
      events.push({
        ...base,
        side: benefit,
        kind: own ? "owngoal" : detail.includes("penalty") ? "penalty" : "goal",
        player: who,
        second: own ? undefined : e.assist.name ?? undefined,
        scoreAfter: [hs, as],
      });
    } else if (type === "card") {
      const kind: EventKind = detail.includes("second") ? "secondyellow" : detail.includes("red") ? "red" : "yellow";
      events.push({ ...base, kind, player: who });
    } else if (type === "subst") {
      // player / assist 중 '경기장에 있던 선수'가 나간 선수
      const a = { id: e.player.id ?? -1, name: who };
      const b = { id: e.assist.id ?? -1, name: e.assist.name ?? "" };
      const [out, inn] = onPitch.has(b.id) && !onPitch.has(a.id) ? [b, a] : [a, b];
      onPitch.delete(out.id);
      onPitch.add(inn.id);
      events.push({ ...base, kind: "sub", player: inn.name, second: out.name });
      // 라인업에 교체 시간 표시
      const team = lineups[side];
      if (team) {
        const minute = e.time.elapsed;
        for (const p of [...team.startXI, ...team.subs]) {
          if (p.id === out.id) p.subOut = minute;
          if (p.id === inn.id) p.subIn = minute;
        }
      }
    } else if (type === "var") {
      events.push({ ...base, kind: "var", player: who, note: e.detail });
    }
  }

  /* 통계 */
  const statFor = (side: Side) => {
    const teamId = side === "home" ? homeId : f.teams.away.id;
    const list = f.statistics?.find((s) => s.team.id === teamId)?.statistics ?? [];
    return new Map(list.map((s) => [s.type, s.value]));
  };
  const hStat = statFor("home");
  const aStat = statFor("away");
  const stats: StatRow[] = STAT_LABELS.filter(([k]) => hStat.has(k) || aStat.has(k)).map(([k, label]) => ({
    label,
    home: num(hStat.get(k)),
    away: num(aStat.get(k)),
    homeText: text(hStat.get(k)),
    awayText: text(aStat.get(k)),
  }));

  const pair = (o: { home: number | null; away: number | null }): [number, number] | undefined =>
    o.home !== null && o.away !== null ? [o.home, o.away] : undefined;

  return {
    id: f.fixture.id,
    league,
    round: f.league.round,
    kickoff: new Date(f.fixture.date).toISOString(),
    status: afStatus(f.fixture.status.short),
    statusShort: f.fixture.status.short,
    elapsed: f.fixture.status.elapsed ?? undefined,
    venue: [f.fixture.venue.name, f.fixture.venue.city].filter(Boolean).join(", ") || undefined,
    referee: f.fixture.referee ?? undefined,
    home: { id: homeId, name: teamName(league, f.teams.home.name, homeId), logo: f.teams.home.logo, score: f.goals.home },
    away: { id: f.teams.away.id, name: teamName(league, f.teams.away.name, f.teams.away.id), logo: f.teams.away.logo, score: f.goals.away },
    halftime: pair(f.score.halftime),
    penalty: pair(f.score.penalty),
    events,
    stats,
    lineups,
  };
}

/* ───────── 불러오기 (상태에 따라 캐시 시간이 다름) ───────── */

async function rawFixture(id: number): Promise<MatchDetail | null> {
  const rows = await afGet<AFFixtureFull>("fixtures", { id });
  return rows[0] ? normalize(rows[0]) : null;
}

const fixtureLive = cached("fx-live-v2", TTL.liveDetail, rawFixture);
const fixtureDone = cached("fx-done-v2", TTL.finishedDetail, rawFixture);
const fixtureSoon = cached("fx-soon-v2", TTL.upcomingDetail, rawFixture);

async function rawInjuries(fixtureId: number, homeId: number): Promise<{ home: Absence[]; away: Absence[] }> {
  const rows = await afGet<AFInjury>("injuries", { fixture: fixtureId }, { optional: true });
  const out = { home: [] as Absence[], away: [] as Absence[] };
  const seen = new Set<number>();
  for (const r of rows) {
    if (!r.player.name?.trim() || seen.has(r.player.id)) continue;
    seen.add(r.player.id);
    const t = translateAbsence(r.player.type, r.player.reason);
    out[r.team.id === homeId ? "home" : "away"].push({ name: r.player.name, photo: r.player.photo, ...t });
  }
  const order: Record<AbsenceKind, number> = { suspension: 0, injury: 1, doubtful: 2 };
  out.home.sort((a, b) => order[a.kind] - order[b.kind]);
  out.away.sort((a, b) => order[a.kind] - order[b.kind]);
  return out;
}
const injuries = cached("injuries-v2", TTL.injuries, rawInjuries);

/** 오늘/어제 경기 목록(이미 캐시됨)에서 상태를 먼저 확인 → 알맞은 캐시로 1회만 호출 */
async function statusHint(id: number): Promise<MatchStatus | undefined> {
  try {
    const today = kstDate(new Date());
    const list = await fetchApiFootball(addDays(today, -1), today);
    const m = list.find((x) => x.id === `af-${id}`);
    if (!m) return undefined;
    // 목록 캐시가 늦어서 '예정'으로 남아 있어도 킥오프가 지났으면 진행 중으로 취급
    if (m.status === "scheduled" && Date.parse(m.kickoff) < Date.now()) return "live";
    return m.status;
  } catch {
    return undefined;
  }
}

/** 경기 상세 (시작 전이면 결장자까지) */
export async function getMatchDetail(id: number): Promise<MatchDetail | null> {
  const hint = await statusHint(id);
  const load = hint === "live" ? fixtureLive : hint === "finished" ? fixtureDone : fixtureSoon;
  let d = await load(id);
  if (!d) return null;

  if (d.status === "scheduled" || d.status === "postponed") {
    try {
      d = { ...d, absences: await injuries(id, d.home.id) };
    } catch (e) {
      console.error("[football] injuries", e);
    }
  }
  return d;
}

export function leagueOf(d: MatchDetail) {
  return LEAGUE_MAP[d.league];
}
