/**
 * 한국 공휴일 — 인터넷 없이 바로 계산 (관공서의 공휴일에 관한 규정 기준)
 *
 * - 양력 공휴일 + 음력 공휴일(설·부처님오신날·추석, 2025~2030 표)
 * - 대체공휴일 규칙
 *   · 설·추석: 연휴가 일요일이나 다른 공휴일과 겹치면 연휴 다음 첫 평일
 *   · 삼일절·어린이날·부처님오신날·제헌절·광복절·개천절·한글날·성탄절·노동절: 토·일이나 다른 공휴일과 겹치면 다음 첫 평일
 *   · 신정·현충일: 대체공휴일 없음
 * - 선거일·임시공휴일은 EXTRA 에 직접 (공공데이터 키가 있으면 /api/holidays 가 자동으로 더 채워 줌)
 */
export interface Holiday {
  date: string;
  name: string;
  /** 대체공휴일 여부 */
  substitute?: boolean;
}

/** 음력 공휴일 (양력으로 바꾼 날짜) — 설날·추석은 당일 */
const LUNAR: Record<number, { seollal: string; buddha: string; chuseok: string }> = {
  2025: { seollal: "01-29", buddha: "05-05", chuseok: "10-06" },
  2026: { seollal: "02-17", buddha: "05-24", chuseok: "09-25" },
  2027: { seollal: "02-07", buddha: "05-13", chuseok: "09-15" },
  2028: { seollal: "01-27", buddha: "05-02", chuseok: "10-03" },
  2029: { seollal: "02-13", buddha: "05-20", chuseok: "09-22" },
  2030: { seollal: "02-03", buddha: "05-09", chuseok: "09-12" },
};

/** 선거일·임시공휴일 */
const EXTRA: Holiday[] = [
  { date: "2025-01-27", name: "임시공휴일" },
  { date: "2025-06-03", name: "대통령 선거일" },
  { date: "2026-06-03", name: "지방선거일" },
  { date: "2028-04-12", name: "국회의원 선거일" },
];

const pad = (n: number) => String(n).padStart(2, "0");
const keyOf = (d: Date) => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
const dateOf = (k: string) => new Date(`${k}T00:00:00Z`);
const shift = (k: string, n: number) => {
  const d = dateOf(k);
  d.setUTCDate(d.getUTCDate() + n);
  return keyOf(d);
};
const dow = (k: string) => dateOf(k).getUTCDay();

const cache = new Map<number, Holiday[]>();

export function holidaysOf(year: number): Holiday[] {
  const hit = cache.get(year);
  if (hit) return hit;

  const y = (md: string) => `${year}-${md}`;
  const base: Holiday[] = [];
  /** 대체공휴일 대상 (토·일 포함) */
  const subAny: Holiday[] = [];
  const add = (date: string, name: string, sub: "none" | "weekend") => {
    const h = { date, name };
    base.push(h);
    if (sub === "weekend") subAny.push(h);
  };

  add(y("01-01"), "신정", "none");
  add(y("03-01"), "삼일절", "weekend");
  if (year >= 2026) add(y("05-01"), "노동절", "weekend");
  add(y("05-05"), "어린이날", "weekend");
  add(y("06-06"), "현충일", "none");
  if (year >= 2026) add(y("07-17"), "제헌절", "weekend");
  add(y("08-15"), "광복절", "weekend");
  add(y("10-03"), "개천절", "weekend");
  add(y("10-09"), "한글날", "weekend");
  add(y("12-25"), "성탄절", "weekend");

  const lunar = LUNAR[year];
  const blocks: string[][] = [];
  if (lunar) {
    add(y(lunar.buddha), "부처님오신날", "weekend");
    for (const [day, name] of [
      [y(lunar.seollal), "설날"],
      [y(lunar.chuseok), "추석"],
    ] as const) {
      const days = [shift(day, -1), day, shift(day, 1)];
      days.forEach((d, i) => base.push({ date: d, name: i === 1 ? name : `${name} 연휴` }));
      blocks.push(days);
    }
  }
  for (const e of EXTRA) if (e.date.startsWith(`${year}-`)) base.push(e);

  // 날짜별로 몇 개의 공휴일이 겹치는지
  const count = new Map<string, number>();
  for (const h of base) count.set(h.date, (count.get(h.date) ?? 0) + 1);
  const taken = new Set(base.map((h) => h.date));
  const subs: Holiday[] = [];
  const nextFree = (from: string) => {
    let d = shift(from, 1);
    while (dow(d) === 0 || dow(d) === 6 || taken.has(d)) d = shift(d, 1);
    taken.add(d);
    return d;
  };

  // 설·추석: 일요일이거나 다른 공휴일과 겹치는 날 수만큼
  for (const days of blocks) {
    const name = base.find((h) => h.date === days[1])!.name.replace(" 연휴", "");
    const hits = days.filter((d) => dow(d) === 0 || (count.get(d) ?? 0) > 1).length;
    let last = days[2];
    for (let i = 0; i < hits; i++) {
      last = nextFree(last);
      subs.push({ date: last, name: `대체공휴일(${name})`, substitute: true });
    }
  }
  // 나머지: 토·일이거나 다른 공휴일과 겹치면 (같은 날 두 개가 겹쳐도 대체는 하루, 설·추석과 겹친 건 위에서 처리)
  const inBlock = new Set(blocks.flat());
  const seen = new Set<string>();
  for (const h of subAny.sort((a, b) => a.date.localeCompare(b.date))) {
    if (seen.has(h.date) || inBlock.has(h.date)) continue;
    seen.add(h.date);
    const d = dow(h.date);
    if (d === 0 || d === 6 || (count.get(h.date) ?? 0) > 1) {
      subs.push({ date: nextFree(h.date), name: `대체공휴일(${h.name})`, substitute: true });
    }
  }

  const all = [...base, ...subs].sort((a, b) => a.date.localeCompare(b.date));
  cache.set(year, all);
  return all;
}

/** 날짜 → 공휴일 이름 (같은 날 두 개면 "어린이날·부처님오신날") */
export function holidayMap(years: number[], extra: Holiday[] = []): Map<string, string> {
  const m = new Map<string, string>();
  for (const h of [...years.flatMap(holidaysOf), ...extra]) {
    const prev = m.get(h.date);
    if (!prev) m.set(h.date, h.name);
    else if (!prev.split("·").includes(h.name)) m.set(h.date, `${prev}·${h.name}`);
  }
  return m;
}

export function holidayName(key: string): string | undefined {
  return holidayMap([Number(key.slice(0, 4))]).get(key);
}
