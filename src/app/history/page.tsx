import Link from "next/link";
import { groupByYear, HISTORY_KINDS, type HistoryKind } from "@/lib/history";
import { getAllHistoryMerged } from "@/lib/server/historyDb";

export const metadata = { title: "히스토리 | 규페이지" };

// 설정에서 올린 문서(DB)도 바로 보이게 요청마다 그림
export const dynamic = "force-dynamic";

function shortDate(date: string) {
  if (!date) return "";
  const [, m, d] = date.split("-");
  return d ? `${Number(m)}.${Number(d)}` : `${Number(m)}월`;
}

const DESC: Record<HistoryKind, string> = {
  company: "회사에서 해온 일들을 한 줄로 모아 봤어요.",
  etc: "회사 밖에서 해 온 일들 — 개인 프로젝트, 공부, 대외 활동을 모아 봤어요.",
};

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const kind: HistoryKind = tab === "etc" ? "etc" : "company";
  const all = await getAllHistoryMerged();
  const count = (k: HistoryKind) => all.filter((d) => d.kind === k).length;
  const docs = all.filter((d) => d.kind === kind);
  const groups = groupByYear(docs);
  const companies = [...new Set(docs.map((d) => d.company).filter(Boolean))] as string[];

  return (
    <div className="mx-auto max-w-5xl">
      <header className="grid gap-6 border-b border-line pb-8 pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">히스토리</h1>
          <p className="mt-3 max-w-xl text-ink-2">
            {DESC[kind]} <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">content/history</code>{" "}
            폴더에 넣거나{" "}
            <Link href="/settings#history" className="font-semibold text-accent hover:underline">
              설정
            </Link>
            에서 md 파일을 끌어다 놓으면 날짜순으로 자동 정리돼요.
          </p>
        </div>
        <div className="flex gap-8">
          <div>
            <div className="numeral text-4xl font-extrabold">{docs.length}</div>
            <div className="text-sm text-ink-2">기록</div>
          </div>
          {kind === "company" && companies.length > 0 && (
            <div>
              <div className="numeral text-4xl font-extrabold">{companies.length}</div>
              <div className="text-sm text-ink-2">회사</div>
            </div>
          )}
        </div>
      </header>

      {/* 회사 / 기타 */}
      <nav className="mt-6 flex gap-1.5" aria-label="히스토리 구분">
        {HISTORY_KINDS.map((k) => {
          const on = k.id === kind;
          return (
            <Link
              key={k.id}
              href={k.id === "company" ? "/history" : "/history?tab=etc"}
              aria-current={on ? "page" : undefined}
              className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${
                on ? "border-transparent bg-ink text-paper" : "border-line text-ink-2 hover:border-ink-3 hover:text-ink"
              }`}
            >
              {k.label}
              <span className={`numeral text-xs ${on ? "text-paper/70" : "text-ink-3"}`}>{count(k.id)}</span>
            </Link>
          );
        })}
      </nav>

      {docs.length === 0 && (
        <p className="py-16 text-center text-ink-2">
          아직 {kind === "etc" ? "기타" : "회사"} 기록이 없어요.{" "}
          <Link href="/settings#history" className="font-semibold text-accent hover:underline">
            설정에서 md 파일을 올려
          </Link>{" "}
          첫 기록을 남겨 보세요.
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
