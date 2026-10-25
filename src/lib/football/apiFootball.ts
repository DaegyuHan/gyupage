import { unstable_cache } from "next/cache";
import { mfetch, reportApiError } from "@/lib/server/monitor";

/**
 * API-Football 공통 호출부.
 *
 * 무료 플랜은 하루 100회라서 아끼는 게 핵심이에요.
 * - 원본 응답(전 세계 경기라 수 MB 가 될 수 있음)을 그대로 캐시하지 않고,
 *   필요한 부분만 가공한 '작은 결과'를 unstable_cache 로 저장해요.
 * - 실패(한도 초과 등)는 캐시되지 않아서 다음 요청 때 다시 시도해요.
 */
const BASE = "https://v3.football.api-sports.io";

export class ApiFootballError extends Error {}

/**
 * 한도 보호 (서버 인스턴스 메모리)
 * - 오늘 한도를 다 썼으면 초기화(한국 시간 오전 9시 = UTC 0시)까지 아예 부르지 않음
 * - 그 밖의 실패는 2분 동안 다시 안 부름 (실패는 캐시가 안 돼서 새로고침마다 재시도하는 걸 막음)
 * - 남은 횟수가 적으면 결장자처럼 '있으면 좋은' 호출은 건너뜀
 */
let blockedUntil = 0;

/**
 * 절약 모드 스위치 — 비교 측정용
 * AF_SAVER=off 로 두면 예전(as-is) 방식 그대로: 30분 캐시 · 어제 경기 다시 받기 · 무료 점수 덮어쓰기/한도 보호 없음
 * 비워 두거나 on 이면 지금(to-be) 방식
 */
export const AF_SAVER = (process.env.AF_SAVER ?? "on").trim().toLowerCase() !== "off";
let remaining: number | null = null;
const nextReset = () => {
  const d = new Date();
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + 1);
};
/** 남은 횟수가 이만큼 이하면 덜 중요한 호출은 안 함 */
const RESERVE = 15;

export async function afGet<T>(path: string, params: Record<string, string | number>, opts: { optional?: boolean } = {}): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("NO_KEY");
  if (AF_SAVER && Date.now() < blockedUntil) throw new ApiFootballError("api-football 잠시 쉬는 중 (한도 보호)");
  if (AF_SAVER && opts.optional && remaining !== null && remaining <= RESERVE) throw new ApiFootballError(`api-football 남은 ${remaining}회라 건너뜀`);

  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await mfetch(`${BASE}/${path}?${qs}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  const left = Number(res.headers.get("x-ratelimit-requests-remaining"));
  if (res.headers.has("x-ratelimit-requests-remaining") && Number.isFinite(left)) remaining = left;
  if (!res.ok) {
    blockedUntil = res.status === 429 ? nextReset() : Date.now() + 120_000;
    throw new ApiFootballError(`api-football ${res.status}`);
  }

  const json = (await res.json()) as { response: T[]; errors?: unknown };
  // 요금제 제한/한도 초과도 200 + errors 로 옴
  const errs = json.errors;
  if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs as object).length > 0)) {
    const msg = `api-football ${JSON.stringify(errs)}`;
    // 하루 한도 초과면 초기화 때까지, 나머지는 2분
    blockedUntil = /request|limit/i.test(msg) ? nextReset() : Date.now() + 120_000;
    reportApiError("api-football", msg);
    throw new ApiFootballError(msg);
  }
  return json.response;
}

/** 결과를 ttl 초 동안 저장해 두는 래퍼 */
export function cached<A extends (string | number)[], R>(
  name: string,
  ttl: number,
  fn: (...args: A) => Promise<R>,
): (...args: A) => Promise<R> {
  return (...args: A) => unstable_cache(() => fn(...args), ["af", name, ...args.map(String)], { revalidate: ttl })();
}

/** 캐시 시간(초) 모음 — 하루 100회 안에서 쓰도록 맞춘 값 */
export const TTL = {
  /** 오늘 경기 목록 → 하루 최대 8회 (진행 중 점수는 네이버·ESPN 으로 덮어써서 자주 안 받아도 됨) */
  todayFixtures: AF_SAVER ? 60 * 60 * 3 : 60 * 30,
  /** 어제 경기 목록 */
  pastFixtures: 60 * 60 * 12,
  /** 진행 중 경기 상세 (보고 있을 때만) */
  liveDetail: AF_SAVER ? 60 * 8 : 60 * 5,
  /** 끝난 경기 상세 (안 바뀜) */
  finishedDetail: 60 * 60 * 24 * 7,
  /** 시작 전 경기 상세 (라인업 발표 확인용) */
  upcomingDetail: 60 * 60,
  /** 결장자 */
  injuries: 60 * 60 * 6,
  /** 순위표 / 득점 순위 (리그를 열어볼 때만) */
  standings: 60 * 60 * 12,
};
