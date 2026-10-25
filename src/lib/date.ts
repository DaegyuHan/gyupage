/** 로컬 시간 기준 YYYY-MM-DD */
export function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function fromKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(): string {
  return toKey(new Date());
}

/** 일요일 시작, 6주(42칸) 달력 그리드 */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

/** key 가 [start, end] 범위 안인지 (문자열 비교로 충분) */
export function inRange(key: string, start: string, end: string): boolean {
  return key >= start && key <= end;
}

export const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

export function formatKorean(key: string): string {
  const d = fromKey(key);
  return `${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAYS[d.getDay()]})`;
}
