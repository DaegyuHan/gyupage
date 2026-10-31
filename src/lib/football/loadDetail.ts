import { getMatchDetail, type MatchDetail } from "./detail";
import { getEspnDetail } from "./espnDetail";
import { getKleagueDetail } from "./kleagueDetail";

/** 경기 상세 id → MatchDetail (ESPN espn-PL-123 · K리그 kl-2026-11-01-02-07 · API-Football 숫자) */
export async function loadDetail(idText: string): Promise<{ d: MatchDetail | null; error?: string }> {
  if (idText.startsWith("espn-") || idText.startsWith("kl-")) {
    try {
      return { d: await (idText.startsWith("espn-") ? getEspnDetail(idText) : getKleagueDetail(idText)) };
    } catch {
      return { d: null, error: "경기 정보를 불러오지 못했어요." };
    }
  }
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) return { d: null };
  try {
    return { d: await getMatchDetail(id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { d: null, error: msg === "NO_KEY" ? "API 키가 없어서 경기 상세를 볼 수 없어요." : "경기 정보를 불러오지 못했어요." };
  }
}
