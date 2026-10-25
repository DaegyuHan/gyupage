import { addDays, kstDate } from "./kst";

const TIME = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

export function kickoffTime(iso: string) {
  return TIME.format(new Date(iso));
}

/** "오늘 23:00", "내일 04:00", "10월 26일 (일) 20:30" */
export function kickoffLabel(iso: string, now = new Date()) {
  const day = kstDate(iso);
  const today = kstDate(now);
  const t = kickoffTime(iso);
  if (day === today) return `오늘 ${t}`;
  if (day === addDays(today, 1)) return `내일 ${t}`;
  if (day === addDays(today, -1)) return `어제 ${t}`;
  const [, m, d] = day.split("-").map(Number);
  const dow = WEEK[new Date(`${day}T12:00:00+09:00`).getUTCDay()];
  return `${m}월 ${d}일 (${dow}) ${t}`;
}

/** 경기 상태 → 한글 */
export function statusLabel(short: string, elapsed?: number) {
  switch (short) {
    case "1H":
      return `전반 ${elapsed ?? ""}'`;
    case "HT":
      return "하프타임";
    case "2H":
      return `후반 ${elapsed ?? ""}'`;
    case "ET":
      return `연장 ${elapsed ?? ""}'`;
    case "BT":
      return "연장 휴식";
    case "P":
      return "승부차기";
    case "LIVE":
    case "INT":
      return "진행 중";
    case "FT":
      return "경기 종료";
    case "AET":
      return "연장 종료";
    case "PEN":
      return "승부차기 종료";
    case "PST":
      return "연기";
    case "CANC":
      return "취소";
    case "ABD":
      return "중단";
    case "SUSP":
      return "일시 중단";
    case "AWD":
    case "WO":
      return "몰수";
    default:
      return "경기 전";
  }
}

/** "Regular Season - 9" → "9라운드" */
export function roundLabel(round?: string) {
  if (!round) return undefined;
  const n = round.match(/(\d+)\s*$/)?.[1];
  if (/regular season/i.test(round) && n) return `${n}라운드`;
  if (/league stage|league phase/i.test(round) && n) return `리그 페이즈 ${n}차전`;
  if (/round of 16/i.test(round)) return "16강";
  if (/quarter/i.test(round)) return "8강";
  if (/semi/i.test(round)) return "4강";
  if (/^final$/i.test(round.trim())) return "결승";
  if (/play-?off/i.test(round)) return "플레이오프";
  if (/relegation round/i.test(round) && n) return `파이널B ${n}라운드`;
  if (/championship round|final round/i.test(round) && n) return `파이널A ${n}라운드`;
  return round;
}

/** 킥오프까지 남은 시간 */
export function untilKickoff(iso: string, now = Date.now()) {
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return undefined;
  const min = Math.round(ms / 60000);
  const d = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  if (d > 0) return `${d}일 ${h}시간 뒤`;
  if (h > 0) return `${h}시간 ${m}분 뒤`;
  return `${m}분 뒤`;
}

export function minuteText(minute: number, extra?: number) {
  return extra ? `${minute}+${extra}'` : `${minute}'`;
}
