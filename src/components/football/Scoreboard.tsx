import type { DetailEvent, MatchDetail, Side } from "@/lib/football/detail";
import { kickoffLabel, minuteText, roundLabel, statusLabel, untilKickoff } from "@/lib/football/format";
import { LEAGUE_MAP } from "@/lib/football/leagues";
import { Crest } from "./icons";

/** 득점자 요약: "Saka 23', 67' (PK)" */
function scorers(events: DetailEvent[], side: Side) {
  const map = new Map<string, string[]>();
  for (const e of events) {
    if (e.side !== side || !["goal", "penalty", "owngoal"].includes(e.kind)) continue;
    const tag = e.kind === "penalty" ? " PK" : e.kind === "owngoal" ? " 자책" : "";
    const list = map.get(e.player) ?? [];
    list.push(minuteText(e.minute, e.extra) + tag);
    map.set(e.player, list);
  }
  return [...map.entries()];
}

function redCards(events: DetailEvent[], side: Side) {
  return events.filter((e) => e.side === side && (e.kind === "red" || e.kind === "secondyellow")).length;
}

export default function Scoreboard({ d }: { d: MatchDetail }) {
  const league = LEAGUE_MAP[d.league];
  const started = d.status === "live" || d.status === "finished";
  const live = d.status === "live";
  const until = d.status === "scheduled" ? untilKickoff(d.kickoff) : undefined;

  const team = (side: Side) => {
    const t = d[side];
    const goals = scorers(d.events, side);
    const reds = redCards(d.events, side);
    return (
      <div className={`flex min-w-0 flex-col items-center gap-3 text-center ${side === "home" ? "" : ""}`}>
        <Crest src={t.logo} size={72} className="drop-shadow-sm" />
        <div className="flex items-center gap-1.5 text-lg font-bold leading-tight tracking-tight sm:text-2xl">
          <span className="break-keep">{t.name}</span>
          {reds > 0 && (
            <span className="inline-flex gap-0.5" aria-label={`퇴장 ${reds}명`}>
              {Array.from({ length: reds }, (_, i) => (
                <span key={i} className="h-4 w-3 rounded-[2px] bg-[#e03a3a]" />
              ))}
            </span>
          )}
        </div>
        {goals.length > 0 && (
          <ul className="space-y-0.5 text-[13px] text-ink-2">
            {goals.map(([name, mins]) => (
              <li key={name}>
                <span className="font-medium text-ink">{name}</span> {mins.join(", ")}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  return (
    <section className="relative overflow-hidden rounded-3xl border border-line bg-surface px-5 pb-8 pt-6 sm:px-10">
      {/* 리그 색 띠 */}
      <div className="absolute inset-x-0 top-0 h-1" style={{ background: league.color }} />

      <p className="text-center text-sm text-ink-2">
        <span className="font-semibold text-ink">{league.name}</span>
        {roundLabel(d.round) && <span className="ml-2">{roundLabel(d.round)}</span>}
      </p>

      <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 sm:gap-8">
        {team("home")}

        <div className="flex min-w-[120px] flex-col items-center pt-3 sm:min-w-[180px]">
          {started ? (
            <div className={`numeral flex items-center gap-3 text-6xl font-extrabold leading-none sm:text-7xl ${live ? "text-[#d4483b]" : ""}`}>
              <span>{d.home.score ?? 0}</span>
              <span className="text-ink-3/60">:</span>
              <span>{d.away.score ?? 0}</span>
            </div>
          ) : (
            <div className="numeral text-5xl font-extrabold leading-none text-ink sm:text-6xl">vs</div>
          )}

          <div className="mt-4 flex flex-col items-center gap-1 text-sm">
            {live ? (
              <span className="flex items-center gap-1.5 rounded-full bg-[#d4483b]/10 px-3 py-1 font-semibold text-[#d4483b]">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4483b] opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#d4483b]" />
                </span>
                {statusLabel(d.statusShort, d.elapsed)}
              </span>
            ) : (
              <span className="rounded-full bg-sunken px-3 py-1 font-semibold text-ink-2">
                {d.status === "scheduled" ? kickoffLabel(d.kickoff) : statusLabel(d.statusShort)}
              </span>
            )}
            {until && <span className="text-xs text-ink-3">킥오프 {until}</span>}
            {d.halftime && started && (
              <span className="text-xs text-ink-3">
                전반 {d.halftime[0]} : {d.halftime[1]}
              </span>
            )}
            {d.penalty && (
              <span className="text-xs font-semibold text-ink-2">
                승부차기 {d.penalty[0]} : {d.penalty[1]}
              </span>
            )}
          </div>
        </div>

        {team("away")}
      </div>
    </section>
  );
}
