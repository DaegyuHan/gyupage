"use client";

import type { WeatherResponse } from "@/lib/weather";
import WeatherIcon, { weatherLabel } from "./WeatherIcon";

interface Props {
  data: WeatherResponse | null;
  failed: boolean;
  placeName: string;
  isMine: boolean;
  locating: boolean;
  onUseMyLocation: () => void;
  onReset: () => void;
}

/** "수원 · 지금 20° 맑음" + 위치 바꾸기 */
export default function WeatherNow({ data, failed, placeName, isMine, locating, onUseMyLocation, onReset }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-sunken py-1 pl-2.5 pr-1 text-sm">
      {failed ? (
        <span className="text-ink-3">날씨를 불러오지 못했어요</span>
      ) : !data ? (
        <span className="h-4 w-28 rounded-full bg-line" aria-busy="true" />
      ) : (
        <span
          className="flex items-center gap-1.5"
          title={`체감 ${data.current.feels}°`}
        >
          <WeatherIcon code={data.current.code} size={18} night={!data.current.isDay} />
          <span className="font-semibold">{placeName}</span>
          <span className="text-ink-2">
            지금 <span className="numeral font-semibold text-ink">{data.current.temp}°</span> {weatherLabel(data.current.code)}
          </span>
        </span>
      )}
      <button
        onClick={isMine ? onReset : onUseMyLocation}
        disabled={locating}
        className="ml-1 flex h-7 items-center gap-1 rounded-full px-2 text-xs font-medium text-ink-2 hover:bg-surface hover:text-ink disabled:opacity-60"
        title={isMine ? "수원 날씨로 돌아가기" : "브라우저 위치로 날씨 보기"}
      >
        <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden>
          <circle cx="8" cy="8" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
          <circle cx="8" cy="8" r="1.6" fill="currentColor" />
          <path d="M8 1v2M8 13v2M1 8h2M13 8h2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
        {locating ? "찾는 중" : isMine ? "수원으로" : "내 위치"}
      </button>
    </div>
  );
}
