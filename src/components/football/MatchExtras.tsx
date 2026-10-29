import type { FormGame, MatchDetail } from "@/lib/football/detail";

const RES: Record<string, { t: string; c: string }> = {
  W: { t: "승", c: "#0e8a6b" },
  D: { t: "무", c: "#8a94a6" },
  L: { t: "패", c: "#d4483b" },
};

function FormList({ title, games }: { title: string; games: FormGame[] }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2">
        <h3 className="truncate font-bold">{title}</h3>
        <span className="flex gap-0.5">
          {games.map((g, i) =>
            g.result ? (
              <span key={i} className="flex h-5 w-5 items-center justify-center rounded-md text-[10px] font-bold text-white" style={{ background: RES[g.result].c }}>
                {RES[g.result].t}
              </span>
            ) : null,
          )}
        </span>
      </div>
      <ul className="divide-y divide-line-soft rounded-xl border border-line bg-surface text-sm">
        {games.map((g, i) => (
          <li key={i} className="grid grid-cols-[52px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
            <span className="numeral text-xs tabular-nums text-ink-3">{g.date ? `${Number(g.date.slice(5, 7))}.${Number(g.date.slice(8))}` : ""}</span>
            <span className="flex min-w-0 items-center gap-1.5">
              <span className="text-[11px] text-ink-3">{g.home ? "vs" : "@"}</span>
              <span className="truncate">{g.opponent}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="numeral tabular-nums text-ink-2">{g.score}</span>
              {g.result && (
                <span className="text-[11px] font-bold" style={{ color: RES[g.result].c }}>
                  {RES[g.result].t}
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const dur = (s?: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}` : "");

/** ESPN 상세에서만 오는 추가 정보: 최근 5경기 · 상대 전적 · 영상 · 기사 */
export default function MatchExtras({ d }: { d: MatchDetail }) {
  const hasForm = !!(d.form && (d.form.home.length || d.form.away.length));
  return (
    <>
      {hasForm && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">최근 5경기</h2>
          <div className="grid gap-6 md:grid-cols-2">
            {d.form!.home.length > 0 && <FormList title={d.home.name} games={d.form!.home} />}
            {d.form!.away.length > 0 && <FormList title={d.away.name} games={d.form!.away} />}
          </div>
        </section>
      )}

      {d.h2h && d.h2h.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">상대 전적</h2>
          <div className="max-w-xl">
            <FormList title={`${d.home.name} 기준`} games={d.h2h} />
          </div>
        </section>
      )}

      {d.videos && d.videos.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">하이라이트·영상</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {d.videos.map((v) => (
              <li key={v.href}>
                <a href={v.href} target="_blank" rel="noopener noreferrer" className="group block overflow-hidden rounded-xl border border-line bg-surface hover:border-accent">
                  {v.thumb && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={v.thumb} alt="" loading="lazy" className="aspect-video w-full object-cover" />
                  )}
                  <div className="flex items-start gap-2 p-3">
                    <span className="line-clamp-2 flex-1 text-sm font-semibold leading-snug group-hover:text-accent">{v.title}</span>
                    {v.duration ? <span className="shrink-0 text-xs tabular-nums text-ink-3">{dur(v.duration)}</span> : null}
                  </div>
                </a>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">ESPN 영상이라 영어예요. 새 창으로 열려요.</p>
        </section>
      )}

      {d.news && d.news.length > 0 && (
        <section>
          <h2 className="mb-4 text-xl font-bold tracking-tight">관련 기사</h2>
          <ul className="space-y-1.5 text-sm">
            {d.news.map((n) => (
              <li key={n.href}>
                <a href={n.href} target="_blank" rel="noopener noreferrer" className="hover:text-accent">
                  {n.title} <span className="text-ink-3">↗</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
