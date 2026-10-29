/** EL 유로파리그 · EFL 잉글랜드 리그컵(카라바오컵) · DFB 독일 DFB 포칼 */
export type LeagueId = "PL" | "PD" | "BL1" | "CL" | "EL" | "EFL" | "DFB" | "K1" | "K2";

export type MatchStatus = "scheduled" | "live" | "finished" | "postponed";

export interface TeamSide {
  name: string;
  crest?: string;
  score: number | null;
}

export interface Match {
  id: string;
  league: LeagueId;
  /** ISO 시각 (UTC) */
  kickoff: string;
  status: MatchStatus;
  /** 진행 중이면 경과 분 */
  minute?: number;
  home: TeamSide;
  away: TeamSide;
}

export type SourceState = "live" | "sample" | "error";

export interface FootballResponse {
  /** KST 기준 YYYY-MM-DD */
  dates: { yesterday: string; today: string };
  days: { yesterday: Match[]; today: Match[] };
  sources: { overseas: SourceState; domestic: SourceState };
  generatedAt: string;
  /** 실패 원인 (상태 코드 정도만, 키는 포함 안 됨) */
  errors?: { overseas?: string; domestic?: string };
}
