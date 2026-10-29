import { kstDate } from "./kst";
import type { LeagueId } from "./types";

export interface League {
  id: LeagueId;
  name: string;
  /** 국내/해외 */
  region: "domestic" | "overseas";
  color: string;
  /** API-Football 리그 id */
  apiId: number;
  /** 시즌이 해를 넘기는지 (유럽식 8월~5월) */
  crossYear: boolean;
  /** 축구 탭 리그 버튼에 보일지 (순위표가 없는 컵 대회는 false — 경기 결과에만 나옴) */
  tab?: boolean;
}

/** 화면에 보이는 순서 */
export const LEAGUES: League[] = [
  { id: "K1", name: "K리그1", region: "domestic", color: "#1f5bd8", apiId: 292, crossYear: false },
  { id: "K2", name: "K리그2", region: "domestic", color: "#3a86c8", apiId: 293, crossYear: false },
  { id: "CL", name: "챔피언스리그", region: "overseas", color: "#1b2a6b", apiId: 2, crossYear: true },
  { id: "EL", name: "유로파리그", region: "overseas", color: "#f26a1b", apiId: 3, crossYear: true },
  { id: "PL", name: "프리미어리그", region: "overseas", color: "#4b1d6e", apiId: 39, crossYear: true },
  { id: "EFL", name: "카라바오컵", region: "overseas", color: "#0b8a4a", apiId: 48, crossYear: true, tab: false },
  { id: "PD", name: "라리가", region: "overseas", color: "#d9452b", apiId: 140, crossYear: true },
  { id: "BL1", name: "분데스리가", region: "overseas", color: "#c8102e", apiId: 78, crossYear: true },
  { id: "DFB", name: "DFB 포칼", region: "overseas", color: "#a8862b", apiId: 81, crossYear: true, tab: false },
];

export const LEAGUE_MAP = Object.fromEntries(LEAGUES.map((l) => [l.id, l])) as Record<LeagueId, League>;

export function isLeagueId(v: string | undefined): v is LeagueId {
  return !!v && v in LEAGUE_MAP;
}

/** football-data.org 대회 코드 (예비용) */
export const FOOTBALL_DATA_CODES: LeagueId[] = ["PL", "PD", "BL1", "CL"];

/** API-Football 리그 id → 우리 id */
export const API_FOOTBALL_LEAGUES: Record<number, LeagueId> = Object.fromEntries(
  LEAGUES.map((l) => [l.apiId, l.id]),
) as Record<number, LeagueId>;

/** 지금 진행 중인 시즌 (API-Football 은 시즌 '시작 연도'를 씀) */
export function currentSeason(league: LeagueId, now = new Date()): number {
  const [y, m] = kstDate(now).split("-").map(Number);
  if (!LEAGUE_MAP[league].crossYear) return y;
  return m >= 7 ? y : y - 1;
}

export function seasonLabel(league: LeagueId, season: number): string {
  return LEAGUE_MAP[league].crossYear ? `${season}–${String(season + 1).slice(2)} 시즌` : `${season} 시즌`;
}

/**
 * K리그 팀 → 한글명.
 * 1순위: API-Football 팀 id 로 정확히 매칭 (이름이 바뀌거나 비슷해도 안전)
 * 2순위: 영문 이름 포함 여부 (새 팀 등 id 표에 없을 때)
 */
const K_TEAM_IDS: Record<number, string> = {
  2765: "수원 삼성", // Suwon Bluewings
  2756: "수원FC", // Suwon City FC
  2767: "울산 HD",
  2764: "포항",
  2762: "전북",
  2766: "FC서울",
  2749: "서울 이랜드",
  2746: "강원",
  2768: "김천 상무",
  2761: "제주",
  2750: "대전",
  2759: "광주",
  2747: "대구",
  2748: "안양",
  2763: "인천",
  2752: "부산",
  2745: "부천",
  2760: "전남",
  2757: "성남",
  2758: "안산",
  2753: "충남아산",
  2751: "경남",
  7060: "천안",
  7061: "충북청주",
  7076: "김해",
  7078: "김포",
  7087: "화성",
  7098: "파주",
  9171: "용인",
};

const K_TEAMS: [string, string][] = [
  ["Bluewings", "수원 삼성"],
  ["Suwon Samsung", "수원 삼성"],
  ["Suwon City", "수원FC"],
  ["Suwon FC", "수원FC"],
  ["Ulsan", "울산 HD"],
  ["Pohang", "포항"],
  ["Jeonbuk", "전북"],
  ["FC Seoul", "FC서울"],
  ["Seoul E-Land", "서울 이랜드"],
  ["Gangwon", "강원"],
  ["Gimcheon", "김천 상무"],
  ["Jeju", "제주"],
  ["Daejeon", "대전"],
  ["Gwangju", "광주"],
  ["Daegu", "대구"],
  ["Anyang", "안양"],
  ["Incheon", "인천"],
  ["Busan", "부산"],
  ["Bucheon", "부천"],
  ["Jeonnam", "전남"],
  ["Seongnam", "성남"],
  ["Gimpo", "김포"],
  ["Ansan", "안산"],
  ["Asan", "충남아산"],
  ["Cheonan", "천안"],
  ["Cheongju", "충북청주"],
  ["Gyeongnam", "경남"],
  ["Hwaseong", "화성"],
  ["Paju", "파주"],
  ["Gimhae", "김해"],
  ["Yongin", "용인"],
];

export function koreanTeamName(name: string, id?: number): string {
  if (id !== undefined && K_TEAM_IDS[id]) return K_TEAM_IDS[id];
  const hit = K_TEAMS.find(([en]) => name.toLowerCase().includes(en.toLowerCase()));
  return hit ? hit[1] : name;
}

/** 리그에 맞게 팀 이름 표시 (K리그만 한글) */
export function teamName(league: LeagueId, name: string, id?: number): string {
  return league === "K1" || league === "K2" ? koreanTeamName(name, id) : name;
}
