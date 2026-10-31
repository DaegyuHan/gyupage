/** AI 승부 예측 결과 모양 (서버·화면 같이 씀) */
export type Side = "home" | "away" | "neutral";

export interface AiReason {
  title: string;
  detail: string;
  /** 이 근거가 어느 쪽에 유리한지 */
  side: Side;
}

export interface AiPrediction {
  matchId: string;
  /** 0~100 (%) — 합 100 */
  home: number;
  draw: number;
  away: number;
  score: [number, number];
  confidence: "낮음" | "보통" | "높음";
  headline: string;
  summary: string;
  reasons: AiReason[];
  keyPlayers: { home?: string; away?: string };
  /** 웹 검색으로 찾은 부상·결장 */
  injuries?: { home?: string; away?: string };
  /** 웹 검색으로 찾은 (예상) 선발 */
  lineups?: { home?: string; away?: string; confirmed?: boolean };
  /** 배당·전문가 예측 등 시장 정보 요약 (예전 예측에만 있음) */
  market?: string;
  /** 예측 당시 배당 — AI 에게는 안 보여주고 비교용으로만 저장 */
  odds?: { provider: string; home: number; draw: number; away: number };
  /** 실제 사용량 (비용 확인용) */
  usage?: { input: number; output: number; searches: number };
  /** 참고한 웹 페이지 */
  sources?: { title: string; url: string }[];
  /** 이 예측이 틀릴 수 있는 이유 */
  risk: string;
  model: string;
  createdAt: number;
  /** 예측할 때 쓴 자료 */
  basis: string[];
  /** 예측 당시 킥오프 (경기 전 예측인지 표시용) */
  kickoff: string;
  /** 경기 이름·리그 (성적 목록용) */
  home_name?: string;
  away_name?: string;
  league?: string;
  /** 경기가 끝나면 채워지는 실제 결과 */
  result?: { home: number; away: number };
}

/* ───────── 성적 계산 (서버·화면 같이 씀) ───────── */

export type Outcome = "home" | "draw" | "away";
export const outcomeOf = (h: number, a: number): Outcome => (h > a ? "home" : h < a ? "away" : "draw");
const IDX: Record<Outcome, number> = { home: 0, draw: 1, away: 2 };

/** AI 의 픽 = 가장 확률 높은 결과 */
export function aiPick(p: Pick<AiPrediction, "home" | "draw" | "away">): Outcome {
  return p.home >= p.draw && p.home >= p.away ? "home" : p.away >= p.draw ? "away" : "draw";
}

/** 배당 → 마진 뺀 확률 (0~1) */
export function marketProbs(o: NonNullable<AiPrediction["odds"]>) {
  const inv = [o.home, o.draw, o.away].map((x) => 1 / x);
  const s = inv.reduce((a, b) => a + b, 0);
  return inv.map((x) => x / s);
}

/** 브라이어 점수 (0 이 완벽, 낮을수록 좋음) */
export function brier(probs: number[], o: Outcome) {
  return probs.reduce((s, p, i) => s + (p - (i === IDX[o] ? 1 : 0)) ** 2, 0);
}

export interface RecordStats {
  total: number;
  settled: number;
  /** 승부(픽) 적중 */
  pickHits: number;
  /** 예상 스코어 정확히 적중 */
  scoreHits: number;
  /** 배당이 있던 경기 */
  withOdds: number;
  /** 배당 쪽 픽(가장 낮은 배당) 적중 — 시장 기준선 */
  marketPickHits: number;
  brierAi?: number;
  brierMarket?: number;
  /** AI 픽에 매번 1만 원 */
  betAll: { bets: number; profit: number };
  /** AI 가 배당보다 5%p 이상 높게 본 결과에만 1만 원 */
  betValue: { bets: number; profit: number };
}

export function recordStats(list: AiPrediction[]): RecordStats {
  const done = list.filter((p) => p.result);
  const st: RecordStats = { total: list.length, settled: done.length, pickHits: 0, scoreHits: 0, withOdds: 0, marketPickHits: 0, betAll: { bets: 0, profit: 0 }, betValue: { bets: 0, profit: 0 } };
  let bAi = 0;
  let bMk = 0;
  for (const p of done) {
    const real = outcomeOf(p.result!.home, p.result!.away);
    if (aiPick(p) === real) st.pickHits++;
    if (p.score[0] === p.result!.home && p.score[1] === p.result!.away) st.scoreHits++;
    if (!p.odds) continue;
    st.withOdds++;
    const mk = marketProbs(p.odds);
    const ai = [p.home, p.draw, p.away].map((x) => x / 100);
    bAi += brier(ai, real);
    bMk += brier(mk, real);
    const dec = [p.odds.home, p.odds.draw, p.odds.away];
    const mkPick = mk.indexOf(Math.max(...mk));
    if (mkPick === IDX[real]) st.marketPickHits++;
    const pick = IDX[aiPick(p)];
    st.betAll.bets++;
    st.betAll.profit += pick === IDX[real] ? Math.round(10000 * dec[pick] - 10000) : -10000;
    for (let i = 0; i < 3; i++) {
      if (ai[i] - mk[i] < 0.05) continue;
      st.betValue.bets++;
      st.betValue.profit += i === IDX[real] ? Math.round(10000 * dec[i] - 10000) : -10000;
    }
  }
  if (st.withOdds) {
    st.brierAi = bAi / st.withOdds;
    st.brierMarket = bMk / st.withOdds;
  }
  return st;
}
