/**
 * 출퇴근 위젯 데이터
 * - 버스: 경기도 버스도착정보 v2 (공공데이터포털 GG_BUS_KEY, 개발계정 하루 1,000회)
 * - 지하철: 서울 실시간 지하철 도착 (SEOUL_SUBWAY_KEY, http 만 지원해서 서버에서 호출)
 * 같은 정류장·역은 20초 동안 캐시 → 여러 기기에서 봐도 호출 수가 늘지 않음
 */
import { cached } from "@/lib/football/apiFootball";
import { COMMUTE, type CommuteBus, type CommuteData, type CommuteKey, type CommuteStop, type CommuteStops, type CommuteTrain } from "@/lib/commute";
import { db, hasDb } from "./db";
import { mfetch } from "./monitor";

const key = (name: string) => process.env[name]?.trim().replace(/^["']|["']$/g, "") ?? "";
const list = <T>(x: T | T[] | undefined | null): T[] => (x == null ? [] : Array.isArray(x) ? x : [x]);
const numOr = (v: unknown) => (v === "" || v == null || !Number.isFinite(Number(v)) ? null : Number(v));

interface RawBus {
  routeName: string | number;
  routeTypeCd: number;
  flag: string;
  predictTime1: string | number;
  predictTime2: string | number;
  predictTimeSec1?: string | number;
  predictTimeSec2?: string | number;
  locationNo1: string | number;
  locationNo2: string | number;
  remainSeatCnt1: string | number;
  remainSeatCnt2: string | number;
}

export const busArrivals = cached("commute-bus-v1", 20, async (stationId: string): Promise<CommuteBus[]> => {
  const k = key("GG_BUS_KEY");
  if (!k) throw new Error("GG_BUS_KEY 가 없어요");
  const res = await mfetch(
    `https://apis.data.go.kr/6410000/busarrivalservice/v2/getBusArrivalListv2?serviceKey=${encodeURIComponent(k)}&stationId=${encodeURIComponent(stationId)}&format=json`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`버스 API ${res.status}`);
  const j = (await res.json()) as { response?: { msgHeader?: { resultCode?: number; resultMessage?: string }; msgBody?: { busArrivalList?: RawBus | RawBus[] } } };
  const code = j.response?.msgHeader?.resultCode;
  // 4 = 결과 없음 (운행 끝난 시간 등)
  if (code !== 0 && code !== 4) throw new Error(j.response?.msgHeader?.resultMessage ?? "버스 API 오류");
  return list(j.response?.msgBody?.busArrivalList).map((b) => {
    // 일반버스(13 등)는 빈자리 정보가 없어서 0/-1 로 옴
    const seatInfo = [11, 12, 14].includes(Number(b.routeTypeCd));
    const one = (sec: unknown, min: unknown, stops: unknown, seats: unknown) => {
      const s = numOr(sec) ?? (numOr(min) != null ? numOr(min)! * 60 : null);
      if (s == null) return null;
      const st = numOr(seats);
      return { sec: s, stops: numOr(stops), seats: seatInfo && st != null && st >= 0 ? st : null };
    };
    return {
      route: String(b.routeName),
      type: Number(b.routeTypeCd),
      status: b.flag,
      next: [one(b.predictTimeSec1, b.predictTime1, b.locationNo1, b.remainSeatCnt1), one(b.predictTimeSec2, b.predictTime2, b.locationNo2, b.remainSeatCnt2)].filter(
        (x): x is NonNullable<typeof x> => !!x,
      ),
    };
  });
});

interface RawTrain {
  subwayId: string;
  updnLine: string;
  bstatnNm: string;
  barvlDt: string;
  arvlMsg2: string;
  arvlMsg3: string;
  arvlCd: string;
  lstcarAt?: string;
  ordkey?: string;
}

/** 남은 초가 0으로 오는 경우가 많아서 안내 문구로 대략 계산 */
function trainSec(t: RawTrain, station: string): number | null {
  const s = Number(t.barvlDt);
  if (s > 0) return s;
  const m = t.arvlMsg2.match(/(\d+)\s*분\s*(\d+)?\s*초?\s*후/);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  // arvlCd: 0 진입 1 도착 2 출발 3 전역출발 4 전역진입 5 전역도착 99 운행중
  const cd = Number(t.arvlCd);
  if (cd === 0 || cd === 1) return 0;
  if (cd === 3) return 120;
  if (cd === 4 || cd === 5) return 90;
  const k = t.arvlMsg2.match(/\[(\d+)\]번째 전역/);
  if (k) return Number(k[1]) * 120;
  if (t.arvlMsg3 === station && cd === 2) return null; // 이미 출발
  return null;
}

const SBD = "1077";
const subwayArrivals = cached("commute-subway-v1", 20, async (station: string, dir: string): Promise<CommuteTrain[]> => {
  const k = key("SEOUL_SUBWAY_KEY");
  if (!k) throw new Error("SEOUL_SUBWAY_KEY 가 없어요");
  const res = await mfetch(`http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(k)}/json/realtimeStationArrival/0/30/${encodeURIComponent(station)}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`지하철 API ${res.status}`);
  const j = (await res.json()) as { realtimeArrivalList?: RawTrain[]; errorMessage?: { code?: string; message?: string }; code?: string; message?: string };
  if (!j.realtimeArrivalList && j.code && j.code !== "INFO-200") throw new Error(j.message ?? "지하철 API 오류");
  return list(j.realtimeArrivalList)
    .filter((t) => t.subwayId === SBD && t.updnLine === dir)
    .map((t) => ({ to: t.bstatnNm, sec: trainSec(t, station), msg: t.arvlMsg2, where: t.arvlMsg3, last: t.lstcarAt === "1" }))
    .filter((t) => !(t.sec == null && /출발/.test(t.msg) && t.where === station))
    .sort((a, b) => (a.sec ?? 1e9) - (b.sec ?? 1e9));
});

/** 설정에서 고른 정류장 (없으면 기본값) */
export async function getCommuteStops(): Promise<CommuteStops> {
  const def: CommuteStops = { am: { ...COMMUTE.am.stop, routes: [...COMMUTE.am.stop.routes] }, pm: { ...COMMUTE.pm.stop, routes: [...COMMUTE.pm.stop.routes] } };
  if (!hasDb()) return def;
  try {
    const sql = await db();
    const rows = (await sql`SELECT value FROM prefs WHERE key = 'commute'`) as { value: Partial<CommuteStops> | null }[];
    const v = rows[0]?.value;
    const ok = (s?: CommuteStop) => !!s?.stationId && Array.isArray(s.routes);
    return { am: ok(v?.am) ? v!.am! : def.am, pm: ok(v?.pm) ? v!.pm! : def.pm };
  } catch {
    return def;
  }
}

/** 정류장 이름·번호로 찾기 */
export async function searchStations(q: string) {
  const k = key("GG_BUS_KEY");
  if (!k) throw new Error("GG_BUS_KEY 가 없어요");
  const res = await mfetch(
    `https://apis.data.go.kr/6410000/busstationservice/v2/getBusStationListv2?serviceKey=${encodeURIComponent(k)}&keyword=${encodeURIComponent(q)}&format=json`,
    { cache: "no-store", signal: AbortSignal.timeout(8000) },
  );
  if (!res.ok) throw new Error(`정류소 API ${res.status}`);
  const j = (await res.json()) as { response?: { msgBody?: { busStationList?: unknown } } };
  return list(j.response?.msgBody?.busStationList as Record<string, unknown>[] | undefined).map((s) => ({
    stationId: String(s.stationId),
    name: String(s.stationName),
    number: String(s.mobileNo ?? "").trim(),
    region: String(s.regionName ?? ""),
  }));
}

/* ───────── 신분당선 열차 위치로 다음·다다음 열차 계산 ─────────
 * 도착정보 API 는 방향별로 1~2대만 줘서, 노선 전체 열차 위치(realtimePosition)를 받아
 * 역 사이 걸리는 시간으로 우리 역까지 남은 시간을 대략 계산함
 */
const SBD_STATIONS = ["신사", "논현", "신논현", "강남", "양재", "양재시민의숲", "청계산입구", "판교", "정자", "미금", "동천", "수지구청", "성복", "상현", "광교중앙", "광교"];
/** i 번째 역 → i+1 번째 역 (분, 정차 포함) */
const SBD_GAP = [2, 1.5, 2, 2.5, 2, 3, 6.5, 3, 2.5, 2.5, 2, 2, 2, 2.5, 2];
/** 종점에서 돌아 나가는 데 걸리는 시간(초) */
const TURN = 300;

interface RawPos {
  statnNm: string;
  updnLine: string; // 0 상행(신사 방면) 1 하행(광교 방면)
  trainSttus: string; // 0 진입 1 도착 2 출발 3 전역출발
  statnTnm: string;
  trainNo: string;
}

const sbdPositions = cached("commute-sbd-pos-v1", 20, async (): Promise<RawPos[]> => {
  const k = key("SEOUL_SUBWAY_KEY");
  if (!k) throw new Error("SEOUL_SUBWAY_KEY 가 없어요");
  const res = await mfetch(`http://swopenapi.seoul.go.kr/api/subway/${encodeURIComponent(k)}/json/realtimePosition/0/100/${encodeURIComponent("신분당선")}`, {
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`지하철 위치 API ${res.status}`);
  const j = (await res.json()) as { realtimePositionList?: RawPos[] };
  return list(j.realtimePositionList);
});

/** a 역에서 b 역까지 걸리는 초 */
function travel(a: number, b: number) {
  const [lo, hi] = a < b ? [a, b] : [b, a];
  return SBD_GAP.slice(lo, hi).reduce((s, m) => s + m, 0) * 60;
}
/** 열차 상태 보정 (진입 중이면 그 역 전, 출발했으면 조금 지나감) */
const statusAdj = (st: string) => (st === "0" ? 30 : st === "1" ? 20 : st === "2" ? -20 : 0);
const STATUS_WORD: Record<string, string> = { "0": "진입", "1": "도착", "2": "출발", "3": "전역 출발" };

function trainsFromPositions(pos: RawPos[], station: string, dir: "상행" | "하행"): CommuteTrain[] {
  const target = SBD_STATIONS.indexOf(station);
  if (target < 0) return [];
  const last = SBD_STATIONS.length - 1;
  // 우리 방향 종점 반대편 끝 (하행이면 신사에서 돌아오고, 상행이면 광교에서 돌아옴)
  const turnAt = dir === "하행" ? 0 : last;
  const out: CommuteTrain[] = [];
  for (const t of pos) {
    const at = SBD_STATIONS.indexOf(t.statnNm);
    if (at < 0) continue;
    const down = t.updnLine === "1";
    const sameDir = (dir === "하행") === down;
    let sec: number | null = null;
    let turned = false;
    if (sameDir) {
      // 우리 역으로 오는 중 (하행은 신사 쪽, 상행은 광교 쪽에 있어야 함)
      const coming = dir === "하행" ? at <= target : at >= target;
      if (!coming || (at === target && t.trainSttus === "2")) continue;
      sec = travel(at, target) + (at === target ? 0 : statusAdj(t.trainSttus));
      // 광교에서 출발하는 상행: 광교에 서 있으면 곧 출발
      if (at === target && target === last) sec = 60;
    } else if (t.statnTnm === SBD_STATIONS[turnAt]) {
      // 반대 방향 열차가 끝까지 갔다가 돌아오는 경우
      sec = travel(at, turnAt) + statusAdj(t.trainSttus) + TURN + travel(turnAt, target);
      turned = true;
    }
    if (sec == null) continue;
    out.push({
      to: turned ? (dir === "하행" ? "광교" : "신사") : t.statnTnm,
      sec: Math.max(0, Math.round(sec)),
      msg: `지금 ${t.statnNm} ${STATUS_WORD[t.trainSttus] ?? ""}`.trim(),
      where: t.statnNm,
      last: false,
    });
  }
  out.sort((a, b) => (a.sec ?? 0) - (b.sec ?? 0));
  // 회차 열차는 실제 간격보다 몰려 보일 수 있어서 최소 3분 간격
  for (let i = 1; i < out.length; i++) out[i].sec = Math.max(out[i].sec!, out[i - 1].sec! + 180);
  return out.slice(0, 4);
}

export async function getCommute(k: CommuteKey): Promise<CommuteData> {
  const c = { ...COMMUTE[k], stop: (await getCommuteStops())[k] };
  const [bus, subway] = await Promise.all([
    busArrivals(c.stop.stationId)
      .then((all) => ({
        buses: all.filter((b) => c.stop.routes.includes(b.route)),
        others: all.filter((b) => !c.stop.routes.includes(b.route) && b.next.length).sort((a, b) => a.next[0].sec - b.next[0].sec),
      }))
      .catch((e) => ({ buses: [] as CommuteBus[], others: [] as CommuteBus[], error: String((e as Error).message ?? e) })),
    // 열차 위치로 다음·다다음 열차까지 계산, 안 되면 도착정보 API
    sbdPositions()
      .then((pos) => trainsFromPositions(pos, c.subway.station, c.subway.dir))
      .then((t) => (t.length ? t : Promise.reject(new Error("위치 정보 없음"))))
      .catch(() => subwayArrivals(c.subway.station, c.subway.dir))
      .then((trains) => ({ trains }))
      .catch((e) => ({ trains: [] as CommuteTrain[], error: String((e as Error).message ?? e) })),
  ]);
  // 등록한 노선은 정보가 없어도 줄은 보이게
  for (const r of c.stop.routes) if (!bus.buses.some((b) => b.route === r)) bus.buses.push({ route: r, type: 11, status: "NONE", next: [] });
  bus.buses.sort((a, b) => (a.next[0]?.sec ?? 1e9) - (b.next[0]?.sec ?? 1e9));
  return { key: k, fetchedAt: Date.now(), stop: c.stop, bus, subway };
}
