"use client";

import { useEffect, useState } from "react";
import type { NewsTopic } from "@/lib/news";

/** 기타 칸 팀 표시 색 */
const TAG_COLOR: Record<string, string> = {
  "바이에른 뮌헨": "#dc052d",
  "수원 삼성": "#1d4fa0",
  맨유: "#c70101",
  T1: "#e2012d",
};

/** 관심분야 소식: 주제별 최신 기사 제목 5개 (누르면 새 탭에서 기사) */
export default function NewsPlaceholder() {
  const [topics, setTopics] = useState<NewsTopic[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch("/api/news")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: { topics: NewsTopic[] }) => setTopics(d.topics))
      .catch(() => setFailed(true));
  }, []);

  return (
    <section>
      <div className="mb-4 flex items-baseline justify-between">
        <h2 className="text-2xl font-extrabold tracking-tight">관심분야 소식</h2>
        <span className="text-xs text-ink-3">최근 3일 · 30분마다 갱신</span>
      </div>

      {failed && <p className="text-sm text-ink-3">소식을 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-x-10 gap-y-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {(topics ?? [
          { id: "a", label: "Hot Issues", items: [] },
          { id: "b", label: "My Team", items: [] },
          { id: "c", label: "Football", items: [] },
          { id: "d", label: "Games", items: [] },
        ]).map((t) => (
          <div key={t.id} className="min-w-0">
            <h3 className="mb-1 text-sm font-bold text-ink-2">{t.label}</h3>
            {!topics ? (
              <ul className="divide-y divide-line-soft" aria-busy="true">
                {[0.86, 0.7, 0.78, 0.64, 0.82].map((w, i) => (
                  <li key={i} className="py-[9px]">
                    <div className="h-3 rounded-full bg-sunken" style={{ width: `${w * 100}%` }} />
                  </li>
                ))}
              </ul>
            ) : t.items.length === 0 ? (
              <p className="py-3 text-sm text-ink-3">최근 기사가 없어요.</p>
            ) : (
              <ul className="divide-y divide-line-soft">
                {t.items.map((n, i) => (
                  <li key={n.link || n.title}>
                    <a
                      href={n.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={`${n.title} (${n.source})`}
                      className="flex min-w-0 items-center gap-2 py-[7px] text-[14px] font-medium leading-snug hover:text-accent"
                    >
                      {t.id === "hot" && (
                        <span className={`numeral w-3.5 shrink-0 text-center text-[13px] font-extrabold tabular-nums ${i < 3 ? "text-accent" : "text-ink-3"}`}>
                          {i + 1}
                        </span>
                      )}
                      {n.tag && (
                        <span
                          className="shrink-0 rounded-full px-2 py-px text-[10px] font-bold"
                          style={{ color: TAG_COLOR[n.tag] ?? "var(--color-ink-2)", background: `color-mix(in oklab, ${TAG_COLOR[n.tag] ?? "var(--color-ink-3)"} 13%, var(--color-surface))` }}
                        >
                          {n.tag}
                        </span>
                      )}
                      <span className="truncate">{n.title}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
