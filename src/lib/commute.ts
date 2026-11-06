/** 출퇴근 위젯 설정 + 응답 모양 (화면·서버 같이 씀) */
export type CommuteKey = "am" | "pm";

export const COMMUTE = {
  /** 이 시각(시) 전 = 출근, 이후 = 퇴근 */
  switchHour: 14,
  am: {
    title: "출근",
    stop: { name: "아주대학교입구", number: "04238", stationId: "203000067", routes: ["3007예약"] },
    subway: { station: "광교", label: "광교역", dir: "상행" as const, toward: "신사 방면" },
  },
  pm: {
    title: "퇴근",
    stop: { name: "강남역홍우빌딩앞", number: "22997", stationId: "121000921", routes: ["3007", "3002"] },
    subway: { station: "강남", label: "강남역", dir: "하행" as const, toward: "광교 방면" },
  },
  /** 홈 맨 위에 올리는 시간대 (KST "HH:MM") — 그 밖엔 맨 아래 */
  topWindows: [
    ["07:00", "08:30"],
    ["18:00", "19:00"],
  ] as [string, string][],
};

/** 설정에서 고른 정류장 (prefs 'commute') */
export interface CommuteStop {
  name: string;
  number: string;
  stationId: string;
  routes: string[];
}
export type CommuteStops = Record<CommuteKey, CommuteStop>;

export interface CommuteBus {
  route: string;
  /** 경기도 노선 유형 (11 직행좌석 · 13 일반 · 14 광역급행 …) */
  type: number;
  status: string;
  next: { sec: number; stops: number | null; seats: number | null }[];
}

export interface CommuteTrain {
  to: string;
  /** 도착까지 남은 초 (모르면 null) */
  sec: number | null;
  /** "전역 출발", "광교 도착" 같은 상태 */
  msg: string;
  where: string;
  last: boolean;
}

export interface CommuteData {
  key: CommuteKey;
  fetchedAt: number;
  stop: CommuteStop;
  /** buses = 등록한 노선, others = 같은 정류장의 다른 노선 (곧 오는 순) */
  bus: { buses: CommuteBus[]; others: CommuteBus[]; error?: string };
  subway: { trains: CommuteTrain[]; error?: string };
}

export const kstHM = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(11, 16);
export const autoKey = (t = Date.now()): CommuteKey => (Number(kstHM(t).slice(0, 2)) < COMMUTE.switchHour ? "am" : "pm");
export const isTopTime = (t = Date.now()) => {
  const hm = kstHM(t);
  return COMMUTE.topWindows.some(([a, b]) => hm >= a && hm < b);
};
