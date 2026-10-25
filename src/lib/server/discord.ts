import { db, hasDb } from "./db";

/**
 * 디스코드 웹후크로 운영 알림 보내기 (DISCORD_WEBHOOK_URL)
 * 웹후크 주소는 비밀번호와 같아요 — 코드에 쓰지 말고 환경 변수에만.
 */
export interface Embed {
  title?: string;
  description?: string;
  color?: number;
  fields?: { name: string; value: string; inline?: boolean }[];
  footer?: { text: string };
  timestamp?: string;
  url?: string;
}

export const COLOR = { red: 0xe5484d, yellow: 0xf5a524, green: 0x30a46c, blue: 0x5b7cfa, gray: 0x8a94a6 };

export function hasDiscord() {
  return !!webhook();
}

function webhook() {
  const u = process.env.DISCORD_WEBHOOK_URL?.trim().replace(/^["']|["']$/g, "");
  return u && /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\//.test(u) ? u : null;
}

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export async function sendDiscord(payload: { content?: string; embeds?: Embed[] }): Promise<boolean> {
  const url = webhook();
  if (!url) return false;
  const embeds = payload.embeds?.slice(0, 10).map((e) => ({
    ...e,
    title: e.title && cut(e.title, 250),
    description: e.description && cut(e.description, 3900),
    fields: e.fields?.slice(0, 25).map((f) => ({ ...f, name: cut(f.name, 250), value: cut(f.value || "-", 1000) })),
    timestamp: e.timestamp ?? new Date().toISOString(),
  }));
  try {
    // 모니터링 대상이 아니라서 일부러 그냥 fetch
    const res = await fetch(`${url}?wait=false`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      // 이름·프로필은 디스코드에서 정한 웹후크 설정 그대로 씀
      body: JSON.stringify({ content: payload.content, embeds, allowed_mentions: { parse: [] } }),
      cache: "no-store",
    });
    if (!res.ok) console.error("[discord]", res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (e) {
    console.error("[discord]", e);
    return false;
  }
}

/**
 * 같은 key 의 알림은 cooldown 동안 한 번만 — 보내도 되면 true
 * (DB 가 없으면 항상 true)
 */
export async function once(key: string, cooldownMs: number): Promise<boolean> {
  if (!hasDb()) return true;
  const now = Date.now();
  const sql = await db();
  const rows = (await sql`INSERT INTO notify_log (key, at) VALUES (${key}, ${now})
    ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at WHERE notify_log.at < ${now - cooldownMs}
    RETURNING key`) as unknown[];
  return rows.length > 0;
}
