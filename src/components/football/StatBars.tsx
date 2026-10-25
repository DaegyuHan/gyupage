import type { MatchDetail } from "@/lib/football/detail";
import { Crest } from "./icons";

export const HOME_COLOR = "var(--color-accent)";
export const AWAY_COLOR = "#e07a2f";

export default function StatBars({ d }: { d: MatchDetail }) {
  if (d.stats.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-3">경기 통계가 아직 없어요.</p>;
  }
  const possession = d.stats.find((s) => s.label === "점유율");
  const rest = d.stats.filter((s) => s !== possession);

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6 flex items-center justify-between text-sm font-semibold">
        <span className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: HOME_COLOR }} />
          <Crest src={d.home.logo} size={18} />
          {d.home.name}
        </span>
        <span className="flex items-center gap-2">
          {d.away.name}
          <Crest src={d.away.logo} size={18} />
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: AWAY_COLOR }} />
        </span>
      </div>

      {possession && (
        <div className="mb-8">
          <div className="mb-2 flex items-end justify-between">
            <span className="numeral text-3xl font-extrabold">{possession.home}%</span>
            <span className="text-sm font-medium text-ink-2">점유율</span>
            <span className="numeral text-3xl font-extrabold">{possession.away}%</span>
          </div>
          <div className="flex h-3 gap-1 overflow-hidden rounded-full">
            <div className="rounded-l-full" style={{ width: `${possession.home}%`, background: HOME_COLOR }} />
            <div className="flex-1 rounded-r-full" style={{ background: AWAY_COLOR }} />
          </div>
        </div>
      )}

      <ul className="space-y-5">
        {rest.map((s) => {
          const total = s.home + s.away;
          const hp = total ? (s.home / total) * 100 : 0;
          const ap = total ? (s.away / total) * 100 : 0;
          const hLead = s.home > s.away;
          const aLead = s.away > s.home;
          return (
            <li key={s.label}>
              <div className="mb-1.5 flex items-baseline justify-between text-sm">
                <span className={`numeral w-14 tabular-nums ${hLead ? "font-extrabold" : "text-ink-2"}`}>{s.homeText}</span>
                <span className="text-ink-2">{s.label}</span>
                <span className={`numeral w-14 text-right tabular-nums ${aLead ? "font-extrabold" : "text-ink-2"}`}>{s.awayText}</span>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex h-1.5 justify-end overflow-hidden rounded-l-full bg-sunken">
                  <div
                    className="h-full rounded-l-full"
                    style={{ width: `${hp}%`, background: HOME_COLOR, opacity: hLead ? 1 : 0.4 }}
                  />
                </div>
                <div className="flex h-1.5 overflow-hidden rounded-r-full bg-sunken">
                  <div
                    className="h-full rounded-r-full"
                    style={{ width: `${ap}%`, background: AWAY_COLOR, opacity: aLead ? 1 : 0.4 }}
                  />
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
