/**
 * 날씨 — Open-Meteo (무료, 키 필요 없음)
 * 지금 날씨 + 오늘부터 7일 예보 + 지금부터 내일 밤까지 시간별. 30분 캐시.
 */
import { cached } from "./football/apiFootball";
import { mfetch } from "@/lib/server/monitor";

export interface WeatherDay {
  date: string; // YYYY-MM-DD (한국 시간)
  code: number;
  max: number;
  min: number;
  /** 강수 확률 % */
  rain: number;
}

export interface WeatherHour {
  /** "2026-10-25T14:00" (한국 시간) */
  time: string;
  code: number;
  temp: number;
  rain: number;
  isDay: boolean;
}

export interface WeatherResponse {
  current: { temp: number; feels: number; code: number; isDay: boolean };
  days: WeatherDay[];
  /** 지금 시각부터 내일 23시까지 */
  hours: WeatherHour[];
}

/** 기본 위치: 수원 */
export const DEFAULT_PLACE = { name: "수원", lat: 37.2636, lon: 127.0286 };

const KST_HOUR = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Seoul",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  hourCycle: "h23",
});

/** 지금 한국 시각을 "2026-10-25T14:00" 형태로 (분은 버림) */
function nowHourKst() {
  return KST_HOUR.format(new Date()).replace(" ", "T") + ":00";
}

async function load(lat: number, lon: number): Promise<Omit<WeatherResponse, "hours"> & { allHours: WeatherHour[] }> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,apparent_temperature,weather_code,is_day` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max` +
    `&hourly=temperature_2m,weather_code,precipitation_probability,is_day` +
    `&timezone=Asia%2FSeoul&forecast_days=7`;
  const res = await mfetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`open-meteo ${res.status}`);
  const j = (await res.json()) as {
    current: { temperature_2m: number; apparent_temperature: number; weather_code: number; is_day: number };
    daily: {
      time: string[];
      weather_code: number[];
      temperature_2m_max: number[];
      temperature_2m_min: number[];
      precipitation_probability_max: (number | null)[];
    };
    hourly: {
      time: string[];
      temperature_2m: number[];
      weather_code: number[];
      precipitation_probability: (number | null)[];
      is_day: number[];
    };
  };
  return {
    current: {
      temp: Math.round(j.current.temperature_2m),
      feels: Math.round(j.current.apparent_temperature),
      code: j.current.weather_code,
      isDay: j.current.is_day === 1,
    },
    days: j.daily.time.map((date, i) => ({
      date,
      code: j.daily.weather_code[i],
      max: Math.round(j.daily.temperature_2m_max[i]),
      min: Math.round(j.daily.temperature_2m_min[i]),
      rain: j.daily.precipitation_probability_max[i] ?? 0,
    })),
    // 오늘·내일 이틀치만 저장 (잘라내기는 요청할 때 '지금' 기준으로)
    allHours: j.hourly.time.slice(0, 48).map((time, i) => ({
      time,
      code: j.hourly.weather_code[i],
      temp: Math.round(j.hourly.temperature_2m[i]),
      rain: j.hourly.precipitation_probability[i] ?? 0,
      isDay: j.hourly.is_day[i] === 1,
    })),
  };
}

const loadCached = cached("weather-v3", 60 * 30, load);

export async function getWeather(lat: number, lon: number): Promise<WeatherResponse> {
  const { allHours, ...rest } = await loadCached(lat, lon);
  const now = nowHourKst();
  const hours = allHours.filter((h) => h.time >= now);
  // '지금' 칸은 정시 예보 대신 현재 관측값으로 (위쪽 '지금 21°' 와 맞춤)
  if (hours[0]) hours[0] = { ...hours[0], temp: rest.current.temp, code: rest.current.code, isDay: rest.current.isDay };
  return { ...rest, hours };
}
