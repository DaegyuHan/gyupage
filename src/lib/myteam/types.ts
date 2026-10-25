/** My Team 카드: 응원하는 팀의 다음 경기·최근 흐름 */
export type Form = "W" | "D" | "L";

export interface MtTeamRef {
  name: string;
  logo?: string;
}

export interface MtMatch {
  kickoff: string; // ISO
  competition: string;
  opponent: MtTeamRef;
  home: boolean;
  /** pre 경기 전 · live 진행 중 · done 끝 · off 연기/취소 */
  state: "pre" | "live" | "done" | "off";
  /** 우리 팀 기준 득점·실점 (경기 전이면 null) */
  goalsFor: number | null;
  goalsAgainst: number | null;
}

export interface MyTeam {
  id: string;
  name: string;
  logo?: string;
  /** 팀 색 (카드 띠·강조) */
  color: string;
  league: string;
  rank?: number;
  points?: number;
  next?: MtMatch;
  last?: MtMatch;
  /** 최근 5경기 (왼쪽이 오래된 경기) */
  form: Form[];
  /** 이번 주(어제~8일 뒤) 경기 — 홈 일정표에 표시 */
  week: MtMatch[];
}
