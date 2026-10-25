import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * 혼자 쓰는 사이트라 비밀번호 하나로 로그인.
 * - APP_PASSWORD: 로그인 비밀번호
 * - AUTH_SECRET: 로그인 쿠키 서명용 긴 무작위 문자열
 * 쿠키에는 "만료시각.서명" 만 들어가서 위조할 수 없어요.
 */
export const SESSION_COOKIE = "gp_session";
/** 로그인했다는 표시만 (자바스크립트가 읽을 수 있음, 실제 인증은 SESSION_COOKIE) */
export const SESSION_HINT = "gp_in";
export const SESSION_DAYS = 30;

function secret() {
  const s = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!s) throw new Error("AUTH_SECRET 이 없어요");
  return s;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

function safeEqual(a: string, b: string) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

export function checkPassword(input: string) {
  const pw = process.env.APP_PASSWORD?.trim().replace(/^["']|["']$/g, "");
  if (!pw) return false;
  // 길이 차이로 새는 정보를 막으려고 해시끼리 비교
  return safeEqual(sign(`pw:${input}`), sign(`pw:${pw}`));
}

export function makeSessionToken() {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  return `${exp}.${sign(`session:${exp}`)}`;
}

export function verifyToken(token: string | undefined) {
  if (!token) return false;
  const [exp, mac] = token.split(".");
  if (!exp || !mac || Number(exp) < Date.now()) return false;
  try {
    return safeEqual(mac, sign(`session:${exp}`));
  } catch {
    return false;
  }
}

export async function isAuthed() {
  const jar = await cookies();
  return verifyToken(jar.get(SESSION_COOKIE)?.value);
}

/** API 에서: 로그인 안 했으면 401 응답을 돌려줌 */
export async function requireAuth(): Promise<NextResponse | null> {
  if (await isAuthed()) return null;
  return NextResponse.json({ error: "로그인이 필요해요" }, { status: 401 });
}
