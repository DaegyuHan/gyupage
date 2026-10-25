/**
 * F1
 * - 일정·챔피언십 순위: Jolpica F1 API (예전 Ergast 후속, 키 필요 없음)
 * - 예선·스프린트·결승 결과: OpenF1 (세션이 끝나면 금방 올라옴, 키 필요 없음)
 */
import { cached } from "./football/apiFootball";
import { mfetch } from "@/lib/server/monitor";

export interface F1Session {
  key: "fp1" | "fp2" | "fp3" | "sprintQuali" | "sprint" | "quali" | "race";
  label: string;
  start: string; // ISO
}

export interface F1Race {
  round: number;
  name: string; // 한글 그랑프리 이름
  circuit: string;
  place: string; // "오스틴, 미국"
  raceStart: string; // ISO
  sessions: F1Session[];
}

export interface F1ResultRow {
  pos: number | null;
  code: string;
  name: string;
  team: string;
  color: string;
  /** 예선: 베스트 랩, 결승: 우승자 기록 또는 차이 */
  time: string;
  /** 리타이어 등 */
  note?: string;
}

export interface F1Results {
  key: "quali" | "sprint" | "race";
  label: string;
  rows: F1ResultRow[];
}

export interface F1Standing {
  pos: number;
  name: string;
  team: string;
  points: number;
}

export interface F1Response {
  season: number;
  /** 지금 그랑프리 (결승 7일 전 ~ 결승 2일 뒤) */
  current?: F1Race & { results: F1Results[] };
  next?: F1Race;
  standings: F1Standing[];
  generatedAt: string;
}

/* ───────── 이름 한글화 ───────── */

const COUNTRY: Record<string, string> = {
  USA: "미국",
  "United States": "미국",
  Mexico: "멕시코",
  Brazil: "브라질",
  Qatar: "카타르",
  UAE: "아랍에미리트",
  Australia: "호주",
  China: "중국",
  Japan: "일본",
  Bahrain: "바레인",
  "Saudi Arabia": "사우디아라비아",
  Italy: "이탈리아",
  Monaco: "모나코",
  Spain: "스페인",
  Canada: "캐나다",
  Austria: "오스트리아",
  UK: "영국",
  "United Kingdom": "영국",
  Belgium: "벨기에",
  Hungary: "헝가리",
  Netherlands: "네덜란드",
  Azerbaijan: "아제르바이잔",
  Singapore: "싱가포르",
};

const CITY: Record<string, string> = {
  Austin: "오스틴",
  "Mexico City": "멕시코시티",
  "São Paulo": "상파울루",
  "Las Vegas": "라스베이거스",
  Lusail: "루사일",
  "Abu Dhabi": "아부다비",
  "Yas Marina": "야스 마리나",
  Melbourne: "멜버른",
  Shanghai: "상하이",
  Suzuka: "스즈카",
  Sakhir: "사키르",
  Jeddah: "제다",
  Miami: "마이애미",
  Imola: "이몰라",
  "Monte-Carlo": "몬테카를로",
  Barcelona: "바르셀로나",
  Montmeló: "바르셀로나",
  Madrid: "마드리드",
  Montreal: "몬트리올",
  Spielberg: "슈필베르크",
  Silverstone: "실버스톤",
  Spa: "스파",
  Budapest: "부다페스트",
  Zandvoort: "잔드보르트",
  Monza: "몬차",
  Baku: "바쿠",
  "Marina Bay": "싱가포르",
  Singapore: "싱가포르",
};

const GP: [RegExp, string][] = [
  [/united states/i, "미국"],
  [/mexico/i, "멕시코시티"],
  [/são paulo|sao paulo|brazil/i, "상파울루"],
  [/las vegas/i, "라스베이거스"],
  [/qatar/i, "카타르"],
  [/abu dhabi/i, "아부다비"],
  [/australian/i, "호주"],
  [/chinese/i, "중국"],
  [/japanese/i, "일본"],
  [/bahrain/i, "바레인"],
  [/saudi/i, "사우디아라비아"],
  [/miami/i, "마이애미"],
  [/emilia/i, "에밀리아로마냐"],
  [/monaco/i, "모나코"],
  [/barcelona/i, "바르셀로나-카탈루냐"],
  [/spanish/i, "스페인"],
  [/canadian/i, "캐나다"],
  [/austrian/i, "오스트리아"],
  [/british/i, "영국"],
  [/belgian/i, "벨기에"],
  [/hungarian/i, "헝가리"],
  [/dutch/i, "네덜란드"],
  [/italian/i, "이탈리아"],
  [/azerbaijan/i, "아제르바이잔"],
  [/singapore/i, "싱가포르"],
];

const gpName = (raceName: string) => {
  const hit = GP.find(([re]) => re.test(raceName));
  return hit ? `${hit[1]} 그랑프리` : raceName;
};

/* ───────── 일정 (Jolpica) ───────── */

interface JolpicaSession {
  date: string;
  time?: string;
}
interface JolpicaRace {
  round: string;
  raceName: string;
  date: string;
  time?: string;
  Circuit: { circuitName: string; Location: { locality: string; country: string } };
  FirstPractice?: JolpicaSession;
  SecondPractice?: JolpicaSession;
  ThirdPractice?: JolpicaSession;
  SprintQualifying?: JolpicaSession;
  SprintShootout?: JolpicaSession;
  Sprint?: JolpicaSession;
  Qualifying?: JolpicaSession;
}

const iso = (s: JolpicaSession) => new Date(`${s.date}T${s.time ?? "00:00:00Z"}`).toISOString();

function toRace(r: JolpicaRace): F1Race {
  const loc = r.Circuit.Location;
  const sessions: F1Session[] = [];
  const add = (key: F1Session["key"], label: string, s?: JolpicaSession) => s && sessions.push({ key, label, start: iso(s) });
  add("fp1", "연습 1", r.FirstPractice);
  add("fp2", "연습 2", r.SecondPractice);
  add("fp3", "연습 3", r.ThirdPractice);
  add("sprintQuali", "스프린트 퀄리파잉", r.SprintQualifying ?? r.SprintShootout);
  add("sprint", "스프린트", r.Sprint);
  add("quali", "퀄리파잉", r.Qualifying);
  const raceStart = iso({ date: r.date, time: r.time });
  sessions.push({ key: "race", label: "결승", start: raceStart });
  sessions.sort((a, b) => a.start.localeCompare(b.start));

  return {
    round: Number(r.round),
    name: gpName(r.raceName),
    circuit: r.Circuit.circuitName,
    place: [CITY[loc.locality] ?? loc.locality, COUNTRY[loc.country] ?? loc.country]
      .filter((v, i, a) => a.indexOf(v) === i)
      .join(", "),
    raceStart,
    sessions,
  };
}

async function json<T>(url: string): Promise<T> {
  const res = await mfetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`${new URL(url).host} ${res.status}`);
  return (await res.json()) as T;
}

const seasonCached = cached("f1-season-v2", 60 * 60 * 6, async () => {
  const j = await json<{ MRData: { RaceTable: { season: string; Races: JolpicaRace[] } } }>(
    "https://api.jolpi.ca/ergast/f1/current.json",
  );
  return { season: Number(j.MRData.RaceTable.season), races: j.MRData.RaceTable.Races.map(toRace) };
});

/* ───────── 챔피언십 (Jolpica) ───────── */

const standingsCached = cached("f1-standings", 60 * 60, async (): Promise<F1Standing[]> => {
  const j = await json<{
    MRData: {
      StandingsTable: {
        StandingsLists: {
          DriverStandings: {
            position: string;
            points: string;
            Driver: { familyName: string; givenName: string };
            Constructors: { name: string }[];
          }[];
        }[];
      };
    };
  }>("https://api.jolpi.ca/ergast/f1/current/driverStandings.json");
  const list = j.MRData.StandingsTable.StandingsLists[0]?.DriverStandings ?? [];
  return list.slice(0, 5).map((d) => ({
    pos: Number(d.position),
    name: `${d.Driver.givenName} ${d.Driver.familyName}`,
    team: d.Constructors.at(-1)?.name ?? "",
    points: Number(d.points),
  }));
});

/* ───────── 결과 (OpenF1) ───────── */

interface OFSession {
  session_key: number;
  session_name: string;
  date_start: string;
  date_end: string;
}
interface OFDriver {
  driver_number: number;
  name_acronym: string;
  last_name: string;
  team_name: string;
  team_colour?: string | null;
}
interface OFResult {
  position: number | null;
  driver_number: number;
  duration: number | (number | null)[] | null;
  gap_to_leader: number | string | (number | string | null)[] | null;
  dnf: boolean;
  dns: boolean;
  dsq: boolean;
  number_of_laps?: number;
}

const yearSessions = cached("f1-of-sessions", 60 * 60 * 6, async (year: number) =>
  json<OFSession[]>(`https://api.openf1.org/v1/sessions?year=${year}`),
);

function lapTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = (sec - m * 60).toFixed(3).padStart(6, "0");
  return m > 0 ? `${m}:${s}` : s;
}

function raceTime(sec: number) {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = (sec % 60).toFixed(3).padStart(6, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${s}` : `${m}:${s}`;
}

function lastNumber<T>(v: T | (T | null)[] | null): T | null {
  if (Array.isArray(v)) {
    for (let i = v.length - 1; i >= 0; i--) if (v[i] !== null && v[i] !== undefined) return v[i] as T;
    return null;
  }
  return v;
}

async function sessionResult(key: number, kind: F1Results["key"]): Promise<F1ResultRow[]> {
  const [rows, drivers] = await Promise.all([
    json<OFResult[]>(`https://api.openf1.org/v1/session_result?session_key=${key}`),
    json<OFDriver[]>(`https://api.openf1.org/v1/drivers?session_key=${key}`),
  ]);
  const by = new Map(drivers.map((d) => [d.driver_number, d]));
  return rows
    .sort((a, b) => (a.position ?? 99) - (b.position ?? 99))
    .map((r) => {
      const d = by.get(r.driver_number);
      let time = "";
      let note: string | undefined;
      if (r.dsq) note = "실격";
      else if (r.dns) note = "출발 못 함";
      else if (r.dnf) note = "리타이어";

      if (kind === "quali") {
        const best = lastNumber(r.duration);
        time = typeof best === "number" ? lapTime(best) : "";
      } else if (!note) {
        const gap = lastNumber(r.gap_to_leader);
        const dur = lastNumber(r.duration);
        if (r.position === 1 && typeof dur === "number") time = raceTime(dur);
        else if (typeof gap === "number") time = `+${gap.toFixed(3)}`;
        else if (typeof gap === "string") time = gap.replace(/LAPS?/i, "랩").replace(/^\+?/, "+");
      }
      return {
        pos: r.position,
        code: d?.name_acronym ?? String(r.driver_number),
        name: d?.last_name ?? "",
        team: d?.team_name ?? "",
        color: d?.team_colour ? `#${d.team_colour}` : "#9aa3b2",
        time,
        note,
      };
    });
}

// 세션이 끝난 뒤 결과가 정리될 때까지 잠깐씩 다시 받음
const resultCached = cached("f1-result", 60 * 15, sessionResult);

async function weekendResults(race: F1Race, now: number): Promise<F1Results[]> {
  const year = new Date(race.raceStart).getUTCFullYear();
  const start = Date.parse(race.raceStart);
  const all = await yearSessions(year);
  // 결승 4일 전 ~ 1일 뒤 사이의 세션 = 이번 그랑프리 주말
  const weekend = all.filter((s) => {
    const t = Date.parse(s.date_start);
    return t > start - 4 * 86_400_000 && t < start + 86_400_000;
  });
  const pick = (name: string) => weekend.find((s) => s.session_name === name && Date.parse(s.date_end) < now);

  const wanted: [F1Results["key"], string, OFSession | undefined][] = [
    ["race", "결승", pick("Race")],
    ["sprint", "스프린트", pick("Sprint")],
    ["quali", "퀄리파잉", pick("Qualifying")],
  ];
  const out: F1Results[] = [];
  for (const [key, label, s] of wanted) {
    if (!s) continue;
    try {
      const rows = await resultCached(s.session_key, key);
      if (rows.length) out.push({ key, label, rows });
    } catch (e) {
      console.error("[f1] result", key, e);
    }
  }
  return out;
}

/* ───────── 합치기 ───────── */

const DAY = 86_400_000;

export async function getF1(now = Date.now()): Promise<F1Response> {
  const [{ season, races }, standings] = await Promise.all([
    seasonCached(),
    standingsCached().catch(() => [] as F1Standing[]),
  ]);

  // 결승 후 2일까지는 '지금 그랑프리'로 보여줌 (월요일 아침에 결과 확인)
  const idx = races.findIndex((r) => Date.parse(r.raceStart) + 2 * DAY > now);
  const first = idx >= 0 ? races[idx] : undefined;
  const isCurrent = first && Date.parse(first.raceStart) - now <= 7 * DAY;

  let current: F1Response["current"];
  if (first && isCurrent) {
    let results: F1Results[] = [];
    try {
      results = await weekendResults(first, now);
    } catch (e) {
      console.error("[f1] weekend", e);
    }
    current = { ...first, results };
  }

  return {
    season,
    current,
    next: isCurrent ? races[idx + 1] : first,
    standings,
    generatedAt: new Date(now).toISOString(),
  };
}
