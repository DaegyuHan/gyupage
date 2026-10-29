import Link from "next/link";
import type { Standings, StandingRow, Zone } from "@/lib/football/standings";
import type { LeagueId } from "@/lib/football/types";
import { Crest } from "./icons";

export const ZONE_COLOR: Record<Exclude<Zone, null>, string> = {
  top: "#2c4bd4",
  second: "#e07a2f",
  third: "#12a150",
  playoff: "#d9a21b",
  relegation: "#e03a3a",
};

const FORM: Record<"W" | "D" | "L", { t: string; bg: string }> = {
  W: { t: "승", bg: "#12a150" },
  D: { t: "무", bg: "#9aa3b2" },
  L: { t: "패", bg: "#e03a3a" },
};

/** 팀 페이지 주소 (이름은 ESPN 팀 이름 한글화에 씀) */
const teamHref = (league: LeagueId, r: StandingRow) => `/football/team/${league}/${encodeURIComponent(r.teamId)}?name=${encodeURIComponent(r.team)}`;

function Row({ r, highlight, showForm, league }: { r: StandingRow; highlight?: boolean; showForm: boolean; league: LeagueId }) {
  const ppg = r.played ? (r.points / r.played).toFixed(2) : "–";
  return (
    <tr className={`border-t border-line-soft ${highlight ? "bg-accent-soft/50" : ""}`}>
      <td className="relative w-12 py-2.5 pl-4 pr-2">
        {r.zone && <span className="absolute inset-y-1.5 left-0 w-[3px] rounded-r" style={{ background: ZONE_COLOR[r.zone] }} />}
        <span className="flex items-center gap-1">
          <span className="numeral font-semibold">{r.rank}</span>
          {r.rankChange ? (
            <span
              className="text-[9px] font-bold leading-none"
              style={{ color: r.rankChange > 0 ? "#12a150" : "#e03a3a" }}
              title={`지난 라운드보다 ${Math.abs(r.rankChange)}계단 ${r.rankChange > 0 ? "상승" : "하락"}`}
            >
              {r.rankChange > 0 ? "▲" : "▼"}
              {Math.abs(r.rankChange)}
            </span>
          ) : null}
        </span>
      </td>
      <td className="py-2.5 pr-3">
        <Link href={teamHref(league, r)} className="group flex min-w-0 items-center gap-2.5">
          <Crest src={r.logo} size={22} />
          <span className="truncate font-semibold group-hover:text-accent group-hover:underline">{r.team}</span>
        </Link>
      </td>
      <td className="numeral px-2 text-center text-ink-2">{r.played}</td>
      <td className="numeral hidden px-2 text-center text-ink-2 sm:table-cell">{r.win}</td>
      <td className="numeral hidden px-2 text-center text-ink-2 sm:table-cell">{r.draw}</td>
      <td className="numeral hidden px-2 text-center text-ink-2 sm:table-cell">{r.lose}</td>
      <td className="numeral hidden px-2 text-center text-ink-2 md:table-cell">
        {r.gf}:{r.ga}
      </td>
      <td className="numeral px-2 text-center text-ink-2">{r.gd > 0 ? `+${r.gd}` : r.gd}</td>
      <td className="numeral px-2 text-center text-base font-extrabold">{r.points}</td>
      <td className="numeral hidden px-2 text-center text-xs text-ink-3 xl:table-cell" title="경기당 승점">
        {ppg}
      </td>
      {showForm && (
      <td className="hidden py-2.5 pl-2 pr-4 lg:table-cell">
        <span className="flex justify-end gap-1">
          {r.form.map((f, i) => (
            <span
              key={i}
              title={FORM[f].t}
              className={`flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white ${
                i === r.form.length - 1 ? "ring-2 ring-offset-1 ring-offset-surface" : ""
              }`}
              style={{ background: FORM[f].bg, ["--tw-ring-color" as string]: FORM[f].bg } as React.CSSProperties}
            >
              {FORM[f].t}
            </span>
          ))}
        </span>
      </td>
      )}
    </tr>
  );
}

export default function StandingsTable({ s, highlightTeams = [] }: { s: Standings; highlightTeams?: string[] }) {
  const hasChange = s.groups.some((g) => g.rows.some((r) => r.rankChange));
  if (s.groups.length === 0) {
    return <p className="py-16 text-center text-sm text-ink-3">아직 순위표가 없어요. 시즌이 시작되면 나와요.</p>;
  }
  return (
    <div className="space-y-6">
      {s.groups.map((g, gi) => (
        <div key={gi} className="overflow-hidden rounded-2xl border border-line bg-surface">
          {g.name && <div className="border-b border-line px-4 py-2.5 text-sm font-bold">{groupLabel(g.name)}</div>}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-ink-3">
                <th className="py-2.5 pl-4 pr-2 text-left font-medium">순위</th>
                <th className="py-2.5 pr-3 text-left font-medium">팀</th>
                <th className="px-2 font-medium" title="경기 수">경기</th>
                <th className="hidden px-2 font-medium sm:table-cell">승</th>
                <th className="hidden px-2 font-medium sm:table-cell">무</th>
                <th className="hidden px-2 font-medium sm:table-cell">패</th>
                <th className="hidden px-2 font-medium md:table-cell">득실</th>
                <th className="px-2 font-medium" title="골 득실차">득실차</th>
                <th className="px-2 font-medium">승점</th>
                <th className="hidden px-2 font-medium xl:table-cell" title="경기당 승점">
                  경기당
                </th>
                {s.hasForm && <th className="hidden py-2.5 pl-2 pr-4 text-right font-medium lg:table-cell">최근 5경기</th>}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((r) => (
                <Row key={r.teamId} r={r} highlight={highlightTeams.includes(r.teamId)} showForm={s.hasForm} league={s.league} />
              ))}
            </tbody>
          </table>
        </div>
      ))}

      <ul className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-2">
        {s.legend.map((l) => (
          <li key={l.zone} className="flex items-center gap-1.5">
            <span className="h-3 w-[3px] rounded" style={{ background: ZONE_COLOR[l.zone] }} />
            {l.label}
          </li>
        ))}
        {s.hasForm && <li className="hidden text-ink-3 lg:list-item">최근 5경기는 오른쪽이 가장 최근이에요</li>}
        {hasChange && <li className="text-ink-3">▲▼ 지난 라운드 대비 순위 변동</li>}
        <li className="text-ink-3">팀 이름을 누르면 시즌 일정·결과</li>
        <li className="ml-auto text-ink-3">자료: {s.source}</li>
      </ul>
    </div>
  );
}

function groupLabel(name: string) {
  if (/championship round|final round|group a|그룹 ?a/i.test(name)) return "파이널 A";
  if (/relegation round|group b|그룹 ?b/i.test(name)) return "파이널 B";
  return name;
}
