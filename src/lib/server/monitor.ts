import { after } from "next/server";
import { COLOR, hasDiscord, once, sendDiscord } from "./discord";
import { db, hasDb } from "./db";

/**
 * 외부 API 호출 기록 + 문제 생기면 디스코드로 바로 알림
 *
 * fetch 대신 mfetch 를 쓰면 주소를 보고 어떤 API 인지 알아서 나눠요.
 * - 하루·API 별 호출 수 / 에러 수 / 마지막 에러 / 남은 한도(API-Football) 를 api_usage 에 쌓음
 * - 401·403·429·5xx·네트워크 오류는 디스코드로 즉시 (같은 API 는 1시간에 한 번)
 * - 기록은 응답을 다 보낸 뒤(after)에 써서 화면 속도에 영향 없음
 */
export const SOURCES: Record<string, { label: string; hint?: string }> = {
  "api-football": { label: "API-Football", hint: "무료 하루 100회 · 한국 시간 오전 9시에 초기화" },
  "football-data": { label: "football-data.org", hint: "무료 분당 10회" },
  espn: { label: "ESPN" },
  naver: { label: "네이버 스포츠" },
  kleague: { label: "K리그 공식" },
  "open-meteo": { label: "Open-Meteo 날씨" },
  "google-news": { label: "Google 뉴스" },
  f1: { label: "F1 (Jolpica)" },
  github: { label: "GitHub" },
  nexon: { label: "넥슨 메이플", hint: "테스트 키는 하루 1,000회" },
  riot: { label: "Riot (LoL)", hint: "개발용 키는 24시간마다 만료" },
  steam: { label: "Steam", hint: "하루 100,000회" },
  lolesports: { label: "LoL e스포츠" },
  "data-go-kr": { label: "공공데이터 (공휴일)" },
  claude: { label: "Claude API" },
  push: { label: "웹 푸시" },
};

const HOSTS: [RegExp, string][] = [
  [/api-sports\.io$/, "api-football"],
  [/football-data\.org$/, "football-data"],
  [/espn\.com$/, "espn"],
  [/naver\.com$/, "naver"],
  [/open-meteo\.com$/, "open-meteo"],
  [/news\.google\.com$/, "google-news"],
  [/(jolpi\.ca|ergast\.com)$/, "f1"],
  [/(github\.com|jogruber\.de)$/, "github"],
  [/kleague\.com$/, "kleague"],
  [/nexon\.com$/, "nexon"],
  [/(riotgames\.com|leagueoflegends\.com)$/, "riot"],
  [/steampowered\.com$/, "steam"],
  [/lolesports\.com$/, "lolesports"],
  [/data\.go\.kr$/, "data-go-kr"],
  [/anthropic\.com$/, "claude"],
];

export function sourceOf(url: string) {
  try {
    const host = new URL(url).hostname;
    return HOSTS.find(([re]) => re.test(host))?.[1] ?? host;
  } catch {
    return "unknown";
  }
}

export const labelOf = (s: string) => SOURCES[s]?.label ?? s;

interface Stat {
  calls: number;
  errors: number;
  status?: number;
  error?: string;
  errorAt?: number;
  okAt?: number;
  remaining?: number;
  quota?: number;
  /** 디스코드로 알릴 에러 */
  alert?: { status: number; message: string };
}

const pending = new Map<string, Stat>();
let scheduled = false;

export const kstDay = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
/** KST "YYYY-MM-DD HH" */
export const kstHour = (t = Date.now()) => new Date(t + 9 * 3600_000).toISOString().slice(0, 13).replace("T", " ");

function record(source: string, patch: Partial<Stat> & { ok: boolean }) {
  const s = pending.get(source) ?? { calls: 0, errors: 0 };
  s.calls += patch.ok ? 1 : patch.status === undefined ? 0 : 1;
  if (!patch.ok) {
    s.errors++;
    s.error = patch.error;
    s.errorAt = Date.now();
  } else s.okAt = Date.now();
  if (patch.status !== undefined) s.status = patch.status;
  if (patch.remaining !== undefined) s.remaining = patch.remaining;
  if (patch.quota !== undefined) s.quota = patch.quota;
  if (patch.alert) s.alert = patch.alert;
  pending.set(source, s);
  schedule();
}

function schedule() {
  if (scheduled || !hasDb()) return;
  scheduled = true;
  const run = () =>
    flush()
      .catch((e) => console.error("[monitor]", e))
      .finally(() => {
        scheduled = false;
        if (pending.size) setTimeout(schedule, 0);
      });
  try {
    after(run);
  } catch {
    // 요청 밖(스크립트 등)이면 그냥 바로
    void run();
  }
}

async function flush() {
  if (!pending.size) return;
  const items = [...pending.entries()];
  pending.clear();
  const sql = await db();
  const day = kstDay();
  const now = Date.now();
  const alerts: [string, Stat, number][] = [];

  for (const [source, s] of items) {
    const rows = (await sql`INSERT INTO api_usage (day, source, calls, errors, last_status, last_error, last_error_at, last_ok_at, remaining, quota, updated_at)
      VALUES (${day}, ${source}, ${s.calls}, ${s.errors}, ${s.status ?? null}, ${s.error ?? null}, ${s.errorAt ?? null}, ${s.okAt ?? null}, ${s.remaining ?? null}, ${s.quota ?? null}, ${now})
      ON CONFLICT (day, source) DO UPDATE SET
        calls = api_usage.calls + EXCLUDED.calls,
        errors = api_usage.errors + EXCLUDED.errors,
        last_status = COALESCE(EXCLUDED.last_status, api_usage.last_status),
        last_error = COALESCE(EXCLUDED.last_error, api_usage.last_error),
        last_error_at = COALESCE(EXCLUDED.last_error_at, api_usage.last_error_at),
        last_ok_at = COALESCE(EXCLUDED.last_ok_at, api_usage.last_ok_at),
        remaining = COALESCE(EXCLUDED.remaining, api_usage.remaining),
        quota = COALESCE(EXCLUDED.quota, api_usage.quota),
        updated_at = EXCLUDED.updated_at
      RETURNING errors`) as { errors: number }[];
    await sql`INSERT INTO api_usage_hourly (hour, source, calls, errors, remaining)
      VALUES (${kstHour(now)}, ${source}, ${s.calls}, ${s.errors}, ${s.remaining ?? null})
      ON CONFLICT (hour, source) DO UPDATE SET
        calls = api_usage_hourly.calls + EXCLUDED.calls,
        errors = api_usage_hourly.errors + EXCLUDED.errors,
        remaining = COALESCE(EXCLUDED.remaining, api_usage_hourly.remaining)`;
    if (s.alert) alerts.push([source, s, rows[0]?.errors ?? s.errors]);

    // 한도가 얼마 안 남았을 때 (하루 한 번)
    if (s.remaining !== undefined && s.quota) {
      const level = s.remaining <= 0 ? "empty" : s.remaining <= Math.max(10, s.quota * 0.2) ? "low" : null;
      if (level && hasDiscord() && (await once(`quota:${source}:${level}:${day}`, 20 * 3600_000))) {
        await sendDiscord({
          embeds: [
            {
              title: level === "empty" ? `🛑 ${labelOf(source)} 오늘 한도를 다 썼어요` : `🟡 ${labelOf(source)} 한도가 얼마 안 남았어요`,
              color: level === "empty" ? COLOR.red : COLOR.yellow,
              description: `남은 호출 **${s.remaining} / ${s.quota}**${SOURCES[source]?.hint ? `\n${SOURCES[source].hint}` : ""}`,
            },
          ],
        });
      }
    }
  }

  if (!hasDiscord()) return;
  for (const [source, s, todayErrors] of alerts) {
    if (!(await once(`err:${source}`, 3600_000))) continue;
    const a = s.alert!;
    const hint = hintFor(source, a.status, a.message);
    await sendDiscord({
      embeds: [
        {
          title: `⚠️ ${labelOf(source)} 오류`,
          color: COLOR.red,
          description: "```\n" + a.message.slice(0, 600) + "\n```" + (hint ? `\n💡 ${hint}` : ""),
          fields: [
            { name: "상태", value: a.status ? `HTTP ${a.status}` : "연결 실패", inline: true },
            { name: "오늘 에러", value: `${todayErrors}번`, inline: true },
          ],
          footer: { text: "같은 API 오류는 1시간에 한 번만 알려요" },
        },
      ],
    });
  }
}

function hintFor(source: string, status: number, message: string) {
  if (source === "riot" && (status === 401 || status === 403))
    return "Riot 개발용 키가 만료된 것 같아요. developer.riotgames.com 에서 다시 받아 Vercel 의 RIOT_API_KEY 를 바꿔 주세요.";
  if (status === 429) return "호출 한도에 걸렸어요. 잠시 뒤 저절로 풀려요.";
  if (source === "api-football" && /limit|request/i.test(message)) return "오늘 한도를 다 쓴 것 같아요. 한국 시간 오전 9시에 초기화돼요.";
  if (status === 401 || status === 403) return "API 키가 틀렸거나 만료됐을 수 있어요. 환경 변수를 확인해 주세요.";
  if (status >= 500) return "상대 서버 문제예요. 보통 잠시 뒤 괜찮아져요.";
  if (!status) return "네트워크 오류예요. 상대 서버가 느리거나 막혔을 수 있어요.";
  return undefined;
}

const ALERT_STATUS = (s: number) => s === 401 || s === 403 || s === 429 || s >= 500;

function quotaFrom(source: string, h: Headers) {
  if (source !== "api-football") return {};
  const remaining = Number(h.get("x-ratelimit-requests-remaining"));
  const quota = Number(h.get("x-ratelimit-requests-limit"));
  return Number.isFinite(remaining) && h.has("x-ratelimit-requests-remaining")
    ? { remaining, quota: Number.isFinite(quota) && quota > 0 ? quota : undefined }
    : {};
}

/** fetch 와 똑같이 쓰면 됨 */
export async function mfetch(input: string | URL, init?: RequestInit & { next?: { revalidate?: number | false; tags?: string[] } }): Promise<Response> {
  const url = String(input);
  const source = sourceOf(url);
  let res: Response;
  try {
    res = await fetch(input, init);
  } catch (e) {
    const message = `${describe(e)} · ${safePath(url)}`;
    record(source, { ok: false, status: 0, error: message, alert: { status: 0, message } });
    throw e;
  }
  const quota = quotaFrom(source, res.headers);
  if (res.ok) {
    record(source, { ok: true, status: res.status, ...quota });
  } else {
    const body = await res
      .clone()
      .text()
      .catch(() => "");
    const message = `HTTP ${res.status} ${safePath(url)}\n${body.replace(/\s+/g, " ").slice(0, 300)}`;
    record(source, {
      ok: false,
      status: res.status,
      error: message,
      ...quota,
      alert: ALERT_STATUS(res.status) ? { status: res.status, message } : undefined,
    });
  }
  return res;
}

/** 200 으로 왔지만 내용이 에러인 경우 (API-Football 한도 초과 등) */
export function reportApiError(source: string, message: string, status = 200) {
  record(source, { ok: false, error: message, alert: { status, message } });
}

/**
 * "TypeError: fetch failed" 만으로는 왜인지 몰라서, 안쪽 원인(cause)까지 꺼냄
 * 예) fetch failed ← ECONNRESET (연결이 끊김) / UND_ERR_CONNECT_TIMEOUT (연결 시간 초과) / ENOTFOUND (주소 못 찾음)
 */
const CAUSE_KO: Record<string, string> = {
  ECONNRESET: "상대 서버가 연결을 끊음 (서버 IP 차단일 가능성)",
  ECONNREFUSED: "상대 서버가 연결을 거절함",
  ETIMEDOUT: "연결 시간 초과",
  UND_ERR_CONNECT_TIMEOUT: "연결 시간 초과 (서버 IP 차단일 가능성)",
  UND_ERR_HEADERS_TIMEOUT: "응답이 너무 늦음",
  UND_ERR_SOCKET: "연결이 중간에 끊김",
  ENOTFOUND: "주소(DNS)를 못 찾음",
  EAI_AGAIN: "DNS 조회 실패",
  CERT_HAS_EXPIRED: "상대 인증서 만료",
};
function describe(e: unknown): string {
  if (!(e instanceof Error)) return String(e);
  if (e.name === "TimeoutError" || e.name === "AbortError") return "시간 초과 (응답 없음)";
  const parts = [`${e.name}: ${e.message}`];
  let c = (e as { cause?: unknown }).cause;
  for (let i = 0; c && i < 3; i++) {
    const err = c as { code?: string; message?: string; cause?: unknown };
    const code = err.code ?? "";
    parts.push(`← ${code ? `${code} ` : ""}${err.message ?? ""}`.trim() + (CAUSE_KO[code] ? ` (${CAUSE_KO[code]})` : ""));
    c = err.cause;
  }
  return parts.join(" ").slice(0, 300);
}

/** 주소에서 키·토큰 같은 값은 빼고 경로만 */
function safePath(url: string) {
  try {
    const u = new URL(url);
    return `${u.hostname}${u.pathname}`.slice(0, 120);
  } catch {
    return "";
  }
}
