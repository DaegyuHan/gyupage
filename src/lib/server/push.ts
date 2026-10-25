import webpush from "web-push";
import { db } from "./db";
import { reportApiError } from "./monitor";

/**
 * 웹 푸시 보내기 (아이폰은 '홈 화면에 추가'한 웹앱에서만 받을 수 있어요)
 * VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY 는 한 번 만들어서 계속 써야 해요 — 바꾸면 기존 구독이 다 끊김.
 */
export interface PushPayload {
  title: string;
  body: string;
  /** 눌렀을 때 열 주소 */
  url?: string;
  /** 같은 tag 면 알림 센터에서 덮어씀 */
  tag?: string;
}

const clean = (v?: string) => v?.trim().replace(/^["']|["']$/g, "") || undefined;

export function vapidPublicKey() {
  return clean(process.env.VAPID_PUBLIC_KEY);
}

export function hasPush() {
  return !!(clean(process.env.VAPID_PUBLIC_KEY) && clean(process.env.VAPID_PRIVATE_KEY));
}

let configured = "";
function configure(origin?: string) {
  const pub = clean(process.env.VAPID_PUBLIC_KEY);
  const priv = clean(process.env.VAPID_PRIVATE_KEY);
  if (!pub || !priv) throw new Error("VAPID 키가 없어요");
  // 연락처: mailto: 나 https 주소여야 함 (애플이 꼭 확인함)
  const subject = clean(process.env.VAPID_SUBJECT) ?? (origin?.startsWith("https://") ? origin : "https://vercel.com");
  const id = `${pub}|${subject}`;
  if (configured !== id) {
    webpush.setVapidDetails(subject, pub, priv);
    configured = id;
  }
}

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export async function saveSub(sub: PushSub, device: string | null) {
  const sql = await db();
  await sql`INSERT INTO push_subs (endpoint, p256dh, auth, device, created_at)
    VALUES (${sub.endpoint}, ${sub.keys.p256dh}, ${sub.keys.auth}, ${device}, ${Date.now()})
    ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, device = EXCLUDED.device`;
}

export async function removeSub(endpoint: string) {
  const sql = await db();
  await sql`DELETE FROM push_subs WHERE endpoint = ${endpoint}`;
}

export async function countSubs() {
  const sql = await db();
  const [r] = (await sql`SELECT count(*)::int AS n FROM push_subs`) as { n: number }[];
  return r?.n ?? 0;
}

/** 등록된 모든 기기로 보냄 — 보낸 기기 수 */
export async function sendPush(payload: PushPayload, opts: { origin?: string; only?: string } = {}): Promise<number> {
  if (!hasPush()) return 0;
  configure(opts.origin);
  const sql = await db();
  const subs = (opts.only
    ? await sql`SELECT endpoint, p256dh, auth FROM push_subs WHERE endpoint = ${opts.only}`
    : await sql`SELECT endpoint, p256dh, auth FROM push_subs`) as { endpoint: string; p256dh: string; auth: string }[];

  let sent = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify({ url: "/", ...payload }),
          { TTL: 60 * 60 * 6, urgency: "normal" },
        );
        sent++;
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode ?? 0;
        // 404·410: 앱을 지웠거나 알림을 끈 기기 → 정리
        if (status === 404 || status === 410) await removeSub(s.endpoint);
        else reportApiError("push", `푸시 전송 실패 ${status}: ${(e as { body?: string }).body ?? String(e)}`.slice(0, 400), status);
      }
    }),
  );
  return sent;
}
