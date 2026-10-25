/**
 * Steam — Steam Web API (https://steamcommunity.com/dev/apikey)
 * .env.local: STEAM_API_KEY, STEAM_ID (17자리 숫자 ID 또는 프로필 주소/사용자 지정 주소)
 * 프로필이 '공개'여야 게임 기록이 나와요. 15분 캐시.
 */
import { cached } from "../football/apiFootball";
import { mfetch } from "@/lib/server/monitor";

const API = "https://api.steampowered.com";

export class SteamSetupError extends Error {}

async function st<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.STEAM_API_KEY;
  if (!key) throw new SteamSetupError("NO_KEY");
  const qs = new URLSearchParams({ key, format: "json", ...params });
  const res = await mfetch(`${API}/${path}?${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error(`steam ${path.split("/")[1]} ${res.status}`);
  return (await res.json()) as T;
}

export interface SteamGame {
  appid: number;
  name: string;
  /** 최근 2주 플레이 시간(분) */
  recent: number;
  /** 전체 플레이 시간(분) */
  total: number;
  image: string;
  /** 대표 이미지가 없을 때 쓸 작은 아이콘 */
  icon?: string;
}

export interface SteamSummary {
  name: string;
  avatar: string;
  profileUrl: string;
  level: number | null;
  /** 0 오프라인, 1 온라인, 2 다른 용무, 3 자리 비움 ... */
  state: number;
  playing: string | null;
  gameCount: number | null;
  recentMinutes: number;
  games: SteamGame[];
  /** 프로필·게임 정보가 비공개라 기록을 못 읽은 경우 */
  privateGames: boolean;
  updatedAt: string;
}

/** 프로필 주소, 사용자 지정 주소, 숫자 ID 아무거나 → 17자리 SteamID */
const resolveId = cached("steam-id-v1", 60 * 60 * 24 * 30, async (input: string) => {
  const s = input.trim().replace(/\/+$/, "");
  const num = s.match(/(\d{17})$/)?.[1];
  if (num) return num;
  const vanity = s.match(/\/id\/([^/]+)$/)?.[1] ?? s;
  const j = await st<{ response: { success: number; steamid?: string } }>("ISteamUser/ResolveVanityURL/v1/", { vanityurl: vanity });
  if (j.response.success !== 1 || !j.response.steamid) throw new Error(`steam: '${vanity}' 프로필을 찾지 못했어요`);
  return j.response.steamid;
});

// 새로 나온 게임은 예전 주소(cdn.../steam/apps)에 이미지가 없어서 새 주소를 씀
const header = (appid: number) => `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`;
const iconUrl = (appid: number, hash?: string) =>
  hash ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appid}/${hash}.jpg` : undefined;

async function load(input: string): Promise<SteamSummary> {
  const steamid = await resolveId(input);
  const opt = <T>(p: Promise<T>) => p.catch(() => null);

  const [players, recent, owned, level] = await Promise.all([
    st<{ response: { players: { personaname: string; avatarfull: string; profileurl: string; personastate: number; gameextrainfo?: string }[] } }>(
      "ISteamUser/GetPlayerSummaries/v2/",
      { steamids: steamid },
    ),
    opt(st<{ response: { total_count?: number; games?: { appid: number; name: string; playtime_2weeks: number; playtime_forever: number; img_icon_url?: string }[] } }>(
      "IPlayerService/GetRecentlyPlayedGames/v1/",
      { steamid, count: "10" },
    )),
    opt(st<{ response: { game_count?: number } }>("IPlayerService/GetOwnedGames/v1/", { steamid, include_played_free_games: "1" })),
    opt(st<{ response: { player_level?: number } }>("IPlayerService/GetSteamLevel/v1/", { steamid })),
  ]);

  const p = players.response.players[0];
  if (!p) throw new Error("steam: 프로필 정보를 받지 못했어요");

  const games = (recent?.response.games ?? [])
    .map((g) => ({ appid: g.appid, name: g.name, recent: g.playtime_2weeks ?? 0, total: g.playtime_forever ?? 0, image: header(g.appid), icon: iconUrl(g.appid, g.img_icon_url) }))
    .sort((a, b) => b.recent - a.recent);

  return {
    name: p.personaname,
    avatar: p.avatarfull,
    profileUrl: p.profileurl,
    level: level?.response.player_level ?? null,
    state: p.personastate,
    playing: p.gameextrainfo ?? null,
    gameCount: owned?.response.game_count ?? null,
    recentMinutes: games.reduce((s, g) => s + g.recent, 0),
    games,
    // 게임 정보가 비공개면 응답이 아예 비어 옴
    privateGames: !recent?.response || (recent.response.total_count === undefined && owned?.response.game_count === undefined),
    updatedAt: new Date().toISOString(),
  };
}

const loadCached = cached("steam-v2", 60 * 15, load);

export function getSteam() {
  const id = process.env.STEAM_ID;
  if (!process.env.STEAM_API_KEY || !id) throw new SteamSetupError("SETUP");
  return loadCached(id);
}
