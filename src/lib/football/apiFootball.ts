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

export async function afGet<T>(path: string, params: Record<string, string | number>): Promise<T[]> {
  const key = process.env.API_FOOTBALL_KEY;
  if (!key) throw new Error("NO_KEY");

  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await mfetch(`${BASE}/${path}?${qs}`, {
    headers: { "x-apisports-key": key },
    cache: "no-store",
  });
  if (!res.ok) throw new ApiFootballError(`api-football ${res.status}`);

  const json = (await res.json()) as { response: T[]; errors?: unknown };
  // 요금제 제한/한도 초과도 200 + errors 로 옴
  const errs = json.errors;
  if (errs && (Array.isArray(errs) ? errs.length > 0 : Object.keys(errs as object).length > 0)) {
    const msg = `api-football ${JSON.stringify(errs)}`;
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
  /** 오늘 경기 목록 (날짜당 1회) → 하루 최대 48회 */
  todayFixtures: 60 * 30,
  /** 어제 경기 목록 */
  pastFixtures: 60 * 60 * 12,
  /** 진행 중 경기 상세 (보고 있을 때만) */
  liveDetail: 60 * 5,
  /** 끝난 경기 상세 (안 바뀜) */
  finishedDetail: 60 * 60 * 24 * 7,
  /** 시작 전 경기 상세 (라인업 발표 확인용) */
  upcomingDetail: 60 * 60,
  /** 결장자 */
  injuries: 60 * 60 * 6,
  /** 순위표 / 득점 순위 (리그를 열어볼 때만) */
  standings: 60 * 60 * 12,
};
