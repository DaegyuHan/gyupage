/**
 * 누가 봐도 같은 공용 데이터는 Vercel CDN 에 잠깐 보관 → 두 번째부터는 서버를 안 거치고 바로 응답.
 * s-maxage 동안은 그대로, 그 뒤 swr 동안은 옛 응답을 먼저 주고 뒤에서 새로 받아 둠.
 */
export function cdn(seconds: number, swr = seconds * 6) {
  return { headers: { "Cache-Control": `public, s-maxage=${seconds}, stale-while-revalidate=${swr}` } };
}
