/**
 * 홈 주간 일정표에 띄울 응원 팀 축구 경기 (수원 삼성·바이에른·맨유)
 * 캘린더에는 넣지 않고 홈에서만 보여줌.
 */
import { getMyTeams } from "../myteam";

export interface HomeMatch {
  id: string;
  kind: "football";
  /** KST 날짜 YYYY-MM-DD */
  date: string;
  /** KST HH:MM */
  time: string;
  team: string;
  color: string;
  opponent: string;
  home?: boolean;
  competition: string;
  state: "pre" | "live" | "done";
  /** 끝난 경기: 우리 팀 기준 "2:1" */
  score?: string;
  result?: "W" | "D" | "L";
}

const kst = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString();

export async function getHomeMatches(): Promise<HomeMatch[]> {
  const teams = await getMyTeams().catch(() => []);

  const football: HomeMatch[] = teams.flatMap((t) =>
    (t.week ?? []).map((m) => {
      const k = kst(m.kickoff);
      const hasScore = m.goalsFor != null && m.goalsAgainst != null;
      const done = m.state === "done" && hasScore;
      return {
        id: `${t.id}-${m.kickoff}`,
        kind: "football" as const,
        date: k.slice(0, 10),
        time: k.slice(11, 16),
        team: t.name,
        color: t.color,
        opponent: m.opponent.name,
        home: m.home,
        competition: m.competition,
        state: m.state === "off" ? "pre" : m.state,
        score: (done || m.state === "live") && hasScore ? `${m.goalsFor}:${m.goalsAgainst}` : undefined,
        result: done ? (m.goalsFor! > m.goalsAgainst! ? "W" : m.goalsFor! < m.goalsAgainst! ? "L" : "D") : undefined,
      };
    }),
  );

  return football.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
}
