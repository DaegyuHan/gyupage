const DATE_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" });
const TIME_FMT = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

/** 한국 시간 기준 YYYY-MM-DD */
export function kstDate(d: Date | string): string {
  return DATE_FMT.format(typeof d === "string" ? new Date(d) : d);
}

/** 한국 시간 기준 HH:mm */
export function kstTime(d: Date | string): string {
  return TIME_FMT.format(typeof d === "string" ? new Date(d) : d);
}

/** YYYY-MM-DD 에 n일 더하기 (시간대 무관) */
export function addDays(key: string, n: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}
