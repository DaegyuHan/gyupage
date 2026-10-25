import type { Scorer } from "@/lib/football/standings";
import { Crest } from "./icons";

export default function TopScorers({ list }: { list: Scorer[] }) {
  if (list.length === 0) return <p className="py-6 text-sm text-ink-3">득점 기록이 아직 없어요.</p>;
  const [first, ...rest] = list;

  return (
    <div>
      {/* 1위는 크게 */}
      <div className="mb-3 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
        {first.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={first.photo} alt="" width={56} height={56} className="h-14 w-14 rounded-full bg-sunken object-cover" />
        ) : (
          <span className="h-14 w-14 rounded-full bg-sunken" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold leading-tight">{first.name}</div>
          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
            <Crest src={first.teamLogo} size={14} />
            <span className="truncate">{first.team}</span>
          </div>
        </div>
        <div className="text-right">
          <div className="numeral text-4xl font-extrabold leading-none">{first.goals}</div>
          <div className="mt-1 text-[11px] text-ink-3">도움 {first.assists}</div>
        </div>
      </div>

      <ol className="divide-y divide-line-soft">
        {rest.map((p) => (
          <li key={`${p.rank}-${p.name}`} className="flex items-center gap-3 py-2 text-sm">
            <span className="numeral w-5 text-right text-xs font-semibold text-ink-3">{p.rank}</span>
            <Crest src={p.teamLogo} size={18} />
            <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
            <span className="text-[11px] text-ink-3">도움 {p.assists}</span>
            <span className="numeral w-7 text-right text-base font-extrabold">{p.goals}</span>
          </li>
        ))}
      </ol>

    </div>
  );
}
