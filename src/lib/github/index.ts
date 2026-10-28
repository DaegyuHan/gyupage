/**
 * GitHub 잔디 — 키 없이 쓰는 공개 데이터 (30분 캐시)
 * - 기여 수: github.com 프로필 잔디 HTML 을 직접 읽음 (안 되면 예비로 github-contributions-api.jogruber.de)
 * - 최근 저장소: api.github.com 공개 API (GITHUB_TOKEN 이 있으면 한도가 넉넉해짐)
 */
import { cached } from "../football/apiFootball";
import { mfetch } from "@/lib/server/monitor";

export const GITHUB_USER = process.env.GITHUB_USER || "DaegyuHan";
/** 화면에 보여줄 기간(일) */
const DAYS = 35;

export interface ContribDay {
  date: string; // YYYY-MM-DD
  count: number;
  /** 0~4 (GitHub 기준 단계) */
  level: number;
}

export interface GithubRepo {
  name: string;
  url: string;
  lang: string | null;
  color: string;
  pushedAt: string;
}

export interface GithubSummary {
  user: string;
  avatar: string;
  /** 최근 DAYS 일 (오래된 날 → 오늘) */
  days: ContribDay[];
  monthTotal: number;
  activeDays: number;
  best: ContribDay | null;
  /** 오늘(아직 안 했으면 어제)까지 이어진 연속 일수 */
  streak: number;
  repos: GithubRepo[];
}

const LANG_COLOR: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572a5",
  Java: "#b07219",
  Kotlin: "#a97bff",
  Go: "#00add8",
  Rust: "#dea584",
  Swift: "#f05138",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  HTML: "#e34c26",
  CSS: "#563d7c",
  Shell: "#89e051",
  Dart: "#00b4ab",
  Vue: "#41b883",
  EJS: "#a91e50",
  SCSS: "#c6538c",
};

function kstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** github.com/users/{user}/contributions (프로필 잔디 조각) 에서 날짜·단계·개수 꺼내기 */
async function fromGithub(user: string): Promise<ContribDay[]> {
  const res = await mfetch(`https://github.com/users/${encodeURIComponent(user)}/contributions`, {
    headers: { "User-Agent": "Mozilla/5.0 (gyupage personal dashboard)", Accept: "text/html" },
    cache: "no-store",
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`github contributions ${res.status}`);
  const html = await res.text();
  // 칸: <td ... data-date="2026-10-25" id="contribution-day-component-0-52" data-level="4" ...>
  const cells = new Map<string, { date: string; level: number }>();
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const tag = m[0];
    const date = tag.match(/data-date="(\d{4}-\d{2}-\d{2})"/)?.[1];
    const id = tag.match(/\bid="([^"]+)"/)?.[1];
    if (!date || !id) continue;
    cells.set(id, { date, level: Number(tag.match(/data-level="(\d)"/)?.[1] ?? 0) });
  }
  // 개수: <tool-tip for="contribution-day-component-0-52">11 contributions on …</tool-tip>
  const counts = new Map<string, number>();
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^\s*([\d,]+)\s+contribution/);
    counts.set(m[1], n ? Number(n[1].replace(/,/g, "")) : 0);
  }
  if (!cells.size) throw new Error("github contributions: 잔디를 못 읽었어요 (페이지 구조가 바뀜?)");
  return [...cells.entries()].map(([id, c]) => ({ date: c.date, level: c.level, count: counts.get(id) ?? (c.level > 0 ? 1 : 0) }));
}

async function fromJogruber(user: string): Promise<ContribDay[]> {
  const res = await mfetch(`https://github-contributions-api.jogruber.de/v4/${user}?y=last`, { cache: "no-store", signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`contributions ${res.status}`);
  return ((await res.json()) as { contributions?: ContribDay[] }).contributions ?? [];
}

async function load(): Promise<GithubSummary> {
  const user = GITHUB_USER;
  const headers: Record<string, string> = { "User-Agent": "gyupage", Accept: "application/vnd.github+json" };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const [contrib, reposRes] = await Promise.all([
    fromGithub(user).catch(() => fromJogruber(user)),
    mfetch(`https://api.github.com/users/${user}/repos?sort=pushed&per_page=6`, { headers, cache: "no-store", signal: AbortSignal.timeout(6000) }).catch(() => null),
  ]);

  // 오늘(KST)까지만, 날짜순
  const today = kstToday();
  const all = contrib.filter((d) => d.date <= today).sort((a, b) => a.date.localeCompare(b.date));

  // 연속 일수: 오늘 아직 안 했으면 어제부터 셈 (GitHub 방식)
  let streak = 0;
  let i = all.length - 1;
  if (i >= 0 && all[i].date === today && all[i].count === 0) i--;
  for (; i >= 0 && all[i].count > 0; i--) streak++;

  const days = all.slice(-DAYS);
  const best = days.reduce<ContribDay | null>((b, d) => (d.count > (b?.count ?? 0) ? d : b), null);

  let repos: GithubRepo[] = [];
  if (reposRes?.ok) {
    const raw = (await reposRes.json()) as { name: string; html_url: string; language: string | null; pushed_at: string; fork: boolean }[];
    repos = raw
      .filter((r) => !r.fork)
      .slice(0, 3)
      .map((r) => ({ name: r.name, url: r.html_url, lang: r.language, color: LANG_COLOR[r.language ?? ""] ?? "#8a94a6", pushedAt: r.pushed_at }));
  }

  return {
    user,
    avatar: `https://github.com/${user}.png?size=80`,
    days,
    monthTotal: days.reduce((s, d) => s + d.count, 0),
    activeDays: days.filter((d) => d.count > 0).length,
    best,
    streak,
    repos,
  };
}

export const getGithub = cached("github-v3", 60 * 30, load);
