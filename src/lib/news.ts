/**
 * 관심분야 소식 (키 필요 없음, 30분 캐시)
 * - 해외축구·게임: 구글 뉴스 검색 (한국어)
 * - 핫이슈: 구글 뉴스 한국 주요 뉴스 (화제 순서 그대로)
 * - 기타: 응원하는 팀(바이에른 뮌헨, 수원 삼성, 맨유, T1)별 검색을 번갈아 섞음
 * 같은 사건을 여러 언론사가 쓴 기사는 비슷한 제목끼리 걸러서 서로 다른 소식만 보여줌.
 */
import { cached } from "./football/apiFootball";

export interface NewsItem {
  title: string;
  source: string;
  link: string;
  publishedAt: string; // ISO
  /** 기타 칸에서 어느 팀 기사인지 */
  tag?: string;
}

export interface NewsTopic {
  id: string;
  label: string;
  items: NewsItem[];
}

const COUNT = 5;

/* ───────── 주제 정의 ───────── */

interface Filters {
  /** 제목에 이 중 하나는 들어 있어야 함 */
  must?: RegExp;
  /** 제목에 들어 있으면 뺌 */
  exclude?: RegExp;
  /** 빼는 언론사 */
  blockSources?: RegExp;
  /** 너무 짧은 제목(커뮤니티 글 등) 제외 */
  minLength?: number;
}

/** 구글 뉴스 검색형 */
interface SearchTopic extends Filters {
  kind: "search";
  id: string;
  label: string;
  queries: string[];
  /** 이런 기사를 하나는 맨 앞에 (예: 후기) */
  prefer?: RegExp;
  /** 같은 선수·팀 기사는 하나만 (주인공 이름 목록, g 플래그) */
  subjects?: RegExp;
}

/** RSS/Atom 피드형 (피드마다 몇 개씩) */
interface FeedTopic {
  kind: "feeds";
  id: string;
  label: string;
  feeds: (Filters & { url: string; source: string; take: number })[];
}

/** 여러 그룹(팀)을 번갈아 섞는 형 */
interface GroupTopic {
  kind: "groups";
  id: string;
  label: string;
  exclude?: RegExp;
  blockSources?: RegExp;
  groups: { tag: string; query: string; must: RegExp; also?: RegExp; people?: RegExp }[];
}

/** 지금 많이 다뤄지는 주요 뉴스 (피드 순서 = 화제 순서) */
interface TopTopic {
  kind: "top";
  id: string;
  label: string;
  url: string;
  /** 이 시간 안의 기사만 */
  hours: number;
  exclude?: RegExp;
  politics?: RegExp;
}

type Topic = SearchTopic | FeedTopic | GroupTopic | TopTopic;

/** 정치 기사인지 (제목 기준) — 정당·정치인·선거·국회·외교안보 */
const POLITICS =
  /정치|정당|여당|야당|여야|민주당|국민의힘|국힘|조국혁신당|혁신당|개혁신당|진보당|정의당|당대표|최고위|원내|비대위|공천|의원|국회|국감|국정감사|본회의|법안|입법|청문회|대통령|대통령실|용산|청와대|총리|장관|차관|후보|선거|대선|총선|지선|경선|투표|여론조사|지지율|탄핵|특검|국정|정부 |정권|내각|개헌|계엄|이재명|윤석열|김건희|한동훈|장동혁|조국|이준석|오세훈|김문수|홍준표|정청래|우원식|김민석|트럼프|시진핑|푸틴|마크롱|젤렌스키|네타냐후|스타머|메르츠|다카이치|이시바|모디|밴스|김정은|김여정|북한|北|尹|李|韓 |美 |中 |정상회담|외교|안보|국방|대북|대미|대중 |관세 협상|NATO|나토|유엔|UN /;

const FOOTBALL_SPAM = /예측|배당|토토|베팅|승부 ?예상|중계 ?링크|하이라이트 ?영상/;
const SPAM_SOURCES = /laodong|vietnam|vn$|베트남/i;

const TOPICS: Topic[] = [
  {
    kind: "top",
    id: "hot",
    label: "Hot Issues",
    // 구글 뉴스 한국 '주요 뉴스' — 여러 언론사가 한꺼번에 다루는 순서대로 나옴
    url: "https://news.google.com/rss?hl=ko&gl=KR&ceid=KR:ko",
    hours: 24,
    exclude: /\[광고\]|\[AD\]|운세|날씨\]|오늘의 /,
    // 정치 이슈는 뺌
    politics: POLITICS,
  },
  {
    kind: "groups",
    id: "etc",
    label: "My Team",
    exclude: FOOTBALL_SPAM,
    blockSources: SPAM_SOURCES,
    groups: [
      {
        tag: "바이에른 뮌헨",
        query: "바이에른 뮌헨",
        must: /뮌헨|바이에른|콤파니|콩파니|김민재|케인/,
        people: /콤파니|콩파니|김민재|케인|뮐러|노이어|무시알라|올리세|키미히|디아스|우파메카노/g,
      },
      {
        tag: "수원 삼성",
        query: "수원삼성",
        must: /수원 ?삼성|블루윙즈/,
        also: /축구|K리그|감독|골|승|선두|경기|선수|이정효|승격/,
        people: /이정효|연승|승격|선두/g,
      },
      {
        tag: "맨유",
        query: "맨유 OR 맨체스터 유나이티드",
        must: /맨유|맨체스터 ?유나이티드/,
        people: /아모림|캐릭|브루노|페르난데스|래시포드|호일룬|마이누|라멘스|콘테|본머스|감독 경질/g,
      },
      {
        tag: "T1",
        query: "T1 페이커 OR T1 롤 OR T1 LCK OR T1 롤드컵",
        must: /T1|페이커/,
        also: /롤드컵|LoL|롤|LCK|페이커|e스포츠|이스포츠|월즈|스위스|젠지|DK|디플러스|한화생명|게이머|구마유시|케리아|오너|도란/,
        // 같은 상대 팀 경기 기사는 하나만
        people: /DK|디플러스|젠지|한화생명|LOS|CFO|IG|TES|팝업|굿즈/g,
      },
    ],
  },
  {
    kind: "search",
    id: "football",
    label: "Football",
    queries: ["해외축구", "프리미어리그", "라리가 OR 분데스리가 OR 세리에A", "챔피언스리그"],
    must: /축구|리그|골|감독|이적|챔스|챔피언스|프리미어|라리가|분데스|세리에|EPL|토트넘|맨유|맨시티|리버풀|아스널|첼시|레알|바르셀로나|바르사|뮌헨|PSG|아틀레티코|손흥민|이강인|김민재|황희찬|이재성|오현규|설영우|양민혁/i,
    exclude: FOOTBALL_SPAM,
    blockSources: SPAM_SOURCES,
    subjects:
      /손흥민|이강인|김민재|황희찬|이재성|오현규|설영우|양민혁|황인범|백승호|홀란|음바페|케인|살라|토트넘|맨유|맨시티|리버풀|아스널|첼시|레알|바르셀로나|바르사|뮌헨|PSG|아틀레티코|AT 마드리드|마인츠|도르트문트/g,
  },
  {
    kind: "search",
    id: "games",
    label: "Games",
    // 게임 전문 매체 위주: 출시·리뷰 기사가 대부분
    queries: ["출시 OR 리뷰 OR 후기 OR 체험 site:gamemeca.com", "출시 OR 리뷰 OR 후기 site:gamechosun.co.kr", "게임리뷰"],
    must: /출시|발매|정식|앞서 ?해보기|얼리 ?액세스|리뷰|후기|체험기|해보니|해봤|CBT|OBT|베타|데모|사전 ?예약|시연|론칭|런칭/,
    exclude:
      /주가|실적|매출|영업이익|흑자|적자|채용|기부|주식|증권|IPO|PBR|ROE|노조|투자|인수|합병|소송|규제|국감|과징금|데스크탑|노트북|모니터|키보드|마우스|헤드셋|그래픽카드|신용카드|자격증|영화|드라마|애니|가이드|공략|쿠폰|코드|개최|페스티벌|행사|주차\)|\[계층\]|\[이슈\]/,
    // 진짜 리뷰: [리뷰] 꼬리표가 있거나, 게임 이름('…')과 함께 후기·체험기
    prefer: /\[(게임)?리뷰\]|리뷰\]|['‘"“〈<].+['’"”〉>].*(후기|체험기|해보니|해봤)|체험기/,
    minLength: 14,
  },
];

/* ───────── RSS / Atom 읽기 ───────── */

function decode(s: string) {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .trim();
}

/** RSS(<item>) 와 Atom(<entry>) 둘 다 읽음 */
function parse(xml: string, fallbackSource = ""): NewsItem[] {
  return [...xml.matchAll(/<(item|entry)>([\s\S]*?)<\/\1>/g)].map((m, i) => {
    const body = m[2];
    const get = (tag: string) => decode(body.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`))?.[1] ?? "");
    const source = get("source") || fallbackSource;
    let title = get("title");
    // 구글 뉴스 제목 끝의 " - 언론사" 제거
    if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
    // Atom 은 <link href='…'/> (따옴표 종류가 피드마다 다름)
    const link = decode(get("link") || body.match(/<link[^>]*href=["']([^"']+)["']/)?.[1] || "");
    const pub = Date.parse(get("pubDate") || get("published") || get("updated") || get("dc:date"));
    return {
      title,
      source,
      link,
      // 날짜가 없는 피드는 피드 순서(최신이 위)를 그대로 쓰도록 조금씩 이르게
      publishedAt: Number.isFinite(pub) ? new Date(pub).toISOString() : new Date(Date.now() - i * 60_000).toISOString(),
    };
  });
}

async function fetchFeed(url: string, source = ""): Promise<NewsItem[]> {
  const res = await fetch(url, { cache: "no-store", headers: { "User-Agent": "Mozilla/5.0 (gyupage personal dashboard)" } });
  if (!res.ok) throw new Error(`feed ${new URL(url).host} ${res.status}`);
  return parse(await res.text(), source);
}

function search(query: string, days = 3) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:${days}d`)}&hl=ko&gl=KR&ceid=KR:ko`;
  return fetchFeed(url);
}

/* ───────── 비슷한 기사 거르기 ───────── */

/** 제목에서 의미 있는 낱말(2글자 이상)만 뽑기 */
function words(title: string) {
  return new Set(
    title
      .replace(/\[[^\]]*\]|\([^)]*\)/g, " ")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .split(/\s+/)
      .map((w) => w.replace(/(은|는|이|가|을|를|의|에|와|과|도|로|으로|에서)$/u, ""))
      .filter((w) => w.length >= 2),
  );
}

function similar(a: Set<string>, b: Set<string>) {
  let same = 0;
  for (const w of a) if (b.has(w)) same++;
  return same / Math.min(a.size, b.size || 1);
}

/** 같은 팀의 다른 표기를 하나로 */
function normSubject(s: string) {
  if (/콤파니|콩파니/.test(s)) return "콤파니";
  if (/디플러스|DK/.test(s)) return "DK";
  if (/브루노|페르난데스/.test(s)) return "브루노";
  if (/아틀레티코|AT 마드리드/.test(s)) return "아틀레티코";
  if (/바르사|바르셀로나/.test(s)) return "바르셀로나";
  return s;
}

const byNewest = (a: NewsItem, b: NewsItem) => b.publishedAt.localeCompare(a.publishedAt);

/** 비슷한 소식은 하나만 남김 (최신순). seed 는 이미 고른 기사, subjects 는 주인공 이름 */
function pickDistinct(items: NewsItem[], n: number, seed: NewsItem[] = [], subjects?: RegExp) {
  const subjectsOf = (t: string) => new Set((subjects ? t.match(subjects) ?? [] : []).map(normSubject));
  const usedSubjects = new Set<string>();
  for (const it of seed) subjectsOf(it.title).forEach((x) => usedSubjects.add(x));
  const chosen = seed.map((item) => ({ item, w: words(item.title) }));
  for (const item of [...items].sort(byNewest)) {
    if (chosen.length >= n) break;
    if (chosen.some((c) => c.item === item)) continue;
    const w = words(item.title);
    if (w.size === 0) continue;
    if (chosen.some((c) => similar(c.w, w) >= 0.4)) continue;
    const subj = subjectsOf(item.title);
    if ([...subj].some((x) => usedSubjects.has(x))) continue;
    subj.forEach((x) => usedSubjects.add(x));
    chosen.push({ item, w });
  }
  return chosen.map((c) => c.item);
}

function passes(n: NewsItem, f: Filters) {
  return (
    (!f.must || f.must.test(n.title)) &&
    !f.exclude?.test(n.title) &&
    !f.blockSources?.test(n.source) &&
    n.title.length >= (f.minLength ?? 0)
  );
}

function uniqueByTitle(list: NewsItem[]) {
  const seen = new Set<string>();
  return list.filter((n) => (seen.has(n.title) ? false : (seen.add(n.title), true)));
}

/* ───────── 주제별 불러오기 ───────── */

async function loadSearch(t: SearchTopic) {
  const lists = await Promise.all(t.queries.map((q) => search(q).catch(() => [] as NewsItem[])));
  const pool = uniqueByTitle(lists.flat().filter((n) => passes(n, t)));
  if (!t.prefer) return pickDistinct(pool, COUNT, [], t.subjects);
  // 후기 같은 기사 하나를 먼저 고르고, 나머지는 최신 소식으로 채움 (비슷한 건 제외)
  const preferred = pickDistinct(pool.filter((n) => t.prefer!.test(n.title)), 1);
  return pickDistinct(pool, COUNT, preferred, t.subjects);
}

async function loadFeeds(t: FeedTopic) {
  const parts = await Promise.all(
    t.feeds.map(async (f) => {
      const items = await fetchFeed(f.url, f.source).catch(() => [] as NewsItem[]);
      return pickDistinct(items.filter((n) => passes(n, f)), f.take);
    }),
  );
  // 피드별로 정한 개수만큼, 모자라면 다른 피드에서 채움
  const picked = parts.flat();
  return picked.slice(0, COUNT);
}

async function loadTop(t: TopTopic) {
  const items = await fetchFeed(t.url);
  const since = Date.now() - t.hours * 3600_000;
  const out: NewsItem[] = [];
  // 최신순으로 섞지 않고 구글이 매긴 순서(화제도)를 그대로 따름
  for (const n of items) {
    if (out.length >= COUNT) break;
    if (!n.title || Date.parse(n.publishedAt) < since || t.exclude?.test(n.title) || t.politics?.test(n.title)) continue;
    if (out.some((o) => similar(words(o.title), words(n.title)) >= 0.4)) continue;
    out.push(n);
  }
  return out;
}

async function loadGroups(t: GroupTopic) {
  const perGroup: NewsItem[][] = await Promise.all(
    t.groups.map(async (g) => {
      const items = await search(g.query, 4).catch(() => [] as NewsItem[]);
      const ok = items.filter(
        (n) =>
          g.must.test(n.title) &&
          (!g.also || g.also.test(n.title)) &&
          !t.exclude?.test(n.title) &&
          !t.blockSources?.test(n.source),
      );
      return pickDistinct(ok, COUNT, [], g.people).map((n): NewsItem => ({ ...n, tag: g.tag }));
    }),
  );
  // 팀마다 돌아가며 하나씩 (각 줄 안에서는 최신 팀 먼저)
  const out: NewsItem[] = [];
  for (let round = 0; out.length < COUNT; round++) {
    const row = perGroup.map((list) => list[round]).filter((n): n is NewsItem => !!n).sort(byNewest);
    if (row.length === 0) break;
    for (const n of row) {
      if (out.length >= COUNT) break;
      if (out.some((o) => similar(words(o.title), words(n.title)) >= 0.4)) continue;
      out.push(n);
    }
  }
  return out;
}

async function loadTopic(id: string): Promise<NewsItem[]> {
  const t = TOPICS.find((x) => x.id === id)!;
  if (t.kind === "feeds") return loadFeeds(t);
  if (t.kind === "groups") return loadGroups(t);
  if (t.kind === "top") return loadTop(t);
  return loadSearch(t);
}

const topicCached = cached("news-v16", 60 * 30, loadTopic);

export async function getNews(): Promise<NewsTopic[]> {
  return Promise.all(
    TOPICS.map(async (t) => {
      try {
        return { id: t.id, label: t.label, items: await topicCached(t.id) };
      } catch (e) {
        console.error("[news]", t.id, e);
        return { id: t.id, label: t.label, items: [] };
      }
    }),
  );
}
