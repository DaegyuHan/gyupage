import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import Absences from "@/components/football/Absences";
import AutoRefresh from "@/components/football/AutoRefresh";
import Lineups from "@/components/football/Lineups";
import Scoreboard from "@/components/football/Scoreboard";
import StatBars from "@/components/football/StatBars";
import Tabs from "@/components/football/Tabs";
import Timeline from "@/components/football/Timeline";
import { getMatchDetail, type MatchDetail } from "@/lib/football/detail";
import { getEspnDetail } from "@/lib/football/espnDetail";
import MatchExtras from "@/components/football/MatchExtras";
import { kickoffLabel, roundLabel } from "@/lib/football/format";
import { LEAGUE_MAP } from "@/lib/football/leagues";

type Params = { params: Promise<{ id: string }> };

// 메타데이터와 본문이 같은 요청에서 두 번 부르지 않도록 요청 단위로 묶음
const load = cache(async (idText: string): Promise<{ d: MatchDetail | null; error?: string }> => {
  // ESPN 해외 경기: /football/match/espn-PL-401921834
  if (idText.startsWith("espn-")) {
    try {
      return { d: await getEspnDetail(idText) };
    } catch {
      return { d: null, error: "경기 정보를 불러오지 못했어요." };
    }
  }
  const id = Number(idText);
  if (!Number.isInteger(id) || id <= 0) return { d: null };
  try {
    return { d: await getMatchDetail(id) };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { d: null, error: msg === "NO_KEY" ? "API 키가 없어서 경기 상세를 볼 수 없어요." : "경기 정보를 불러오지 못했어요." };
  }
});

export async function generateMetadata({ params }: Params) {
  const { id } = await params;
  const { d } = await load(id);
  return { title: d ? `${d.home.name} vs ${d.away.name} | 규페이지` : "경기 | 규페이지" };
}

function Info({ d }: { d: MatchDetail }) {
  const rows = [
    ["대회", `${LEAGUE_MAP[d.league].name}${roundLabel(d.round) ? ` ${roundLabel(d.round)}` : ""}`],
    ["킥오프", kickoffLabel(d.kickoff)],
    ["경기장", d.venue],
    ["주심", d.referee?.replace(/,.*$/, "")],
    ["관중", d.attendance ? `${d.attendance.toLocaleString("ko-KR")}명` : undefined],
    ["중계", d.broadcast],
    ["데이터", d.source === "ESPN" ? "ESPN" : undefined],
  ].filter((r): r is [string, string] => !!r[1]);
  return (
    <dl className="grid grid-cols-[72px_1fr] gap-x-4 gap-y-2 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-ink-2">{k}</dt>
          <dd className="font-medium">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

export default async function MatchPage({ params }: Params) {
  const { id } = await params;
  const { d, error } = await load(id);

  if (!d && !error) notFound();

  return (
    <div className="mx-auto max-w-6xl pt-6">
      <Link
        href={d && LEAGUE_MAP[d.league].tab !== false ? `/football?league=${d.league}` : "/football"}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-2 hover:text-ink"
      >
        <svg width="8" height="12" viewBox="0 0 8 12" aria-hidden>
          <path d="M6.5 1 1.5 6l5 5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {d && LEAGUE_MAP[d.league].tab !== false ? `${LEAGUE_MAP[d.league].name} 순위` : "축구"}
      </Link>

      {!d ? (
        <p className="py-24 text-center text-ink-2">{error}</p>
      ) : (
        <div className="mt-5 space-y-10">
          <Scoreboard d={d} />

          {d.status === "live" && <AutoRefresh seconds={300} />}

          {d.status === "scheduled" || d.status === "postponed" ? (
            <>
              {d.source !== "ESPN" && (
              <section>
                <div className="mb-4 flex items-baseline justify-between gap-4">
                  <h2 className="text-xl font-bold tracking-tight">결장 예정 선수</h2>
                  <span className="text-xs text-ink-3">부상·출전 정지·출전 불확실</span>
                </div>
                <Absences d={d} />
              </section>
              )}

              <section>
                <h2 className="mb-4 text-xl font-bold tracking-tight">라인업</h2>
                <Lineups d={d} />
              </section>

              <MatchExtras d={d} />
              <section className="border-t border-line pt-6">
                <h2 className="mb-4 text-xl font-bold tracking-tight">경기 정보</h2>
                <Info d={d} />
              </section>
            </>
          ) : (
            <>
              <Tabs
                items={[
                  { key: "timeline", label: "경기 흐름", content: <Timeline d={d} /> },
                  { key: "stats", label: "통계", content: <StatBars d={d} /> },
                  { key: "lineups", label: "라인업", content: <Lineups d={d} /> },
                ]}
              />
              <MatchExtras d={d} />
              <section className="border-t border-line pt-6">
                <h2 className="mb-4 text-xl font-bold tracking-tight">경기 정보</h2>
                <Info d={d} />
              </section>
              {d.status === "live" && (
                <p className="text-xs text-ink-3">진행 중인 경기는 5분마다 자동으로 새로 고쳐져요.</p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
