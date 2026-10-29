import type { NewsItem } from "@/lib/news";

function ago(iso: string) {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60_000);
  if (!Number.isFinite(m)) return "";
  if (m < 60) return `${Math.max(1, m)}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

/** 리그 뉴스 (한국어, 최근 3일) */
export default function LeagueNews({ items }: { items: NewsItem[] }) {
  if (!items.length) return <p className="text-sm text-ink-3">최근 3일 동안 기사가 없어요.</p>;
  return (
    <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface">
      {items.map((n) => (
        <li key={n.link}>
          <a href={n.link} target="_blank" rel="noopener noreferrer" className="group block px-4 py-3">
            <span className="line-clamp-2 text-[15px] font-semibold leading-snug group-hover:text-accent">{n.title}</span>
            <span className="mt-1 block text-xs text-ink-3">
              {n.source}
              {n.publishedAt && ` · ${ago(n.publishedAt)}`}
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
