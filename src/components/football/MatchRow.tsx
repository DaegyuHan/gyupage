import Link from "next/link";
import { kickoffTime } from "@/lib/football/format";
import type { Match } from "@/lib/football/types";
import { Crest } from "./icons";

/** 경기 한 줄 — 누르면 상세 (API-Football 경기 · ESPN 해외 경기) */
export default function MatchRow({ m }: { m: Match }) {
  const done = m.status === "finished";
  const live = m.status === "live";
  const hasScore = m.home.score !== null && m.away.score !== null;
  const homeWin = done && hasScore && m.home.score! > m.away.score!;
  const awayWin = done && hasScore && m.away.score! > m.home.score!;
  const detailId = m.id.startsWith("af-") ? m.id.slice(3) : m.id.startsWith("espn-") ? m.id : null;

  const inner = (
    <>
      <span className="tabular-nums">
        {live ? (
          <span className="flex items-center gap-1 font-semibold text-[#d4483b]">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#d4483b] opacity-60 motion-reduce:hidden" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[#d4483b]" />
            </span>
            {m.minute ? `${m.minute}'` : "LIVE"}
          </span>
        ) : done ? (
          <span className="text-ink-3">종료</span>
        ) : m.status === "postponed" ? (
          <span className="text-ink-3">연기</span>
        ) : (
          <span className="text-ink-2">{kickoffTime(m.kickoff)}</span>
        )}
      </span>

      <span className={`flex min-w-0 items-center justify-end gap-1.5 text-right ${homeWin ? "font-bold" : done ? "text-ink-2" : ""}`}>
        <span className="truncate">{m.home.name}</span>
        <Crest src={m.home.crest} />
      </span>

      <span
        className={`numeral rounded-md py-0.5 text-center text-[15px] font-bold ${
          live ? "bg-[#d4483b]/10 text-[#d4483b]" : hasScore ? "bg-sunken" : "text-xs font-medium text-ink-3"
        }`}
      >
        {hasScore ? `${m.home.score} : ${m.away.score}` : "vs"}
      </span>

      <span className={`flex min-w-0 items-center gap-1.5 ${awayWin ? "font-bold" : done ? "text-ink-2" : ""}`}>
        <Crest src={m.away.crest} />
        <span className="truncate">{m.away.name}</span>
      </span>
    </>
  );

  const grid = "grid grid-cols-[46px_minmax(0,1fr)_52px_minmax(0,1fr)] items-center gap-2 py-2 text-[13px]";

  return (
    <li>
      {detailId ? (
        <Link
          href={`/football/match/${detailId}`}
          className={`${grid} -mx-2 rounded-lg px-2 transition-colors hover:bg-sunken/70`}
          aria-label={`${m.home.name} 대 ${m.away.name} 경기 상세`}
        >
          {inner}
        </Link>
      ) : (
        <div className={grid}>{inner}</div>
      )}
    </li>
  );
}
