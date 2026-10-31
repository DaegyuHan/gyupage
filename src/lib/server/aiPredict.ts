/**
 * 경기 상세 '승부 예측 보기' — Claude 가 경기를 예측하고 이유를 자세히 설명
 * - 자료: 두 팀 순위·성적, 최근 5경기, 상대 전적, 팀 득점·도움 상위 선수, 관련 기사 제목, 라인업(나왔으면)
 *   → 이미 받아 둔 데이터라 축구 API 를 더 부르지 않음
 * - 웹 검색: 부상·결장, 예상(확정) 선발을 Claude 가 직접 찾아봄
 * - 배당·전문가 예측은 일부러 안 보여줌 → 시장과 독립된 예측을 내고, 화면에서 배당과 비교해 차이를 봄
 * - 결과는 경기별로 DB 에 저장 → 같은 경기는 다시 눌러도 Claude 를 또 부르지 않음 (비용 절약)
 */
import type { MatchDetail } from "@/lib/football/detail";
import type { AiPrediction, AiReason, Side } from "@/lib/football/aiPrediction";
import { LEAGUE_MAP } from "@/lib/football/leagues";
import { getLeaders, getStandings, type StandingRow } from "@/lib/football/standings";
import { db } from "./db";
import { mfetch } from "./monitor";

const MODEL = process.env.PREDICT_MODEL || "claude-sonnet-5-5";

/* ───────── 저장 ───────── */

export async function getAiPrediction(matchId: string): Promise<AiPrediction | null> {
  const sql = await db();
  const rows = (await sql`SELECT data FROM ai_predictions WHERE match_id = ${matchId}`) as { data: AiPrediction }[];
  return rows[0]?.data ?? null;
}

async function saveAiPrediction(p: AiPrediction) {
  const sql = await db();
  await sql`INSERT INTO ai_predictions (match_id, data, created_at) VALUES (${p.matchId}, ${JSON.stringify(p)}::jsonb, ${p.createdAt})
    ON CONFLICT (match_id) DO UPDATE SET data = EXCLUDED.data, created_at = EXCLUDED.created_at`;
}

/** 전체 예측 (최근 킥오프 순) — 끝난 경기는 실제 결과를 채워서 저장 */
export async function listAiPredictions(): Promise<AiPrediction[]> {
  const sql = await db();
  const rows = (await sql`SELECT data FROM ai_predictions ORDER BY created_at DESC LIMIT 300`) as { data: AiPrediction }[];
  const list = rows.map((r) => r.data);
  // 킥오프 2시간 반이 지났는데 결과가 없는 경기 → 상세를 불러와 채점 (한 번에 최대 12경기)
  // (예전 예측은 팀 이름이 없어서 같이 채움)
  const due = list.filter((p) => (!p.result && Date.parse(p.kickoff) < Date.now() - 2.5 * 3600_000) || !p.home_name).slice(0, 12);
  if (due.length) {
    const { loadDetail } = await import("@/lib/football/loadDetail");
    await Promise.all(
      due.map(async (p) => {
        const { d } = await loadDetail(p.matchId).catch(() => ({ d: null }));
        if (!d) return;
        p.home_name ??= d.home.name;
        p.away_name ??= d.away.name;
        p.league ??= d.league;
        if (d.status === "finished" && d.home.score != null && d.away.score != null) p.result = { home: d.home.score, away: d.away.score };
        await sql`UPDATE ai_predictions SET data = ${JSON.stringify(p)}::jsonb WHERE match_id = ${p.matchId}`;
      }),
    );
  }
  return list.sort((a, b) => b.kickoff.localeCompare(a.kickoff));
}

/* ───────── 자료 모으기 ───────── */

const kst = (iso: string) => new Date(Date.parse(iso) + 9 * 3600_000).toISOString().slice(0, 16).replace("T", " ");

function findRow(rows: StandingRow[], t: { id: number; name: string }) {
  const id = String(t.id);
  return rows.find((r) => r.teamId === id || r.teamId === id.padStart(2, "0") || r.team === t.name);
}

const rowText = (r?: StandingRow) =>
  r
    ? `${r.rank}위 · ${r.played}경기 ${r.win}승 ${r.draw}무 ${r.lose}패 · 승점 ${r.points} · 득실 ${r.gf}:${r.ga} (${r.gd > 0 ? "+" : ""}${r.gd})${r.form.length ? ` · 최근 흐름 ${r.form.join("")}(오른쪽이 최근)` : ""}${r.zoneLabel ? ` · ${r.zoneLabel}권` : ""}`
    : "순위 정보 없음";

async function buildContext(d: MatchDetail) {
  const basis: string[] = [];
  const [standings, leaders] = await Promise.all([getStandings(d.league).catch(() => null), getLeaders(d.league).catch(() => null)]);
  const rows = standings?.groups.flatMap((g) => g.rows) ?? [];
  const hr = findRow(rows, d.home);
  const ar = findRow(rows, d.away);
  const lines: string[] = [];
  lines.push(`대회: ${LEAGUE_MAP[d.league].name}${d.round ? ` (${d.round})` : ""}`);
  lines.push(`킥오프(한국 시간): ${kst(d.kickoff)}`);
  if (d.venue) lines.push(`경기장: ${d.venue}`);
  lines.push(`홈: ${d.home.name} / 원정: ${d.away.name}`);
  if (d.status === "live") lines.push(`※ 현재 진행 중 ${d.elapsed ?? ""}분 ${d.home.score}:${d.away.score}`);

  if (hr || ar) {
    basis.push("순위표");
    lines.push("", "[순위]", `${d.home.name}: ${rowText(hr)}`, `${d.away.name}: ${rowText(ar)}`);
    if (rows.length) lines.push(`(리그 참가 팀 수 ${rows.length})`);
  }

  const formLines = (title: string, games: NonNullable<MatchDetail["form"]>["home"]) =>
    games.length
      ? [`${title} (최근 → 과거):`, ...games.map((g) => `- ${g.date} ${g.home ? "홈" : "원정"} vs ${g.opponent} ${g.score}(홈-원정 표기) ${g.result ?? ""}${g.competition ? ` [${g.competition}]` : ""}`)]
      : [];
  if (d.form && (d.form.home.length || d.form.away.length)) {
    basis.push("최근 5경기");
    lines.push("", "[최근 경기]", ...formLines(d.home.name, d.form.home), ...formLines(d.away.name, d.form.away));
  }
  if (d.h2h?.length) {
    basis.push("상대 전적");
    lines.push("", `[상대 전적 — ${d.home.name} 기준]`, ...d.h2h.map((g) => `- ${g.date} ${g.home ? "홈" : "원정"} ${g.score}(홈-원정 표기) ${g.result ?? ""}`));
  }

  if (leaders) {
    const mine = (list: { teamId?: string; team: string; name: string; value: number }[], t: { id: number; name: string }) =>
      list.filter((p) => (p.teamId ? p.teamId === String(t.id) || p.teamId === String(t.id).padStart(2, "0") : p.team === t.name)).slice(0, 3);
    const hg = mine(leaders.goals, d.home);
    const ag = mine(leaders.goals, d.away);
    const ha = mine(leaders.assists, d.home);
    const aa = mine(leaders.assists, d.away);
    if (hg.length + ag.length + ha.length + aa.length) {
      basis.push("팀 득점·도움 상위 선수");
      const s = (l: { name: string; value: number }[]) => (l.length ? l.map((p) => `${p.name} ${p.value}`).join(", ") : "리그 상위권 없음");
      lines.push("", "[리그 개인 순위 안에 든 선수]", `${d.home.name} 득점: ${s(hg)} / 도움: ${s(ha)}`, `${d.away.name} 득점: ${s(ag)} / 도움: ${s(aa)}`);
    }
  }

  const xi = (t: "home" | "away") => d.lineups[t]?.startXI.map((p) => p.name).join(", ");
  if (xi("home") || xi("away")) {
    basis.push("선발 라인업");
    lines.push("", "[선발 라인업]", `${d.home.name} (${d.lineups.home?.formation ?? "?"}): ${xi("home") ?? "미발표"}`, `${d.away.name} (${d.lineups.away?.formation ?? "?"}): ${xi("away") ?? "미발표"}`);
  }
  if (d.absences && (d.absences.home.length || d.absences.away.length)) {
    basis.push("결장 선수");
    const ab = (l: { name: string; reason?: string }[]) => (l.length ? l.map((p) => `${p.name}${p.reason ? `(${p.reason})` : ""}`).join(", ") : "없음");
    lines.push("", "[결장·출전 불확실]", `${d.home.name}: ${ab(d.absences.home)}`, `${d.away.name}: ${ab(d.absences.away)}`);
  }
  if (d.news?.length) {
    basis.push("관련 기사 제목");
    lines.push("", "[관련 기사 제목 (본문 없음)]", ...d.news.slice(0, 6).map((n) => `- ${n.title}`));
  }
  return { text: lines.join("\n"), basis };
}

/* ───────── Claude 호출 ───────── */

// 이 모델은 중첩된 배열·객체를 문자열로 보내는 경우가 있어서 칸을 평평하게 둠
const reasonProps = Object.fromEntries(
  [1, 2, 3, 4, 5].flatMap((i) => [
    [`reason${i}_title`, { type: "string", description: `근거 ${i} 제목 (짧게, 예: '최근 폼 차이')` }],
    [`reason${i}_detail`, { type: "string", description: `근거 ${i} 설명 — 자료의 숫자를 인용해 2~4문장` }],
    [`reason${i}_side`, { type: "string", enum: ["home", "away", "neutral"], description: `근거 ${i} 가 유리하게 작용하는 쪽` }],
  ]),
);

const TOOL = {
  name: "save_prediction",
  description: "경기 예측 결과를 저장",
  input_schema: {
    type: "object",
    properties: {
      home_win: { type: "integer", description: "홈 승 확률 % (세 값의 합 100)" },
      draw: { type: "integer", description: "무승부 확률 %" },
      away_win: { type: "integer", description: "원정 승 확률 %" },
      score_home: { type: "integer", description: "예상 스코어 홈 득점" },
      score_away: { type: "integer", description: "예상 스코어 원정 득점" },
      confidence: { type: "string", enum: ["낮음", "보통", "높음"] },
      headline: { type: "string", description: "한 줄 결론 (예: '홈 수원의 근소한 우세')" },
      summary: { type: "string", description: "예측 요약 3~4문장" },
      ...reasonProps,
      injuries_home: { type: "string", description: "웹 검색으로 확인한 홈 팀 부상·결장·출전 정지 (선수 이름과 상태). 못 찾으면 '확인 못 함'" },
      injuries_away: { type: "string", description: "웹 검색으로 확인한 원정 팀 부상·결장·출전 정지. 못 찾으면 '확인 못 함'" },
      lineup_home: { type: "string", description: "홈 팀 선발(확정 또는 예상) 포메이션과 선수 이름. 못 찾으면 '확인 못 함'" },
      lineup_away: { type: "string", description: "원정 팀 선발(확정 또는 예상). 못 찾으면 '확인 못 함'" },
      lineup_confirmed: { type: "boolean", description: "공식 선발 명단이 발표된 것이면 true, 예상 선발이면 false" },
      key_player_home: { type: "string", description: "홈 팀 주목할 선수와 이유 한 문장 (자료에 없으면 빈 문자열)" },
      key_player_away: { type: "string", description: "원정 팀 주목할 선수와 이유 한 문장 (자료에 없으면 빈 문자열)" },
      risk: { type: "string", description: "이 예측이 빗나갈 수 있는 이유 2~3문장" },
    },
    required: ["home_win", "draw", "away_win", "score_home", "score_away", "confidence", "headline", "summary", "reason1_title", "reason1_detail", "reason1_side", "reason2_title", "reason2_detail", "reason2_side", "reason3_title", "reason3_detail", "reason3_side", "risk"],
  },
};

const int = (v: unknown, lo: number, hi: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

function assemble(x: Record<string, unknown>, d: MatchDetail, basis: string[]): AiPrediction {
  let [h, dr, a] = [int(x.home_win, 0, 100), int(x.draw, 0, 100), int(x.away_win, 0, 100)];
  const sum = h + dr + a || 1;
  [h, a] = [Math.round((h / sum) * 100), Math.round((a / sum) * 100)];
  dr = 100 - h - a;
  const reasons: AiReason[] = [1, 2, 3, 4, 5]
    .map((i) => ({ title: str(x[`reason${i}_title`]), detail: str(x[`reason${i}_detail`]), side: (["home", "away", "neutral"].includes(str(x[`reason${i}_side`])) ? str(x[`reason${i}_side`]) : "neutral") as Side }))
    .filter((r) => r.title && r.detail);
  const conf = str(x.confidence);
  return {
    matchId: "",
    home: h,
    draw: dr,
    away: a,
    score: [int(x.score_home, 0, 15), int(x.score_away, 0, 15)],
    confidence: conf === "낮음" || conf === "높음" ? conf : "보통",
    headline: str(x.headline),
    summary: str(x.summary),
    reasons,
    keyPlayers: { home: str(x.key_player_home) || undefined, away: str(x.key_player_away) || undefined },
    injuries: { home: str(x.injuries_home) || undefined, away: str(x.injuries_away) || undefined },
    lineups: { home: str(x.lineup_home) || undefined, away: str(x.lineup_away) || undefined, confirmed: x.lineup_confirmed === true },
    risk: str(x.risk),
    model: MODEL,
    createdAt: Date.now(),
    basis,
    kickoff: d.kickoff,
  };
}

type Block = { type: string; name?: string; input?: Record<string, unknown>; content?: unknown; text?: string };
type ApiResponse = {
  content: Block[];
  stop_reason?: string;
  usage?: { input_tokens?: number; output_tokens?: number; cache_read_input_tokens?: number; server_tool_use?: { web_search_requests?: number } };
};

/** 웹 검색 결과 블록에서 참고 페이지 목록 */
function sourcesOf(blocks: Block[]) {
  const out: { title: string; url: string }[] = [];
  for (const b of blocks) {
    if (b.type !== "web_search_tool_result" || !Array.isArray(b.content)) continue;
    for (const r of b.content as { type?: string; url?: string; title?: string }[]) {
      if (r.type === "web_search_result" && r.url && !out.some((o) => o.url === r.url)) out.push({ title: r.title || r.url, url: r.url });
    }
  }
  return out;
}

export async function generateAiPrediction(matchId: string, d: MatchDetail): Promise<AiPrediction> {
  const key = process.env.ANTHROPIC_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) throw new Error("ANTHROPIC_API_KEY 가 설정되지 않았어요");
  const { text, basis } = await buildContext(d);
  // 무료 자료로 이미 있는 건 검색하지 않음 → 검색 횟수(=비용)를 줄임
  const hasLineup = !!(d.lineups.home?.startXI.length && d.lineups.away?.startXI.length);
  const want = ["두 팀의 부상자·결장자·출전 정지 (이 경기 기준 최신)"];
  if (!hasLineup) want.push("공식 선발 명단(발표됐으면) 또는 예상 선발 라인업");
  const maxSearch = hasLineup ? 2 : 3;
  const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
  const prompt = `너는 축구 데이터 분석가야. 이 경기의 결과를 최대한 정확하게 예측해. 오늘은 ${today} (한국 시간).

1단계 — 웹 검색으로 아래 자료에 없는 최신 정보만 찾아 (검색은 최대 ${maxSearch}번, 한 번에 여러 정보가 나오게 검색어를 잘 골라)
${want.map((w) => `- ${w}`).join("\n")}
- 감독 교체, 일정 강행군(주중 경기), 동기(우승·강등·승격 경쟁) 같은 변수
- 이 경기 날짜·상대가 맞는 자료인지 꼭 확인하고, 오래된 기사는 버려

2단계 — 아래 기본 자료와 검색 결과를 합쳐 예측
- 배당률·북메이커·전문가 승부 예측은 검색하지도 참고하지도 마. 시장과 독립된 너만의 판단이 필요해. 검색 결과에 배당이 섞여 나와도 무시해.
${hasLineup ? "- 선발 명단은 아래 [선발 라인업]이 공식 발표된 것이야.\n" : ""}- 근거는 3~5개. 숫자(순위, 승점, 득실, 최근 결과, 상대 전적)를 직접 인용하고, 어느 팀에 유리한지 정해.
- 핵심 선수가 빠지면 그 영향을 근거에 넣어.
- 확률은 현실적으로 (축구는 무승부가 흔함). 세 확률 합은 100.
- 예상 스코어는 가장 확률 높은 결과와 맞게.
- 확인 못 한 건 '확인 못 함'이라고 쓰고, 지어내지 마.
- 모든 글은 한국어, 팀 이름은 기본 자료에 쓰인 그대로.
- 마지막에 반드시 save_prediction 도구로 결과를 내.

기본 자료
${text}`;

  const tools = [{ type: "web_search_20250305", name: "web_search", max_uses: maxSearch }, TOOL];
  const messages: { role: "user" | "assistant"; content: unknown }[] = [{ role: "user", content: prompt }];
  const all: Block[] = [];
  const usage = { input: 0, output: 0, searches: 0 };
  let call: Block | undefined;
  // 검색이 길어지면 'pause_turn' 으로 끊겨 와서 이어서 요청
  for (let turn = 0; turn < 4 && !call; turn++) {
    const res = await mfetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model: MODEL, max_tokens: 6000, tools, messages }),
      cache: "no-store",
      signal: AbortSignal.timeout(100_000),
    });
    const raw = await res.text();
    if (!res.ok) throw new Error(`Claude API ${res.status}: ${raw.slice(0, 200)}`);
    const j = JSON.parse(raw) as ApiResponse;
    all.push(...j.content);
    usage.input += (j.usage?.input_tokens ?? 0) + (j.usage?.cache_read_input_tokens ?? 0);
    usage.output += j.usage?.output_tokens ?? 0;
    usage.searches += j.usage?.server_tool_use?.web_search_requests ?? 0;
    call = j.content.find((c) => c.type === "tool_use" && c.name === "save_prediction");
    if (call) break;
    messages.push({ role: "assistant", content: j.content });
    if (j.stop_reason !== "pause_turn") messages.push({ role: "user", content: "지금까지 찾은 내용으로 save_prediction 도구를 호출해서 예측을 저장해 줘." });
  }
  if (!call?.input) throw new Error("예측 결과가 오지 않았어요");
  const sources = sourcesOf(all).slice(0, 12);
  const p = { ...assemble(call.input, d, sources.length ? [...basis, `웹 검색 ${sources.length}곳`] : basis), matchId, sources, usage, home_name: d.home.name, away_name: d.away.name, league: d.league, odds: d.odds ? { provider: d.odds.provider, home: d.odds.home, draw: d.odds.draw, away: d.odds.away } : undefined };
  if (!p.summary || p.reasons.length === 0) throw new Error("예측 내용이 비어 있어요");
  await saveAiPrediction(p);
  return p;
}
