import { createHash, createHmac, timingSafeEqual } from "node:crypto";

/**
 * 아이폰 캘린더 구독용 토큰
 * - CALENDAR_TOKEN 환경 변수가 있으면 그걸 씀 (바꾸면 예전 주소는 바로 막힘)
 * - 없으면 AUTH_SECRET 으로 만든 고정 값 (따로 설정할 필요 없음)
 */
export function calendarToken() {
  const own = process.env.CALENDAR_TOKEN?.trim().replace(/^["']|["']$/g, "");
  if (own) return own;
  const secret = process.env.AUTH_SECRET || process.env.APP_PASSWORD;
  if (!secret) return null;
  return createHmac("sha256", secret).update("calendar-feed:v1").digest("base64url").slice(0, 32);
}

export function checkCalendarToken(got: string | null) {
  const want = calendarToken();
  if (!want || !got) return false;
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}
