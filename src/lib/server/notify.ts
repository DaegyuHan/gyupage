/**
 * 5분마다 불리는 일(/api/cron/tick)
 * - 폰 푸시: 아침 브리핑 · 일정 30분 전 · 응원팀 킥오프/결과 · 밤 9시 남은 할 일 · 새 CS 글
 * - 디스코드: 매일 아침 9시 API 상태 리포트
 * 같은 알림은 notify_log 로 한 번만 보냄.
 */
import { getCsNotes, isCsSample } from "@/lib/cs";
import { holidayName } from "@/lib/holidays";
import { getHomeMatches } from "@/lib/home/matches";
import { db } from "./db";
import { COLOR, hasDiscord, once, sendDiscord, type Embed } from "./discord";
import { kstDay, labelOf, mfetch, SOURCES } from "./monitor";
import { countSubs, hasPush, sendPush, type PushPayload } from "./push";
import { DEFAULT_PREFS, type PushPrefs } from "@/lib/pushKinds";
import { AF_SAVER } from "@/lib/football/apiFootball";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
const DAY = 86400_000;

function kstNow() {
  const d = new Date(Date.now() + 9 * 3600_000);
  return { day: d.toISOString().slice(0, 10), hm: d.toISOString().slice(11, 16), dow: d.getUTCDay(), month: d.getUTCMonth() + 1, date: d.getUTCDate() };
}
/** KST "YYYY-MM-DD" + "HH:MM" → 시각(ms) */
const at = (day: string, hm: string) => Date.parse(`${day}T${hm}:00+09:00`);

export async function getPushPrefs(): Promise<PushPrefs> {
  const sql = await db();
  const rows = (await sql`SELECT value FROM prefs WHERE key = 'push'`) as { value: Partial<PushPrefs> | null }[];
  return { ...DEFAULT_PREFS, ...(rows[0]?.value ?? {}) };
}

interface TickResult {
  push: string[];
  discord: string[];
  skipped?: string;
}

export async function runTick(origin: string): Promise<TickResult> {
  const out: TickResult = { push: [], discord: [] };
  const now = kstNow();
  const send = async (key: string, cooldown: number, payload: PushPayload) => {
    if (!(await once(key, cooldown))) return;
    const n = await sendPush(payload, { origin });
    out.push.push(`${key} → ${n}대`);
  };

  if (hasPush() && (await countSubs()) > 0) {
    const prefs = await getPushPrefs();
    const sql = await db();

    // 1) 아침 브리핑 (08:30~10:00 첫 실행)
    if (prefs.brief && now.hm >= "08:30" && now.hm < "10:00") {
      const events = (await sql`SELECT title, time FROM events
        WHERE start_date <= ${now.day} AND end_date >= ${now.day} AND category <> 'todo'
        ORDER BY time NULLS LAST`) as { title: string; time: string | null }[];
      const todos = (await sql`SELECT text FROM todos WHERE day = ${now.day} AND NOT done ORDER BY position, created_at`) as { text: string }[];
      const holiday = holidayName(now.day);
      if (events.length || todos.length || holiday) {
        const head = [holiday && `🎌 ${holiday}`, events.length && `📅 일정 ${events.length}개`, todos.length && `✅ 할 일 ${todos.length}개`].filter(Boolean).join(" · ");
        const lines = [...events.map((e) => `· ${e.time ? `${e.time} ` : ""}${e.title}`), ...todos.map((t) => `· ${t.text}`)].slice(0, 5);
        await send(`push:brief:${now.day}`, 20 * 3600_000, {
          title: `좋은 아침이에요 · ${now.month}월 ${now.date}일 ${WEEK[now.dow]}요일`,
          body: [head, ...lines].join("\n"),
          url: "/",
          tag: "brief",
        });
      }
    }

    // 2) 시간이 있는 일정 30분 전
    if (prefs.event) {
      const events = (await sql`SELECT id, title, time FROM events
        WHERE start_date = ${now.day} AND time IS NOT NULL AND category <> 'todo'`) as { id: string; title: string; time: string }[];
      for (const e of events) {
        const left = at(now.day, e.time) - Date.now();
        if (left > 0 && left <= 35 * 60_000) {
          await send(`push:event:${e.id}:${now.day}`, DAY, {
            title: `📅 ${Math.max(1, Math.round(left / 60_000))}분 뒤 · ${e.title}`,
            body: `${e.time} 시작이에요`,
            url: "/calendar",
            tag: `event-${e.id}`,
          });
        }
      }
    }

    // 3) 응원 팀 킥오프 30분 전 / 결과
    if (prefs.match || prefs.result) {
      const matches = await getHomeMatches().catch(() => []);
      for (const m of matches) {
        const kick = at(m.date, m.time);
        const left = kick - Date.now();
        const vs = `${m.home === false ? `${m.opponent} vs ${m.team}` : `${m.team} vs ${m.opponent}`}`;
        if (prefs.match && m.state === "pre" && left > 0 && left <= 35 * 60_000) {
          await send(`push:kick:${m.id}`, 7 * DAY, {
            title: `⚽ ${Math.max(1, Math.round(left / 60_000))}분 뒤 킥오프`,
            body: `${vs} · ${m.time} · ${m.competition}`,
            url: "/",
            tag: `match-${m.id}`,
          });
        }
        if (prefs.result && m.state === "done" && m.score && Date.now() - kick < 8 * 3600_000) {
          const word = m.result === "W" ? "승리 🎉" : m.result === "L" ? "패배" : "무승부";
          await send(`push:result:${m.id}`, 7 * DAY, {
            title: `${m.team} ${m.score} ${word}`,
            body: `vs ${m.opponent} · ${m.competition}`,
            url: "/",
            tag: `match-${m.id}`,
          });
        }
      }
    }

    // 4) 밤 9시: 남은 할 일
    if (prefs.todo && now.hm >= "21:00" && now.hm < "23:30") {
      const left = (await sql`SELECT text FROM todos WHERE day = ${now.day} AND NOT done ORDER BY position, created_at`) as { text: string }[];
      if (left.length) {
        await send(`push:todo:${now.day}`, 20 * 3600_000, {
          title: `오늘 할 일이 ${left.length}개 남았어요`,
          body: left.slice(0, 4).map((t) => `· ${t.text}`).join("\n"),
          url: "/",
          tag: "todo",
        });
      }
    }

    // 5) 오늘의 CS (평일, 새 글이 배포되면)
    if (prefs.cs && now.dow >= 1 && now.dow <= 5 && now.hm >= "08:00" && now.hm < "13:00" && !isCsSample()) {
      const note = getCsNotes()[0];
      if (note?.date === now.day) {
        await send(`push:cs:${now.day}`, 20 * 3600_000, {
          title: `🧠 오늘의 CS · No.${note.no}`,
          body: note.title,
          url: `/cs/${note.date}`,
          tag: "cs",
        });
      }
    }
  } else out.skipped = hasPush() ? "푸시 등록한 기기 없음" : "VAPID 키 없음";

  // 6) 디스코드 일일 리포트 (09:00 이후 첫 실행)
  if (hasDiscord() && now.hm >= "09:00" && (await once(`discord:daily:${now.day}`, 20 * 3600_000))) {
    await sendDiscord({ embeds: [await dailyReport()] });
    out.discord.push("daily");
  }
  return out;
}

/* ───────── 디스코드 리포트 ───────── */

const ENV_CHECK: [string, string][] = [
  ["DATABASE_URL", "Neon DB"],
  ["AUTH_SECRET", "로그인"],
  ["APP_PASSWORD", "로그인"],
  ["API_FOOTBALL_KEY", "API-Football"],
  ["FOOTBALL_DATA_TOKEN", "football-data"],
  ["NEXON_API_KEY", "메이플"],
  ["RIOT_API_KEY", "LoL"],
  ["STEAM_API_KEY", "Steam"],
  ["WIDGET_TOKEN", "아이폰 위젯"],
  ["VAPID_PUBLIC_KEY", "푸시"],
  ["VAPID_PRIVATE_KEY", "푸시"],
  ["CRON_SECRET", "5분 작업"],
];

async function apiFootballStatus() {
  const key = process.env.API_FOOTBALL_KEY?.trim();
  if (!key) return null;
  // /status 는 하루 한도에 안 들어감
  const res = await mfetch("https://v3.football.api-sports.io/status", { headers: { "x-apisports-key": key }, cache: "no-store" });
  if (!res.ok) return `확인 실패 (HTTP ${res.status})`;
  const j = (await res.json()) as { response?: { requests?: { current: number; limit_day: number }; subscription?: { plan?: string } } };
  const r = j.response?.requests;
  return r ? `오늘 ${r.current} / ${r.limit_day}회 사용 · 남은 ${Math.max(0, r.limit_day - r.current)}회` : "응답 형식이 달라요";
}

async function riotStatus() {
  const key = process.env.RIOT_API_KEY?.trim().replace(/^["']|["']$/g, "");
  if (!key) return null;
  const res = await mfetch("https://kr.api.riotgames.com/lol/status/v4/platform-data", { headers: { "X-Riot-Token": key }, cache: "no-store" });
  if (res.ok) return { ok: true, text: "키 정상" };
  if (res.status === 401 || res.status === 403) return { ok: false, text: "키 만료/무효 — 다시 받아서 RIOT_API_KEY 교체" };
  return { ok: false, text: `확인 실패 (HTTP ${res.status})` };
}

export async function dailyReport(): Promise<Embed> {
  const now = kstNow();
  const yesterday = kstDay(Date.now() - DAY);
  const warnings: string[] = [];
  const fields: Embed["fields"] = [];

  // 어제 API 사용량
  let usage: { source: string; calls: number; errors: number; last_error: string | null; remaining: number | null; quota: number | null }[] = [];
  let dbOk = true;
  try {
    const sql = await db();
    usage = (await sql`SELECT source, calls, errors, last_error, remaining, quota FROM api_usage WHERE day = ${yesterday} ORDER BY calls DESC`) as typeof usage;
    // 오래된 기록 정리 (60일)
    await sql`DELETE FROM api_usage WHERE day < ${kstDay(Date.now() - 60 * DAY)}`;
    await sql`DELETE FROM api_usage_hourly WHERE hour < ${kstDay(Date.now() - 14 * DAY)}`;
    await sql`DELETE FROM notify_log WHERE at < ${Date.now() - 30 * DAY}`;
  } catch (e) {
    dbOk = false;
    warnings.push(`DB 연결 실패: ${String(e).slice(0, 120)}`);
  }

  if (usage.length) {
    const lines = usage.map((u) => {
      const err = u.errors ? ` · ❗에러 ${u.errors}` : "";
      const q = u.remaining != null && u.quota ? ` · 남은 ${u.remaining}/${u.quota}` : "";
      return `${u.errors ? "🔴" : "🟢"} **${labelOf(u.source)}** ${u.calls}회${err}${q}`;
    });
    fields.push({ name: `어제 (${yesterday.slice(5).replace("-", "/")}) 외부 API 호출`, value: lines.join("\n") });
    const bad = usage.filter((u) => u.errors > 0 && u.last_error);
    if (bad.length) {
      fields.push({
        name: "마지막 에러",
        value: bad
          .slice(0, 5)
          .map((u) => `**${labelOf(u.source)}** \`${(u.last_error ?? "").split("\n")[0].slice(0, 120)}\``)
          .join("\n"),
      });
    }
  } else if (dbOk) fields.push({ name: "어제 외부 API 호출", value: "기록 없음 (사이트를 아무도 안 열었거나 캐시로만 응답)" });

  // 지금 상태
  const live: string[] = [];
  try {
    const af = await apiFootballStatus();
    if (af) live.push(`⚽ **API-Football** ${af} · 절약 모드 ${AF_SAVER ? "켜짐" : "꺼짐(as-is 측정 중)"}`);
  } catch (e) {
    live.push(`⚽ **API-Football** 확인 실패: ${String(e).slice(0, 80)}`);
  }
  try {
    const riot = await riotStatus();
    if (riot) {
      live.push(`🎮 **Riot** ${riot.ok ? "🟢" : "🔴"} ${riot.text}`);
      if (!riot.ok) warnings.push(`Riot ${riot.text}`);
    }
  } catch (e) {
    live.push(`🎮 **Riot** 확인 실패: ${String(e).slice(0, 80)}`);
  }
  live.push(`🗄️ **Neon DB** ${dbOk ? "🟢 정상" : "🔴 연결 실패"}`);
  if (hasPush() && dbOk) live.push(`🔔 **푸시** 등록 기기 ${await countSubs().catch(() => 0)}대`);
  fields.push({ name: "지금 상태", value: live.join("\n") });

  // Daily CS
  if (!isCsSample()) {
    const last = getCsNotes()[0];
    const weekday = now.dow >= 1 && now.dow <= 5;
    const ok = !weekday || last?.date === now.day;
    fields.push({ name: "Daily CS", value: `${ok ? "🟢" : "🟡"} 마지막 글 ${last?.date ?? "-"} No.${last?.no ?? "-"}${ok ? "" : " — 오늘 글이 아직 없어요 (Actions 확인)"}` });
    if (!ok) warnings.push("오늘 Daily CS 글이 아직 없어요");
  }

  const missing = ENV_CHECK.filter(([k]) => !process.env[k]?.trim());
  if (missing.length) {
    fields.push({ name: "비어 있는 환경 변수", value: missing.map(([k, w]) => `\`${k}\` (${w})`).join(", ") });
  }

  return {
    title: `📊 규페이지 일일 리포트 · ${now.month}월 ${now.date}일 (${WEEK[now.dow]})`,
    color: warnings.length || usage.some((u) => u.errors > 0) ? COLOR.yellow : COLOR.green,
    description: warnings.length ? warnings.map((w) => `⚠️ ${w}`).join("\n") : "모두 정상이에요 ✨",
    fields,
    footer: { text: `추적 중인 API ${Object.keys(SOURCES).length}개 · 매일 오전 9시` },
  };
}
