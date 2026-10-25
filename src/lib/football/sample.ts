import type { LeagueId, Match, MatchStatus } from "./types";

/**
 * API 키가 없을 때 보여줄 예시 경기.
 * 날짜는 항상 '어제 / 오늘'(KST)에 맞춰 만들어짐.
 */
function at(day: string, hhmm: string) {
  // KST → UTC ISO
  return new Date(`${day}T${hhmm}:00+09:00`).toISOString();
}

type Row = [LeagueId, string, string, string, number | null, number | null, MatchStatus, number?];

const YESTERDAY: Row[] = [
  ["K1", "14:00", "울산 HD", "포항", 2, 1, "finished"],
  ["K1", "16:30", "FC서울", "전북", 1, 1, "finished"],
  ["K2", "19:00", "수원 삼성", "부산", 3, 0, "finished"],
  ["CL", "04:00", "Arsenal", "Atleti", 2, 0, "finished"],
  ["CL", "04:00", "Bayern", "PSG", 1, 2, "finished"],
  ["PD", "04:00", "Real Betis", "Girona", 0, 0, "finished"],
];

const TODAY: Row[] = [
  ["K1", "14:00", "강원", "대전", 1, 0, "live", 67],
  ["K1", "16:30", "김천 상무", "광주", null, null, "scheduled"],
  ["K2", "13:30", "인천", "서울 이랜드", 0, 2, "finished"],
  ["K2", "16:30", "전남", "성남", null, null, "scheduled"],
  ["PL", "20:30", "Liverpool", "Brentford", null, null, "scheduled"],
  ["PL", "23:00", "Tottenham", "Man City", null, null, "scheduled"],
  ["PL", "23:00", "Chelsea", "Newcastle", null, null, "scheduled"],
  ["PD", "21:00", "Barça", "Sevilla FC", null, null, "scheduled"],
  ["PD", "23:15", "Real Madrid", "Villarreal", null, null, "scheduled"],
  ["BL1", "22:30", "Dortmund", "Leverkusen", null, null, "scheduled"],
];

function build(day: string, rows: Row[], prefix: string): Match[] {
  return rows.map(([league, time, home, away, hs, as, status, minute], i) => ({
    id: `${prefix}-${i}`,
    league,
    // 새벽 경기(00~06시)는 그날 새벽으로 취급
    kickoff: at(day, time),
    status,
    minute,
    home: { name: home, score: hs },
    away: { name: away, score: as },
  }));
}

export function sampleMatches(yesterday: string, today: string): Match[] {
  return [...build(yesterday, YESTERDAY, "sy"), ...build(today, TODAY, "st")];
}
