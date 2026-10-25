"use client";

import type { WeatherHour } from "@/lib/weather";
import WeatherIcon, { weatherLabel } from "./WeatherIcon";

interface Props {
  hours: WeatherHour[];
  placeName: string;
}

const COL = 56; // 한 시간 칸 너비(px)
const CHART_H = 64; // 기온 곡선 높이
const PAD_Y = 18; // 숫자가 들어갈 위아래 여백

/** 지금부터 내일 밤까지 시간별 날씨 (가로 스크롤) */
export default function HourlyWeather({ hours, placeName }: Props) {
  if (hours.length === 0) return null;

  const temps = hours.map((h) => h.temp);
  const hi = Math.max(...temps);
  const lo = Math.min(...temps);
  const span = Math.max(1, hi - lo);
  const y = (t: number) => PAD_Y + (1 - (t - lo) / span) * (CHART_H - PAD_Y * 2 + 8);
  const x = (i: number) => i * COL + COL / 2;
  const width = hours.length * COL;

  // 부드러운 곡선 (가운데 점을 제어점으로 쓰는 간단한 방식)
  const pts = hours.map((h, i) => [x(i), y(h.temp)] as const);
  let path = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 1; i < pts.length; i++) {
    const [px, py] = pts[i - 1];
    const [cx, cy] = pts[i];
    const mx = (px + cx) / 2;
    path += ` C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}`;
  }
  const area = `${path} L ${pts.at(-1)![0]} ${CHART_H} L ${pts[0][0]} ${CHART_H} Z`;

  const today = hours[0].time.slice(0, 10);
  const hiIdx = temps.indexOf(hi);
  const loIdx = temps.indexOf(lo);

  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-extrabold tracking-tight">시간별 날씨</h2>
        <span className="text-xs text-ink-3">
          {placeName} · 지금부터 내일 밤까지 · 최고 <span className="font-semibold text-ink-2">{hi}°</span> 최저{" "}
          <span className="font-semibold text-ink-2">{lo}°</span>
        </span>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface [scrollbar-width:thin]">
        <div className="relative py-3" style={{ width }}>
          {/* 기온 곡선 */}
          <svg width={width} height={CHART_H} className="block" aria-hidden>
            <defs>
              <linearGradient id="temp-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="var(--color-accent)" stopOpacity="0.18" />
                <stop offset="100%" stopColor="var(--color-accent)" stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill="url(#temp-fill)" />
            <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" />
            {pts.map(([px, py], i) => (
              <g key={i}>
                <circle cx={px} cy={py} r={i === 0 ? 3.5 : 2.5} fill={i === 0 ? "var(--color-accent)" : "var(--color-surface)"} stroke="var(--color-accent)" strokeWidth="1.5" />
                <text
                  x={px}
                  y={py - 8}
                  textAnchor="middle"
                  className="numeral"
                  fontSize="12"
                  fontWeight={i === 0 || i === hiIdx || i === loIdx ? 800 : 600}
                  fill={i === hiIdx ? "#e0573a" : i === loIdx ? "#3b82f6" : "var(--color-ink)"}
                >
                  {hours[i].temp}°
                </text>
              </g>
            ))}
          </svg>

          {/* 시간 칸 */}
          <ol className="flex">
            {hours.map((h, i) => {
              const hour = Number(h.time.slice(11, 13));
              const newDay = h.time.slice(0, 10) !== today && hour === 0;
              return (
                <li
                  key={h.time}
                  className={`relative flex shrink-0 flex-col items-center gap-1 pt-2 ${newDay ? "border-l border-line" : ""}`}
                  style={{ width: COL }}
                  title={`${weatherLabel(h.code)}, ${h.temp}°, 강수 확률 ${h.rain}%`}
                >
                  {newDay && (
                    <span className="absolute -top-[76px] left-1 rounded-full bg-sunken px-1.5 py-0.5 text-[10px] font-bold text-ink-2">
                      내일
                    </span>
                  )}
                  <WeatherIcon code={h.code} size={22} night={!h.isDay} />
                  <span className={`h-3.5 text-[10px] font-semibold tabular-nums ${h.rain >= 20 ? "text-[#3b82f6]" : "text-transparent"}`}>
                    {h.rain}%
                  </span>
                  <span className={`text-xs tabular-nums ${i === 0 ? "font-bold text-accent" : "text-ink-2"}`}>
                    {i === 0 ? "지금" : `${hour}시`}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
