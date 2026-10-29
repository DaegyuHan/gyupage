/** 아이폰 건강 앱에서 보내 주는 하루 기록 (화면·서버 같이 씀) */
export interface HealthDay {
  /** YYYY-MM-DD (KST) */
  day: string;
  steps: number | null;
  /** 잔 시간(분) — 그날 아침까지의 밤잠 */
  sleepMin: number | null;
  activeKcal: number | null;
  exerciseMin: number | null;
  distanceKm: number | null;
}

/** 하루 걸음 목표 */
export const STEP_GOAL = 8000;
