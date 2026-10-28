import Link from "next/link";
import { NewProjectButton, ProjectActions } from "@/components/history/ProjectTools";
import { groupByYear, HISTORY_KINDS, renderMarkdown, type HistoryDoc, type HistoryKind } from "@/lib/history";
import { getAllHistoryMerged } from "@/lib/server/historyDb";
import { listProjects, type HistoryProject } from "@/lib/server/historyProjects";

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

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

/** 프로젝트 하나: 설정에서 올린 최신 md 를 그대로 */
function ProjectView({ project, doc }: { project: HistoryProject; doc: HistoryDoc | null }) {
  const rendered = doc ? renderMarkdown(doc.content) : null;
  return (
    <div className="pb-16 pt-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{project.name}</h2>
          {doc && (
            <p className="mt-2 text-sm text-ink-2">
              {doc.title !== project.name && <span className="font-semibold text-ink">{doc.title}</span>}
              {doc.title !== project.name && " · "}
              {project.updatedAt && `${ago(project.updatedAt)} 업데이트`}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Link href="/settings#history" className="rounded-full border border-line px-3.5 py-1.5 text-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink">
            새 버전 올리기
          </Link>
          <ProjectActions id={project.id} name={project.name} />
        </div>
      </div>

      {!rendered ? (
        <p className="py-16 text-center text-ink-2">
          아직 문서가 없어요.{" "}
          <Link href="/settings#history" className="font-semibold text-accent hover:underline">
            설정에서 이 프로젝트를 고르고 md 파일을 올려
          </Link>{" "}
          보세요.
        </p>
      ) : (
        <div className="mt-10 grid gap-12 lg:grid-cols-[minmax(0,1fr)_220px]">
          <article
            className="prose prose-lg max-w-[68ch] text-ink prose-headings:tracking-tight prose-headings:text-ink prose-h2:mt-12 prose-h2:text-2xl prose-h3:text-xl prose-p:text-ink prose-p:leading-[1.8] prose-a:text-accent prose-strong:text-ink prose-li:text-ink prose-li:marker:text-ink-3 prose-blockquote:border-l-accent prose-blockquote:font-normal prose-blockquote:not-italic prose-blockquote:text-ink-2 prose-code:rounded prose-code:bg-sunken prose-code:px-1.5 prose-code:py-0.5 prose-code:font-medium prose-code:text-ink prose-code:before:content-none prose-code:after:content-none prose-pre:rounded-xl prose-pre:bg-ink prose-pre:text-paper prose-th:text-ink prose-td:text-ink prose-hr:border-line"
            dangerouslySetInnerHTML={{ __html: rendered.html }}
          />
          {rendered.headings.length > 0 && (
            <aside className="hidden lg:block">
              <nav className="sticky top-8 text-sm" aria-label="목차">
                <div className="mb-3 font-bold">목차</div>
                <ul className="space-y-2 border-l border-line">
                  {rendered.headings.map((h) => (
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
      )}
    </div>
  );
}

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ tab?: string; project?: string }> }) {
  const { tab, project: projectParam } = await searchParams;
  const kind: HistoryKind = tab === "etc" ? "etc" : "company";
  const [all, projects] = await Promise.all([getAllHistoryMerged(), kind === "company" ? listProjects("company").catch(() => []) : Promise.resolve([])]);
  const project = projects.find((p) => p.id === projectParam) ?? null;
  const projectName = new Map(projects.map((p) => [p.id, p.name]));
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

      {/* 회사 안의 세부 프로젝트 */}
      {kind === "company" && (
        <nav className="mt-4 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-4" aria-label="프로젝트">
          <span className="mr-1 text-xs font-semibold text-ink-3">프로젝트</span>
          <Link
            href="/history"
            aria-current={!project ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${!project ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink"}`}
          >
            전체 기록
          </Link>
          {projects.map((p) => {
            const on = p.id === project?.id;
            return (
              <Link
                key={p.id}
                href={`/history?project=${p.id}`}
                aria-current={on ? "page" : undefined}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${on ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-sunken hover:text-ink"}`}
              >
                {p.name}
                {!p.docSlug && <span className={`text-[10px] ${on ? "text-accent/70" : "text-ink-3"}`}>비어 있음</span>}
              </Link>
            );
          })}
          <NewProjectButton />
        </nav>
      )}

      {project && <ProjectView project={project} doc={docs.find((d) => d.slug === project.docSlug) ?? null} />}

      {!project && docs.length === 0 && (
        <p className="py-16 text-center text-ink-2">
          아직 {kind === "etc" ? "기타" : "회사"} 기록이 없어요.{" "}
          <Link href="/settings#history" className="font-semibold text-accent hover:underline">
            설정에서 md 파일을 올려
          </Link>{" "}
          첫 기록을 남겨 보세요.
        </p>
      )}

      <div className={project ? "hidden" : ""}>
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
                      {(d.company || d.tags.length > 0 || (d.projectId && projectName.has(d.projectId))) && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {d.projectId && projectName.has(d.projectId) && (
                            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent">{projectName.get(d.projectId)}</span>
                          )}
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
