/** WMO 날씨 코드 → 종류 / 한글 */
export type WeatherKind = "clear" | "partly" | "cloudy" | "fog" | "drizzle" | "rain" | "snow" | "storm";

export function weatherKind(code: number): WeatherKind {
  if (code === 0) return "clear";
  if (code === 1 || code === 2) return "partly";
  if (code === 3) return "cloudy";
  if (code === 45 || code === 48) return "fog";
  if (code >= 51 && code <= 57) return "drizzle";
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return "rain";
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return "snow";
  if (code >= 95) return "storm";
  return "cloudy";
}

export function weatherLabel(code: number): string {
  if (code === 0) return "맑음";
  if (code === 1) return "대체로 맑음";
  if (code === 2) return "구름 조금";
  if (code === 3) return "흐림";
  if (code === 45 || code === 48) return "안개";
  if (code >= 51 && code <= 57) return "이슬비";
  if (code >= 61 && code <= 67) return "비";
  if (code >= 80 && code <= 82) return "소나기";
  if (code >= 71 && code <= 77) return "눈";
  if (code === 85 || code === 86) return "눈 소나기";
  if (code >= 95) return "뇌우";
  return "흐림";
}

const SUN = "#f2a516";
const CLOUD = "var(--color-ink-3)";
const CLOUD_FILL = "color-mix(in oklab, var(--color-ink-3) 28%, var(--color-surface))";
const DROP = "#3b82f6";

function Cloud({ dy = 0 }: { dy?: number }) {
  return (
    <path
      d={`M7 ${17 + dy}h10.5a3.5 3.5 0 0 0 .4-6.98A5 5 0 0 0 8.2 ${9 + dy}.1 4 4 0 0 0 7 ${17 + dy}Z`}
      fill={CLOUD_FILL}
      stroke={CLOUD}
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  );
}

const MOON = "#8a9bd6";

export default function WeatherIcon({ code, size = 22, night = false }: { code: number; size?: number; night?: boolean }) {
  const kind = weatherKind(code);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-label={weatherLabel(code)} role="img">
      {kind === "clear" && night && <path d="M17.5 14.6A6.5 6.5 0 0 1 9.4 6.5a6.5 6.5 0 1 0 8.1 8.1Z" fill={MOON} />}
      {kind === "partly" && night && (
        <g>
          <path d="M14 9.2A4 4 0 0 1 9.3 4.5a4 4 0 1 0 4.7 4.7Z" fill={MOON} />
          <Cloud dy={2} />
        </g>
      )}
      {kind === "clear" && !night && (
        <g>
          <circle cx="12" cy="12" r="4.4" fill={SUN} />
          <g stroke={SUN} strokeWidth="1.7" strokeLinecap="round">
            <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
          </g>
        </g>
      )}
      {kind === "partly" && !night && (
        <g>
          <circle cx="9" cy="8.5" r="3.6" fill={SUN} />
          <g stroke={SUN} strokeWidth="1.5" strokeLinecap="round">
            <path d="M9 2.4v1.4M3 8.5h1.4M4.7 4.2l1 1M13.3 4.2l-1 1" />
          </g>
          <Cloud dy={2} />
        </g>
      )}
      {kind === "cloudy" && <Cloud dy={0} />}
      {kind === "fog" && (
        <g stroke={CLOUD} strokeWidth="1.7" strokeLinecap="round">
          <path d="M4 9h16M6 13h12M4 17h16" />
        </g>
      )}
      {(kind === "drizzle" || kind === "rain") && (
        <g>
          <Cloud dy={-3} />
          <g stroke={DROP} strokeWidth="1.7" strokeLinecap="round">
            {kind === "rain" ? <path d="M8.5 17.5l-1 2.5M12.5 17.5l-1 2.5M16.5 17.5l-1 2.5" /> : <path d="M9 18v1.6M13 18v1.6M17 18v1.6" />}
          </g>
        </g>
      )}
      {kind === "snow" && (
        <g>
          <Cloud dy={-3} />
          <g fill={CLOUD}>
            <circle cx="8.5" cy="19" r="1.1" />
            <circle cx="12.5" cy="20" r="1.1" />
            <circle cx="16.5" cy="19" r="1.1" />
          </g>
        </g>
      )}
      {kind === "storm" && (
        <g>
          <Cloud dy={-3} />
          <path d="M12.5 15.5 10 19.5h2.6L11.5 22.5l3.6-4.6h-2.6l1.3-2.4Z" fill={SUN} />
        </g>
      )}
    </svg>
  );
}
