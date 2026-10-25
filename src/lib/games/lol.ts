/**
 * LoL — Riot API. 최근 7일 동안 하루에 몇 판 했는지 + 그날 승패.
 * .env.local: RIOT_API_KEY, RIOT_ID(게임이름#태그)
 * 경기 상세는 바뀌지 않으니 오래 저장하고, 목록·랭크는 20분마다 새로.
 */
import { cached } from "../football/apiFootball";
import { mfetch } from "@/lib/server/monitor";

const ASIA = "https://asia.api.riotgames.com";
const KR = "https://kr.api.riotgames.com";

export class LolSetupError extends Error {}
export class LolKeyError extends Error {}

async function riot<T>(url: string): Promise<T> {
  const key = process.env.RIOT_API_KEY;
  if (!key) throw new LolSetupError("NO_KEY");
  const res = await mfetch(url, { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (res.status === 401 || res.status === 403) {
    const body = await res.text().catch(() => "");
    throw new LolKeyError(`riot ${res.status} ${url.replace(/\?.*/, "").replace(/^https:\/\/[^/]+/, "")} ${body.slice(0, 120)}`);
  }
  if (!res.ok) throw new Error(`riot ${res.status} ${url.replace(/\?.*/, "")}`);
  return (await res.json()) as T;
}

export interface LolDay {
  date: string; // KST YYYY-MM-DD
  games: number;
  wins: number;
  losses: number;
}

export interface LolSummary {
  riotId: string;
  level: number | null;
  icon: string | null;
  solo: { tier: string; rank: string; lp: number; wins: number; losses: number } | null;
  days: LolDay[]; // 오래된 날 → 오늘
  total: { games: number; wins: number; losses: number };
  topChamps: { name: string; games: number; wins: number; icon: string }[];
  updatedAt: string;
}

const puuidCached = cached("lol-puuid-v1", 60 * 60 * 24 * 30, async (riotId: string) => {
  const [name, tag] = riotId.split("#");
  const j = await riot<{ puuid: string }>(`${ASIA}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(name)}/${encodeURIComponent(tag ?? "KR1")}`);
  return j.puuid;
});

interface MatchLite {
  start: number; // ms
  remake: boolean;
  win: boolean;
  champ: string;
}

/** 경기 하나 — 결과가 바뀌지 않아서 30일 저장 */
const matchCached = cached("lol-match-v1", 60 * 60 * 24 * 30, async (id: string, puuid: string): Promise<MatchLite | null> => {
  const m = await riot<{
    info: { gameStartTimestamp: number; gameDuration: number; participants: { puuid: string; win: boolean; championName: string; gameEndedInEarlySurrender?: boolean }[] };
  }>(`${ASIA}/lol/match/v5/matches/${id}`);
  const me = m.info.participants.find((p) => p.puuid === puuid);
  if (!me) return null;
  return {
    start: m.info.gameStartTimestamp,
    // 다시하기(3분 남짓 끝난 판)는 판수에서 뺌
    remake: m.info.gameDuration < 300 || !!me.gameEndedInEarlySurrender,
    win: me.win,
    champ: me.championName,
  };
});

const kstDate = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10);

async function ddragonVersion() {
  try {
    const res = await mfetch("https://ddragon.leagueoflegends.com/api/versions.json", { cache: "no-store" });
    return ((await res.json()) as string[])[0];
  } catch {
    return "14.1.1";
  }
}

async function load(riotId: string): Promise<LolSummary> {
  const puuid = await puuidCached(riotId);
  // 오늘 포함 7일 (KST 자정 기준)
  const todayKst = kstDate(Date.now());
  const startMs = Date.parse(`${todayKst}T00:00:00+09:00`) - 6 * 86400_000;

  const [ids, summoner, leagues, ver] = await Promise.all([
    riot<string[]>(`${ASIA}/lol/match/v5/matches/by-puuid/${puuid}/ids?startTime=${Math.floor(startMs / 1000)}&count=100`),
    riot<{ summonerLevel: number; profileIconId: number }>(`${KR}/lol/summoner/v4/summoners/by-puuid/${puuid}`).catch(() => null),
    riot<{ queueType: string; tier: string; rank: string; leaguePoints: number; wins: number; losses: number }[]>(
      `${KR}/lol/league/v4/entries/by-puuid/${puuid}`,
    ).catch(() => []),
    ddragonVersion(),
  ]);

  // 개발용 키 한도(1초 20회)를 넘지 않게 4개씩
  const matches: MatchLite[] = [];
  for (let i = 0; i < ids.length; i += 4) {
    const part = await Promise.all(ids.slice(i, i + 4).map((id) => matchCached(id, puuid).catch(() => null)));
    matches.push(...part.filter((m): m is MatchLite => !!m && !m.remake));
  }

  const days: LolDay[] = Array.from({ length: 7 }, (_, i) => ({ date: kstDate(startMs + i * 86400_000 + 3600_000), games: 0, wins: 0, losses: 0 }));
  for (const m of matches) {
    const d = days.find((x) => x.date === kstDate(m.start));
    if (!d) continue;
    d.games++;
    if (m.win) d.wins++;
    else d.losses++;
  }

  const champs = new Map<string, { games: number; wins: number }>();
  for (const m of matches) {
    const c = champs.get(m.champ) ?? { games: 0, wins: 0 };
    c.games++;
    if (m.win) c.wins++;
    champs.set(m.champ, c);
  }

  const solo = leagues.find((l) => l.queueType === "RANKED_SOLO_5x5");
  const total = days.reduce((t, d) => ({ games: t.games + d.games, wins: t.wins + d.wins, losses: t.losses + d.losses }), { games: 0, wins: 0, losses: 0 });

  return {
    riotId,
    level: summoner?.summonerLevel ?? null,
    icon: summoner ? `https://ddragon.leagueoflegends.com/cdn/${ver}/img/profileicon/${summoner.profileIconId}.png` : null,
    solo: solo ? { tier: solo.tier, rank: solo.rank, lp: solo.leaguePoints, wins: solo.wins, losses: solo.losses } : null,
    days,
    total,
    topChamps: [...champs.entries()]
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 3)
      .map(([name, c]) => ({ name, ...c, icon: `https://ddragon.leagueoflegends.com/cdn/${ver}/img/champion/${name}.png` })),
    updatedAt: new Date().toISOString(),
  };
}

const loadCached = cached("lol-v2", 60 * 20, load);

export function getLol() {
  const id = process.env.RIOT_ID?.trim().replace(/^["']|["']$/g, "");
  if (!process.env.RIOT_API_KEY || !id) throw new LolSetupError("SETUP");
  return loadCached(id);
}
