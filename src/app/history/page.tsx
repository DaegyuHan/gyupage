import Link from "next/link";
import { getAllHistory, groupByYear } from "@/lib/history";

export const metadata = { title: "히스토리 | 규페이지" };

function shortDate(date: string) {
  if (!date) return "";
  const [, m, d] = date.split("-");
  return d ? `${Number(m)}.${Number(d)}` : `${Number(m)}월`;
}

export default function HistoryPage() {
  const docs = getAllHistory();
  const groups = groupByYear(docs);
  const companies = [...new Set(docs.map((d) => d.company).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="grid gap-6 border-b border-line pb-8 pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">히스토리</h1>
          <p className="mt-3 max-w-xl text-ink-2">
            회사에서 해온 일들을 한 줄로 모아 봤어요. <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">content/history</code>{" "}
            폴더에 마크다운 파일을 넣으면 날짜순으로 자동 정리돼요.
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="numeral text-4xl font-extrabold">{docs.length}</div>
            <div className="text-sm text-ink-2">기록</div>
          </div>
          {companies.length > 0 && (
            <div>
              <div className="numeral text-4xl font-extrabold">{companies.length}</div>
              <div className="text-sm text-ink-2">회사</div>
            </div>
          )}
        </div>
      </header>

      {docs.length === 0 && (
        <p className="py-16 text-center text-ink-2">
          아직 기록이 없어요. <code>content/history/_TEMPLATE.md</code> 를 복사해서 첫 기록을 남겨 보세요.
        </p>
      )}

      <div>
        {groups.map(([year, items]) => (
          <section key={year} className="grid gap-4 border-b border-line-soft py-10 md:grid-cols-[180px_1fr] md:gap-10">
            <h2 className="numeral text-5xl font-extrabold leading-none text-ink-3 md:sticky md:top-8 md:self-start">
              {year}
            </h2>
            <ol className="space-y-2">
              {items.map((d) => (
                <li key={d.slug}>
                  <Link
                    href={`/history/${encodeURIComponent(d.slug)}`}
                    className="group grid grid-cols-[56px_1fr] gap-4 rounded-2xl px-4 py-4 -mx-4 transition-colors hover:bg-surface"
                  >
                    <span className="numeral pt-0.5 text-lg font-semibold text-ink-2">{shortDate(d.date)}</span>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold leading-snug tracking-tight group-hover:text-accent">{d.title}</h3>
                      {d.excerpt && <p className="mt-1 line-clamp-2 text-[15px] leading-relaxed text-ink-2">{d.excerpt}</p>}
                      {(d.company || d.tags.length > 0) && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {d.company && (
                            <span className="rounded-full bg-ink px-2.5 py-0.5 text-xs font-medium text-paper">{d.company}</span>
                          )}
                          {d.tags.map((t) => (
                            <span key={t} className="rounded-full bg-sunken px-2.5 py-0.5 text-xs text-ink-2">
                              {t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
