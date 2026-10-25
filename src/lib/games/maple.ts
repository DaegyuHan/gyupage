/**
 * 메이플스토리 — 넥슨 Open API (https://openapi.nexon.com)
 * .env.local 에 NEXON_API_KEY, MAPLE_CHARACTER(캐릭터 이름) 를 넣으면 동작.
 * 현재 정보는 1시간, 지난 날짜(경험치 기록)는 하루 동안 캐시.
 */
import { cached } from "../football/apiFootball";

const BASE = "https://open.api.nexon.com/maplestory/v1";

export class MapleSetupError extends Error {}

/** 개발용(test_) 키는 초당 5회 제한이라 요청 사이를 띄움 */
let queue: Promise<unknown> = Promise.resolve();
const GAP_MS = 230;
function throttle() {
  const turn = queue.then(() => new Promise((r) => setTimeout(r, GAP_MS)));
  queue = turn;
  return turn;
}

async function nx<T>(path: string, params: Record<string, string>): Promise<T> {
  const key = process.env.NEXON_API_KEY;
  if (!key) throw new MapleSetupError("NO_KEY");
  await throttle();
  const qs = new URLSearchParams(params);
  const res = await fetch(`${BASE}/${path}?${qs}`, { headers: { "x-nxopen-api-key": key }, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`nexon ${path} ${res.status} ${body.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

interface Basic {
  date: string | null;
  character_name: string;
  world_name: string;
  character_gender: string;
  character_class: string;
  character_class_level: string;
  character_level: number;
  character_exp: number;
  character_exp_rate: string; // "12.345"
  character_guild_name: string | null;
  character_image: string;
  character_date_create?: string;
}

export interface MapleDay {
  date: string; // YYYY-MM-DD
  level: number;
  rate: number; // 경험치 %
  /** 전날보다 오른 경험치 (레벨 % 단위, 레벨업 포함) */
  gain: number | null;
}

export interface MapleSummary {
  name: string;
  world: string;
  job: string;
  jobLevel: string;
  level: number;
  expRate: number;
  guild: string | null;
  image: string;
  combatPower: number | null;
  unionLevel: number | null;
  unionGrade: string | null;
  popularity: number | null;
  dojang: number | null;
  /** 최근 7일 (오래된 날 → 오늘) */
  history: MapleDay[];
  updatedAt: string;
}

const ocidCached = cached("maple-ocid-v1", 60 * 60 * 24 * 7, async (name: string) => {
  const j = await nx<{ ocid: string }>("id", { character_name: name });
  return j.ocid;
});

/** 지난 날짜 기록은 바뀌지 않아서 하루 캐시 */
const basicOnDay = cached("maple-basic-day-v2", 60 * 60 * 24, async (ocid: string, date: string) => {
  try {
    const b = await nx<Basic>("character/basic", { ocid, date });
    return { level: b.character_level, rate: Number(b.character_exp_rate) || 0 };
  } catch (e) {
    // 요청 한도 초과는 저장하지 않고 다시 시도하게 던짐, 그 밖(캐릭터 생성 전 날짜 등)은 빈 값
    if (String(e).includes(" 429 ")) throw e;
    return null;
  }
});

const kstDay = (offset: number) => new Date(Date.now() + 9 * 3600_000 + offset * 86400_000).toISOString().slice(0, 10);

async function load(name: string): Promise<MapleSummary> {
  const ocid = await ocidCached(name);
  const opt = <T>(p: Promise<T>) => p.catch(() => null);

  const [basic, stat, union, pop, dojang, ...past] = await Promise.all([
    nx<Basic>("character/basic", { ocid }),
    opt(nx<{ final_stat: { stat_name: string; stat_value: string }[] }>("character/stat", { ocid })),
    opt(nx<{ union_level: number; union_grade: string }>("user/union", { ocid })),
    opt(nx<{ popularity: number }>("character/popularity", { ocid })),
    opt(nx<{ dojang_best_floor: number }>("character/dojang", { ocid })),
    // 6일 전 ~ 어제 (오늘은 위 basic 으로)
    ...[-7, -6, -5, -4, -3, -2, -1].map((o) => basicOnDay(ocid, kstDay(o)).catch(() => null)),
  ]);

  const points = [
    ...past.map((p, i) => (p ? { date: kstDay(i - 7), ...p } : null)),
    { date: kstDay(0), level: basic.character_level, rate: Number(basic.character_exp_rate) || 0 },
  ];
  // 레벨 + 경험치% 를 하나의 수로 보고 하루 차이를 구함
  const history: MapleDay[] = points.slice(1).map((p, i) => {
    const prev = points[i];
    if (!p) return null;
    const gain = prev ? Math.max(0, (p.level - prev.level) * 100 + (p.rate - prev.rate)) : null;
    return { ...p, gain: gain == null ? null : Math.round(gain * 100) / 100 };
  }).filter((d): d is MapleDay => !!d);

  const cp = stat?.final_stat.find((s) => s.stat_name === "전투력")?.stat_value;

  return {
    name: basic.character_name,
    world: basic.world_name,
    job: basic.character_class,
    jobLevel: basic.character_class_level,
    level: basic.character_level,
    expRate: Number(basic.character_exp_rate) || 0,
    guild: basic.character_guild_name,
    image: basic.character_image,
    combatPower: cp ? Number(cp) : null,
    unionLevel: union?.union_level ?? null,
    unionGrade: union?.union_grade ?? null,
    popularity: pop?.popularity ?? null,
    dojang: dojang?.dojang_best_floor ?? null,
    history,
    updatedAt: new Date().toISOString(),
  };
}

const loadCached = cached("maple-v2", 60 * 60, load);

export function getMaple() {
  const name = process.env.MAPLE_CHARACTER;
  if (!process.env.NEXON_API_KEY || !name) throw new MapleSetupError("SETUP");
  return loadCached(name);
}
