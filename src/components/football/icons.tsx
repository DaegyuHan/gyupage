/** 축구 화면에서 쓰는 작은 아이콘들 (이모지 대신 SVG) */

export function BallIcon({ size = 14, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" className={className} aria-hidden>
      <circle cx="8" cy="8" r="7" fill="var(--color-surface)" stroke="currentColor" strokeWidth="1.3" />
      <path d="M8 4.6 10.9 6.7 9.8 10H6.2L5.1 6.7Z" fill="currentColor" />
      <path
        d="M8 4.6V1.2M10.9 6.7l3.2-1M9.8 10l2 2.8M6.2 10l-2 2.8M5.1 6.7l-3.2-1"
        stroke="currentColor"
        strokeWidth="1.1"
      />
    </svg>
  );
}

export function CardIcon({ color, size = 14, double = false }: { color: "yellow" | "red"; size?: number; double?: boolean }) {
  const fill = color === "yellow" ? "#f5c518" : "#e03a3a";
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      {double && <rect x="2.5" y="2" width="8" height="11" rx="1.5" fill="#f5c518" />}
      <rect x={double ? 5.5 : 4} y={double ? 3 : 2} width="8" height="11" rx="1.5" fill={fill} />
    </svg>
  );
}

export function SubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <path d="M5 13V4M2.5 6.5 5 4l2.5 2.5" fill="none" stroke="#12a150" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M11 3v9M8.5 9.5 11 12l2.5-2.5" fill="none" stroke="#e03a3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function VarIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden>
      <rect x="1.5" y="3" width="13" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
      <path d="M6 14h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

export function Crest({ src, size = 16, className = "" }: { src?: string; size?: number; className?: string }) {
  if (!src) return <span className={`inline-block shrink-0 rounded-full bg-sunken ${className}`} style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={size} height={size} loading="lazy" className={`shrink-0 object-contain ${className}`} style={{ width: size, height: size }} />;
}
