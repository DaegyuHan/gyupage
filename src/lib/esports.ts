/**
 * LoL e스포츠 일정 — lolesports.com 이 쓰는 공개 데이터 (키는 사이트에 공개된 값)
 * T1, 한화생명(HLE) 경기만 골라서 다음 경기 / 최근 결과로 나눔. 10분 캐시.
 */
import { cached } from "./football/apiFootball";

const API = "https://esports-api.lolesports.com/persisted/gw/getSchedule?hl=ko-KR";
const PUBLIC_KEY = "0TvQnueqKa5mxJntVWt0w4LpLfEkrV1Ta8rQBb9Z";

/** 응원 팀 (팀 코드) */
export const MY_TEAMS = ["T1", "HLE"];

export interface EsportsTeam {
  code: string;
  name: string;
  image?: string;
  wins: number | null;
  outcome: "win" | "loss" | null;
  /** 이번 대회/스플릿 전적 */
  record?: { wins: number; losses: number };
  mine: boolean;
}

export interface EsportsMatch {
  id: string;
  start: string; // ISO
  state: "unstarted" | "inProgress" | "completed";
  league: string;
  block: string;
  bestOf: number;
  teams: [EsportsTeam, EsportsTeam];
}

export interface EsportsResponse {
  upcoming: EsportsMatch[];
  recent: EsportsMatch[];
}

/** 팀 이름 한글 (자주 보는 LCK 팀 위주, 나머지는 코드 그대로) */
const KO: Record<string, string> = {
  T1: "T1",
  HLE: "한화생명",
  GEN: "젠지",
  DK: "디플러스 기아",
  KT: "kt 롤스터",
  NS: "농심",
  DRX: "DRX",
  BRO: "OK저축은행 브리온",
  BFX: "BNK 피어엑스",
  KDF: "광동",
};

interface RawEvent {
  startTime: string;
  state: string;
  type: string;
  blockName?: string;
  league: { name: string };
  match?: {
    id: string;
    strategy?: { count: number };
    teams: {
      code: string;
      name: string;
      image?: string;
      result?: { outcome: "win" | "loss" | null; gameWins: number } | null;
      record?: { wins: number; losses: number } | null;
    }[];
  };
}

async function load(): Promise<EsportsMatch[]> {
  const res = await fetch(API, { headers: { "x-api-key": PUBLIC_KEY }, cache: "no-store" });
  if (!res.ok) throw new Error(`lolesports ${res.status}`);
  const j = (await res.json()) as { data?: { schedule?: { events?: RawEvent[] } } };
  const events = j.data?.schedule?.events ?? [];

  return events
    .filter((e) => e.type === "match" && e.match && e.match.teams.length === 2)
    .filter((e) => e.match!.teams.some((t) => MY_TEAMS.includes(t.code)))
    .map((e) => {
      const teams = e.match!.teams.map((t) => ({
        code: t.code,
        name: KO[t.code] ?? t.name,
        // http 이미지는 배포(https)에서 막힐 수 있어서 https 로
        image: t.image?.replace(/^http:\/\//, "https://"),
        wins: t.result?.gameWins ?? null,
        outcome: t.result?.outcome ?? null,
        record: t.record ?? undefined,
        mine: MY_TEAMS.includes(t.code),
      })) as [EsportsTeam, EsportsTeam];
      return {
        id: e.match!.id,
        start: e.startTime,
        state: (["unstarted", "inProgress", "completed"].includes(e.state) ? e.state : "unstarted") as EsportsMatch["state"],
        league: e.league.name,
        block: e.blockName ?? "",
        bestOf: e.match!.strategy?.count ?? 1,
        teams,
      };
    });
}

const loadCached = cached("esports-v1", 60 * 10, load);

export async function getEsports(): Promise<EsportsResponse> {
  const all = await loadCached();
  return {
    upcoming: all
      .filter((m) => m.state !== "completed")
      .sort((a, b) => a.start.localeCompare(b.start))
      .slice(0, 4),
    // 팀별로 가장 최근 경기 1개씩 (두 팀이 맞붙은 경기면 한 번만)
    recent: (() => {
      const done = all.filter((m) => m.state === "completed").sort((a, b) => b.start.localeCompare(a.start));
      const picked: EsportsMatch[] = [];
      for (const code of MY_TEAMS) {
        const m = done.find((x) => x.teams.some((t) => t.code === code));
        if (m && !picked.includes(m)) picked.push(m);
      }
      return picked.sort((a, b) => b.start.localeCompare(a.start));
    })(),
  };
}

/** 홈 주간 일정표용: 이 팀의 어제~8일 뒤 경기 */
export async function getEsportsWeek(code: string): Promise<EsportsMatch[]> {
  const all = await loadCached();
  const now = Date.now();
  return all
    .filter((m) => m.teams.some((t) => t.code === code))
    .filter((m) => {
      const t = Date.parse(m.start);
      return t > now - 36 * 3600_000 && t < now + 8 * 86400_000;
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}
