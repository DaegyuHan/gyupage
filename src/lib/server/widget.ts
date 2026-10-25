import { createHash, timingSafeEqual } from "node:crypto";

/**
 * 아이폰 위젯(Scriptable)용 토큰 — 오늘 할 일 '읽기'만 허락.
 * WIDGET_TOKEN 을 바꾸면 예전 토큰은 바로 무효.
 */
export function checkWidgetToken(req: Request) {
  const want = process.env.WIDGET_TOKEN?.trim();
  if (!want) return false;
  const got = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!got) return false;
  // 길이 차이로 새는 정보 없게 해시끼리 비교
  const a = createHash("sha256").update(got).digest();
  const b = createHash("sha256").update(want).digest();
  return timingSafeEqual(a, b);
}
