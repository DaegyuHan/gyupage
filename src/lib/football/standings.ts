/**
 * 순위표 / 득점 순위.
 *
 * API-Football 무료 플랜은 '현재 시즌' 순위·득점 순위를 막아둬서 다른 공개 데이터를 씀:
 * - 해외(프리미어리그·라리가·분데스리가·챔피언스리그): ESPN 공개 데이터
 * - K리그1·K리그2: 네이버 스포츠 데이터 (한글 팀명·선수명, 파이널 A/B 그룹, 최근 5경기)
 * 둘 다 키가 필요 없고 호출 제한도 없지만, 예의상 30분씩 캐시함.
 */
import { cached } from "./apiFootball";
import { currentSeason } from "./leagues";
import type { LeagueId } from "./types";
import { mfetch } from "@/lib/server/monitor";
import { kleagueRank, kleagueScorers } from "./kleague";

export type Zone = "top" | "second" | "third" | "playoff" | "relegation" | null;

export interface StandingRow {
  rank: number;
  teamId: string;
  team: string;
  logo?: string;
  played: number;
  win: number;
  draw: number;
  lose: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  /** 최근 경기 결과, 왼쪽이 오래된 것 → 오른쪽이 최근 */
  form: ("W" | "D" | "L")[];
  zone: Zone;
  zoneLabel?: string;
}

export interface StandingGroup {
  name?: string;
  rows: StandingRow[];
}

export interface Standings {
  league: LeagueId;
  season: number;
  groups: StandingGroup[];
  legend: { zone: Exclude<Zone, null>; label: string }[];
  /** 최근 경기 정보가 있는지 (없으면 열을 숨김) */
  hasForm: boolean;
  source: string;
}

export interface Scorer {
  rank: number;
  name: string;
  photo?: string;
  team: string;
  teamLogo?: string;
  goals: number;
  assists: number;
  apps: number;
}

const TTL = 60 * 30;
const UA = { "User-Agent": "Mozilla/5.0 (gyupage personal dashboard)" };

async function getJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const res = await mfetch(url, { cache: "no-store", headers: { ...UA, ...headers }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

/* ───────── 존(색 구간) 분류 ───────── */

export function classify(desc: string | null | undefined): { zone: Zone; label?: string } {
  if (!desc) return { zone: null };
  const d = desc.toLowerCase();
  const ko = translateDesc(desc);
  if (/relegation round|championship round|final round/.test(d)) return { zone: null };
  if (/play[- ]?offs?|1\/16/.test(d)) return { zone: "playoff", label: ko };
  if (/relegation/.test(d)) return { zone: "relegation", label: "강등" };
  if (/europa|acl two|afc cup/.test(d)) return { zone: "second", label: ko };
  if (/conference/.test(d)) return { zone: "third", label: ko };
  if (/champions league|acl elite|1\/8|round of 16|promotion/.test(d)) return { zone: "top", label: ko };
  return { zone: null, label: ko };
}

function translateDesc(s: string): string {
  return s
    .replace(/Qualifies for /i, "")
    .replace(/Promotion - /i, "")
    .replace(/UEFA /gi, "")
    .replace(/AFC Champions League Elite/gi, "ACL 엘리트")
    .replace(/AFC Champions League Two/gi, "ACL 2")
    .replace(/Champions League/gi, "챔피언스리그")
    .replace(/Europa League/gi, "유로파리그")
    .replace(/Conference League/gi, "컨퍼런스리그")
    .replace(/Knockout Round Play[- ]?offs?/gi, "16강 플레이오프")
    .replace(/Relegation Play[- ]?offs?/gi, "강등 플레이오프")
    .replace(/Promotion Play[- ]?offs?/gi, "승격 플레이오프")
    .replace(/Relegation/gi, "강등")
    .replace(/Promotion/gi, "승격")
    .replace(/Play[- ]?offs?/gi, "플레이오프")
    .replace(/round of 16|1\/8-finals/gi, "16강 직행")
    .replace(/1\/16-finals/gi, "16강 플레이오프")
    .replace(/Qualifiers?|Qualification/gi, "예선")
    .replace(/League phase|Group Stage/gi, "본선")
    .replace(/\s*:\s*\)/g, ")")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .replace(/\(\)/g, "")
    .trim();
}

function buildLegend(groups: StandingGroup[]) {
  const legend = new Map<Exclude<Zone, null>, string>();
  for (const g of groups) for (const r of g.rows) if (r.zone && r.zoneLabel && !legend.has(r.zone)) legend.set(r.zone, r.zoneLabel);
  return [...legend.entries()].map(([zone, label]) => ({ zone, label }));
}

/* ───────── 해외: ESPN ───────── */

const ESPN_SLUG: Partial<Record<LeagueId, string>> = {
  PL: "eng.1",
  PD: "esp.1",
  BL1: "ger.1",
  CL: "uefa.champions",
  EL: "uefa.europa",
};

interface EspnStandings {
  children?: {
    name?: string;
    standings: {
      entries: {
        team: { id: string; displayName: string; shortDisplayName?: string; logos?: { href: string }[] };
        note?: { description?: string };
        stats: { name: string; value?: number; displayValue?: string }[];
      }[];
    };
  }[];
}

async function espnStandings(league: LeagueId, season: number): Promise<Standings> {
  const slug = ESPN_SLUG[league]!;
  const j = await getJson<EspnStandings>(`https://site.api.espn.com/apis/v2/sports/soccer/${slug}/standings`);
  const groups: StandingGroup[] = (j.children ?? []).map((c, _i, all) => ({
    name: all.length > 1 ? c.name : undefined,
    rows: c.standings.entries
      .map((e) => {
        const st = new Map(e.stats.map((s) => [s.name, s.value ?? Number(s.displayValue ?? 0)]));
        const z = classify(e.note?.description);
        return {
          rank: st.get("rank") ?? 0,
          teamId: e.team.id,
          team: e.team.shortDisplayName || e.team.displayName,
          logo: e.team.logos?.[0]?.href,
          played: st.get("gamesPlayed") ?? 0,
          win: st.get("wins") ?? 0,
          draw: st.get("ties") ?? 0,
          lose: st.get("losses") ?? 0,
          gf: st.get("pointsFor") ?? 0,
          ga: st.get("pointsAgainst") ?? 0,
          gd: st.get("pointDifferential") ?? 0,
          points: st.get("points") ?? 0,
          form: [],
          zone: z.zone,
          zoneLabel: z.label,
        };
      })
      .sort((a, b) => a.rank - b.rank),
  }));
  return { league, season, groups, legend: buildLegend(groups), hasForm: false, source: "ESPN" };
}

interface EspnLeaders {
  stats?: {
    name: string;
    leaders: {
      value: number;
      athlete: {
        displayName: string;
        headshot?: { href?: string };
        team?: { displayName?: string; logos?: { href: string }[] };
        statistics?: { name: string; value: number }[];
      };
    }[];
  }[];
}

async function espnScorers(league: LeagueId): Promise<Scorer[]> {
  const slug = ESPN_SLUG[league]!;
  const j = await getJson<EspnLeaders>(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/statistics`);
  const goals = j.stats?.find((s) => s.name === "goalsLeaders")?.leaders ?? [];
  return goals.slice(0, 15).map((l, i) => {
    const st = new Map((l.athlete.statistics ?? []).map((s) => [s.name, s.value]));
    return {
      rank: i + 1,
      name: l.athlete.displayName,
      photo: l.athlete.headshot?.href,
      team: l.athlete.team?.displayName ?? "",
      teamLogo: l.athlete.team?.logos?.[0]?.href,
      goals: l.value,
      assists: st.get("goalAssists") ?? 0,
      apps: st.get("appearances") ?? 0,
    };
  });
}

/* ───────── K리그: K리그 공식 사이트 ───────── */

/** K리그 공식 엠블럼 */
const kEmblem = (teamId: string) => `https://www.kleague.com/assets/images/emblem/emblem_K${teamId}.png`;
const K_LEAGUE: Partial<Record<LeagueId, number>> = { K1: 1, K2: 2 };

async function kleagueStandings(league: LeagueId, season: number): Promise<Standings> {
  const rows = await kleagueRank(K_LEAGUE[league]!, season);
  if (!rows.length) throw new Error("kleague.com 순위 없음");
  return {
    league,
    season,
    groups: [{ rows: rows.map((r) => ({ ...r, team: r.teamName, logo: kEmblem(r.teamId), zone: null })).sort((a, b) => a.rank - b.rank) }],
    legend: [],
    hasForm: rows.some((r) => r.form.length > 0),
    source: "K리그 공식",
  };
}

async function kleagueTopScorers(league: LeagueId, season: number): Promise<Scorer[]> {
  const list = await kleagueScorers(K_LEAGUE[league]!, season);
  return list.slice(0, 15).map((p) => ({ rank: p.rank, name: p.name, team: p.teamName, teamLogo: kEmblem(p.teamId), goals: p.goals, assists: p.assists, apps: p.apps }));
}

/* ───────── 공개 함수 ───────── */

const standingsCached = cached("standings-v4", TTL, async (league: LeagueId, season: number) =>
  K_LEAGUE[league] ? kleagueStandings(league, season) : espnStandings(league, season),
);
const scorersCached = cached("scorers-v3", TTL, async (league: LeagueId, season: number) =>
  K_LEAGUE[league] ? kleagueTopScorers(league, season) : espnScorers(league),
);

export function getStandings(league: LeagueId) {
  return standingsCached(league, currentSeason(league));
}

export function getTopScorers(league: LeagueId) {
  return scorersCached(league, currentSeason(league));
}
