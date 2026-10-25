import Link from "next/link";
import { notFound } from "next/navigation";
import { getAllHistory, getHistory, renderMarkdown } from "@/lib/history";

export function generateStaticParams() {
  return getAllHistory().map((d) => ({ slug: d.slug }));
}

function decode(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function longDate(date: string) {
  if (!date) return "";
  const [y, m, d] = date.split("-");
  return d ? `${y}년 ${Number(m)}월 ${Number(d)}일` : `${y}년 ${Number(m)}월`;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getHistory(decode(slug));
  return { title: doc ? `${doc.title} | 규페이지` : "히스토리 | 규페이지" };
}

export default async function HistoryDetail({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const doc = getHistory(decode(slug));
  if (!doc) notFound();

  const { html, headings } = renderMarkdown(doc.content);

  return (
    <div className="mx-auto max-w-6xl pt-6">
      <Link href="/history" className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink">
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        히스토리
      </Link>

      <header className="mt-8 max-w-3xl">
        <p className="text-ink-2">
          {longDate(doc.date)}
          {doc.company && <span className="ml-3 font-semibold text-ink">{doc.company}</span>}
        </p>
        <h1 className="mt-2 text-4xl font-extrabold leading-[1.15] tracking-tight sm:text-5xl">{doc.title}</h1>
        {doc.tags.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-1.5">
            {doc.tags.map((t) => (
              <span key={t} className="rounded-full bg-sunken px-3 py-1 text-xs font-medium text-ink-2">
                {t}
              </span>
            ))}
          </div>
        )}
      </header>

      <div className="mt-10 grid gap-12 border-t border-line pt-10 lg:grid-cols-[minmax(0,1fr)_220px]">
        <article
          className="prose prose-lg max-w-[68ch] text-ink prose-headings:tracking-tight prose-headings:text-ink prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-xl prose-p:text-ink prose-p:leading-[1.8] prose-a:text-accent prose-strong:text-ink prose-li:text-ink prose-li:marker:text-ink-3 prose-blockquote:border-l-accent prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-ink-2 prose-code:rounded prose-code:bg-sunken prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:bg-ink prose-pre:text-paper prose-th:text-ink prose-td:text-ink prose-hr:border-line"
          dangerouslySetInnerHTML={{ __html: html }}
        />

        {headings.length > 0 && (
          <aside className="hidden lg:block">
            <nav className="sticky top-8 text-sm" aria-label="목차">
              <div className="mb-3 font-bold">목차</div>
              <ul className="space-y-2 border-l border-line">
                {headings.map((h) => (
                  <li key={h.id} style={{ paddingLeft: h.depth === 3 ? 28 : 14 }}>
                    <a href={`#${h.id}`} className="-ml-px block border-l border-transparent text-ink-2 hover:border-ink hover:text-ink">
                      {h.text}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>
        )}
      </div>
    </div>
  );
}
