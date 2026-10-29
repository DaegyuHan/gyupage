/**
 * ESPN 경기 상세 (summary) → 기존 상세 페이지(MatchDetail) 모양
 * 키·한도 없음. API-Football 무료 요금제가 이번 시즌 경기를 안 줄 때 해외 경기 상세를 이걸로 보여줌.
 *   https://site.api.espn.com/apis/site/v2/sports/soccer/{리그}/summary?event={경기 id}
 */
import { mfetch } from "@/lib/server/monitor";
import { cached } from "./apiFootball";
import type { DetailEvent, EventKind, FormGame, Lineup, LineupPlayer, MatchDetail, Side, StatRow } from "./detail";
import type { LeagueId, MatchStatus } from "./types";

export const ESPN_SLUG: Partial<Record<LeagueId, string>> = {
  PL: "eng.1",
  PD: "esp.1",
  BL1: "ger.1",
  CL: "uefa.champions",
  EL: "uefa.europa",
  EFL: "eng.league_cup",
  DFB: "ger.dfb_pokal",
};

/* ───────── ESPN 원본 (필요한 것만) ───────── */
interface EspnPerson {
  displayName?: string;
}
interface EspnSummary {
  header?: {
    season?: { name?: string };
    competitions?: {
      date?: string;
      status?: { displayClock?: string; period?: number; type?: { state?: string; name?: string; detail?: string } };
      competitors?: {
        id?: string;
        homeAway?: "home" | "away";
        score?: string;
        shootoutScore?: number;
        linescores?: { displayValue?: string }[];
        team?: { displayName?: string; logos?: { href?: string }[]; logo?: string };
      }[];
    }[];
  };
  keyEvents?: {
    type?: { type?: string; text?: string };
    clock?: { displayValue?: string };
    team?: { id?: string };
    scoringPlay?: boolean;
    shootout?: boolean;
    participants?: { athlete?: EspnPerson }[];
  }[];
  boxscore?: { teams?: { team?: { id?: string }; statistics?: { name?: string; displayValue?: string }[] }[] };
  rosters?: {
    homeAway?: "home" | "away";
    formation?: string;
    team?: { id?: string; color?: string; alternateColor?: string };
    roster?: {
      jersey?: string;
      starter?: boolean;
      subbedIn?: boolean;
      subbedOut?: boolean;
      captain?: boolean;
      athlete?: EspnPerson & { id?: string };
      position?: { abbreviation?: string };
      stats?: { name?: string; value?: number }[];
      plays?: { clock?: { displayValue?: string }; substitution?: boolean }[];
    }[];
  }[];
  gameInfo?: {
    venue?: { fullName?: string; address?: { city?: string } };
    attendance?: number;
    officials?: { displayName?: string; position?: { displayName?: string } }[];
  };
  broadcasts?: { media?: { shortName?: string } }[];
  lastFiveGames?: { team?: { id?: string; displayName?: string }; events?: EspnFormEvent[] }[];
  headToHeadGames?: { team?: { id?: string }; events?: EspnFormEvent[] }[];
  news?: { articles?: { headline?: string; links?: { web?: { href?: string } } }[] };
  videos?: { headline?: string; duration?: number; thumbnail?: string; links?: { web?: { href?: string }; source?: { HD?: { href?: string }; href?: string } } }[];
}
interface EspnFormEvent {
  gameDate?: string;
  score?: string;
  gameResult?: string;
  atVs?: string;
  opponent?: { displayName?: string; logo?: string };
  leagueAbbreviation?: string;
}

/* ───────── 변환 ───────── */

/** "45'+2'" → [45, 2] */
function minuteOf(s?: string): [number, number | undefined] {
  const m = s?.match(/(\d+)'?(?:\s*\+\s*(\d+))?/);
  return m ? [Number(m[1]), m[2] ? Number(m[2]) : undefined] : [0, undefined];
}

const STATS: [string, string, "pct" | "ratio" | "num"][] = [
  ["possessionPct", "점유율", "pct"],
  ["totalShots", "슈팅", "num"],
  ["shotsOnTarget", "유효 슈팅", "num"],
  ["blockedShots", "막힌 슈팅", "num"],
  ["wonCorners", "코너킥", "num"],
  ["offsides", "오프사이드", "num"],
  ["foulsCommitted", "파울", "num"],
  ["yellowCards", "경고", "num"],
  ["redCards", "퇴장", "num"],
  ["saves", "선방", "num"],
  ["totalPasses", "패스", "num"],
  ["passPct", "패스 성공률", "ratio"],
  ["totalCrosses", "크로스", "num"],
  ["totalLongBalls", "롱볼", "num"],
  ["totalTackles", "태클", "num"],
  ["interceptions", "인터셉트", "num"],
  ["totalClearance", "클리어링", "num"],
];

function status(s?: { type?: { state?: string; name?: string } }): MatchStatus {
  const name = s?.type?.name ?? "";
  if (/POSTPONED|CANCELED|SUSPENDED|ABANDONED/.test(name)) return "postponed";
  if (s?.type?.state === "post") return "finished";
  if (s?.type?.state === "in") return "live";
  return "scheduled";
}

/** 기존 화면의 상태 문구(API-Football 코드)에 맞춤 */
function statusShort(s?: { period?: number; type?: { state?: string; name?: string } }) {
  const name = s?.type?.name ?? "";
  if (/PEN/.test(name)) return "PEN";
  if (/AET|EXTRA_TIME/.test(name) && s?.type?.state === "post") return "AET";
  if (/HALFTIME/.test(name)) return "HT";
  if (/POSTPONED/.test(name)) return "PST";
  if (/CANCELED/.test(name)) return "CANC";
  if (s?.type?.state === "post") return "FT";
  if (s?.type?.state === "in") return (s.period ?? 1) >= 3 ? "ET" : (s.period ?? 1) === 2 ? "2H" : "1H";
  return "NS";
}

function formList(events?: EspnFormEvent[]): FormGame[] {
  return (events ?? []).slice(0, 5).map((e) => ({
    date: e.gameDate ? new Date(Date.parse(e.gameDate) + 9 * 3600_000).toISOString().slice(0, 10) : "",
    opponent: e.opponent?.displayName ?? "?",
    opponentLogo: e.opponent?.logo,
    home: e.atVs !== "@",
    score: e.score ?? "",
    result: (e.gameResult === "W" || e.gameResult === "D" || e.gameResult === "L" ? e.gameResult : undefined) as FormGame["result"],
    competition: e.leagueAbbreviation,
  }));
}

function toDetail(league: LeagueId, eventId: string, j: EspnSummary): MatchDetail | null {
  const hc = j.header?.competitions?.[0];
  const comps = hc?.competitors ?? [];
  const H = comps.find((c) => c.homeAway === "home");
  const A = comps.find((c) => c.homeAway === "away");
  if (!hc || !H || !A) return null;
  const st = status(hc.status);
  const sideOf = (teamId?: string): Side | null => (teamId === H.id ? "home" : teamId === A.id ? "away" : null);
  const num = (v?: string) => (v == null || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

  /* 경기 흐름 */
  const events: DetailEvent[] = [];
  let hs = 0;
  let as = 0;
  for (const e of j.keyEvents ?? []) {
    if (e.shootout) continue;
    const side = sideOf(e.team?.id);
    const t = e.type?.type ?? "";
    const who = e.participants?.[0]?.athlete?.displayName;
    if (!side || !who) continue;
    const [minute, extra] = minuteOf(e.clock?.displayValue);
    const base = { minute, extra, side };
    if (e.scoringPlay || /goal/.test(t)) {
      const own = /own/.test(t);
      const pen = /penalty/.test(t);
      // 자책골은 상대 팀 점수
      const scorerSide = own ? (side === "home" ? "away" : "home") : side;
      if (scorerSide === "home") hs++;
      else as++;
      events.push({
        ...base,
        side: scorerSide,
        kind: own ? "owngoal" : pen ? "penalty" : "goal",
        player: who,
        second: own ? undefined : e.participants?.[1]?.athlete?.displayName,
        scoreAfter: [hs, as],
      });
    } else if (/red/.test(t) || /yellow/.test(t)) {
      const kind: EventKind = /second|2nd/.test(t) ? "secondyellow" : /red/.test(t) ? "red" : "yellow";
      events.push({ ...base, kind, player: who });
    } else if (/substitution/.test(t)) {
      // 들어온 선수, 나간 선수 순서
      events.push({ ...base, kind: "sub", player: who, second: e.participants?.[1]?.athlete?.displayName });
    } else if (/penalty---missed|missed/.test(t)) {
      events.push({ ...base, kind: "missedpen", player: who });
    }
  }

  /* 통계 */
  const statMap = (teamId?: string) => new Map((j.boxscore?.teams?.find((t) => t.team?.id === teamId)?.statistics ?? []).map((s) => [s.name ?? "", s.displayValue ?? ""]));
  const hS = statMap(H.id);
  const aS = statMap(A.id);
  const stats: StatRow[] = STATS.filter(([k]) => hS.has(k) && aS.has(k)).map(([k, label, kind]) => {
    const conv = (v: string) => (kind === "ratio" ? Math.round(Number(v) * 100) : Number(v));
    const h = conv(hS.get(k)!);
    const a = conv(aS.get(k)!);
    const unit = kind === "num" ? "" : "%";
    return { label, home: Number.isFinite(h) ? h : 0, away: Number.isFinite(a) ? a : 0, homeText: `${Number.isFinite(h) ? h : "-"}${unit}`, awayText: `${Number.isFinite(a) ? a : "-"}${unit}` };
  });

  /* 라인업 (선발 위치 좌표가 없어서 목록으로 보임) */
  const lineupOf = (side: Side): Lineup | undefined => {
    const r = j.rosters?.find((x) => x.homeAway === side);
    if (!r?.roster?.length) return undefined;
    const players: (LineupPlayer & { starter: boolean })[] = r.roster.map((p, i) => {
      const stat = (n: string) => p.stats?.find((s) => s.name === n)?.value ?? 0;
      const sub = p.plays?.find((x) => x.substitution);
      const subMin = sub ? minuteOf(sub.clock?.displayValue)[0] : undefined;
      return {
        id: Number(p.athlete?.id ?? i),
        name: p.athlete?.displayName ?? "?",
        number: p.jersey ? Number(p.jersey) : null,
        pos: p.position?.abbreviation ?? null,
        goals: stat("totalGoals") || undefined,
        assists: stat("goalAssists") || undefined,
        yellow: stat("yellowCards") > 0 || undefined,
        red: stat("redCards") > 0 || undefined,
        subIn: p.subbedIn ? subMin : undefined,
        subOut: p.subbedOut ? subMin : undefined,
        captain: p.captain || undefined,
        starter: !!p.starter,
      };
    });
    const color = r.team?.color ? `#${r.team.color}` : side === "home" ? "#2c4bd4" : "#d4483b";
    return {
      formation: r.formation ?? null,
      color,
      numberColor: "#ffffff",
      gkColor: "#1f2937",
      startXI: players.filter((p) => p.starter),
      subs: players.filter((p) => !p.starter),
    };
  };

  const half = (c: typeof H) => num(c.linescores?.[0]?.displayValue);
  const hh = half(H);
  const ah = half(A);
  const pens = H.shootoutScore != null && A.shootoutScore != null && H.shootoutScore + A.shootoutScore > 0 ? ([H.shootoutScore, A.shootoutScore] as [number, number]) : undefined;
  const [elapsed] = minuteOf(hc.status?.displayClock);
  const ref = j.gameInfo?.officials?.find((o) => /referee/i.test(o.position?.displayName ?? "")) ?? j.gameInfo?.officials?.[0];
  const logo = (c: typeof H) => c.team?.logos?.[0]?.href ?? c.team?.logo;

  return {
    id: Number(eventId),
    league,
    round: j.header?.season?.name,
    kickoff: new Date(hc.date ?? Date.now()).toISOString(),
    status: st,
    statusShort: statusShort(hc.status),
    elapsed: st === "live" ? elapsed || undefined : undefined,
    venue: [j.gameInfo?.venue?.fullName, j.gameInfo?.venue?.address?.city].filter(Boolean).join(", ") || undefined,
    referee: ref?.displayName,
    home: { id: Number(H.id), name: H.team?.displayName ?? "?", logo: logo(H), score: st === "scheduled" ? null : num(H.score) },
    away: { id: Number(A.id), name: A.team?.displayName ?? "?", logo: logo(A), score: st === "scheduled" ? null : num(A.score) },
    halftime: hh != null && ah != null && st !== "scheduled" ? [hh, ah] : undefined,
    penalty: pens,
    events,
    stats,
    lineups: { home: lineupOf("home"), away: lineupOf("away") },
    attendance: j.gameInfo?.attendance || undefined,
    broadcast: (j.broadcasts ?? []).map((b) => b.media?.shortName).filter(Boolean).join(", ") || undefined,
    form: {
      home: formList(j.lastFiveGames?.find((t) => t.team?.id === H.id)?.events),
      away: formList(j.lastFiveGames?.find((t) => t.team?.id === A.id)?.events),
    },
    h2h: formList(j.headToHeadGames?.find((t) => t.team?.id === H.id)?.events ?? j.headToHeadGames?.[0]?.events),
    videos: (j.videos ?? [])
      .slice(0, 6)
      .map((v) => ({ title: v.headline ?? "영상", href: v.links?.web?.href ?? v.links?.source?.HD?.href ?? v.links?.source?.href ?? "", duration: v.duration, thumb: v.thumbnail }))
      .filter((v) => v.href),
    news: (j.news?.articles ?? [])
      .slice(0, 5)
      .map((a) => ({ title: a.headline ?? "", href: a.links?.web?.href ?? "" }))
      .filter((a) => a.title && a.href),
    source: "ESPN",
  };
}

const summary = cached("espn-summary-v1", 90, async (league: LeagueId, eventId: string): Promise<MatchDetail | null> => {
  const slug = ESPN_SLUG[league];
  if (!slug) return null;
  const res = await mfetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${slug}/summary?event=${encodeURIComponent(eventId)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`espn summary ${res.status}`);
  return toDetail(league, eventId, (await res.json()) as EspnSummary);
});

/** "espn-PL-401921834" → 상세 */
export async function getEspnDetail(idText: string): Promise<MatchDetail | null> {
  const m = idText.match(/^espn-([A-Z0-9]+)-(\d+)$/);
  if (!m || !(m[1] in ESPN_SLUG)) return null;
  return summary(m[1] as LeagueId, m[2]);
}
