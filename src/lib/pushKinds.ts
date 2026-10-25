/** 받을 수 있는 푸시 알림 종류 (화면·서버 같이 씀) */
export const PUSH_KINDS = [
  { id: "brief", label: "아침 브리핑", desc: "오전 8시 30분 · 오늘 일정과 할 일" },
  { id: "event", label: "일정 알림", desc: "시간 있는 일정 30분 전" },
  { id: "match", label: "킥오프 알림", desc: "응원 팀 경기 30분 전" },
  { id: "result", label: "경기 결과", desc: "응원 팀 경기가 끝나면" },
  { id: "todo", label: "남은 할 일", desc: "밤 9시 · 아직 못 한 일이 있으면" },
  { id: "cs", label: "오늘의 CS", desc: "평일 아침 새 글이 올라오면" },
] as const;
export type PushKind = (typeof PUSH_KINDS)[number]["id"];
export type PushPrefs = Record<PushKind, boolean>;
export const DEFAULT_PREFS: PushPrefs = { brief: true, event: true, match: true, result: true, todo: true, cs: true };
