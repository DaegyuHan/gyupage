/**
 * AI(Claude) 사용 비용 계산 — 원화 추정
 * 단가는 Anthropic 공개 가격 기준 (100만 토큰당 달러). 모델 단가가 바뀌면 여기만 고치면 돼요.
 * 환율은 AI_USD_KRW 환경 변수로 바꿀 수 있어요 (기본 1,400원).
 */
export interface Price {
  input: number;
  output: number;
}

const PRICES: [RegExp, Price][] = [
  [/opus/i, { input: 15, output: 75 }],
  [/haiku/i, { input: 1, output: 5 }],
  [/sonnet/i, { input: 3, output: 15 }],
];
/** 웹 검색 1회 (1,000회당 10달러) */
export const SEARCH_USD = 0.01;

export const usdKrw = () => Number(process.env.AI_USD_KRW) || 1400;

export function priceOf(model: string): Price {
  return PRICES.find(([re]) => re.test(model))?.[1] ?? { input: 3, output: 15 };
}

export function costUsd(model: string, u: { input: number; output: number; searches?: number }) {
  const p = priceOf(model);
  return (u.input / 1e6) * p.input + (u.output / 1e6) * p.output + (u.searches ?? 0) * SEARCH_USD;
}
