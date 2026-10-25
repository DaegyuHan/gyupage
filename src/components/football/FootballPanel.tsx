"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LEAGUES } from "@/lib/football/leagues";
import type { FootballResponse } from "@/lib/football/types";
import MatchRow from "./MatchRow";

type Day = "yesterday" | "today";

function shortDate(key: string) {
  const [, m, d] = key.split("-");
  return `${Number(m)}.${Number(d)}`;
}

export default function FootballPanel() {
  const [data, setData] = useState<FootballResponse | null>(null);
  const [failed, setFailed] = useState(false);
  const [day, setDay] = useState<Day>("today");

  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/football")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: FootballResponse) => {
          if (!alive) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => alive && setFailed(true));
    load();
    // 페이지를 켜둔 동안 5분마다 새로 받아옴 (서버 캐시가 있어 API 한도엔 영향 적음)
    const t = setInterval(load, 5 * 60 * 1000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const matches = data?.days[day] ?? [];
  const groups = LEAGUES.map((l) => ({ league: l, items: matches.filter((m) => m.league === l.id) })).filter(
    (g) => g.items.length > 0,
  );
  const sample = data && (data.sources.domestic === "sample" || data.sources.overseas === "sample");
  const partialError = data && (data.sources.domestic === "error" || data.sources.overseas === "error");

  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <Link href="/football" className="group flex items-center gap-1.5 font-bold">
          축구
          <span className="text-xs font-medium text-ink-3 group-hover:text-ink-2">순위 보기</span>
        </Link>
        <div className="flex rounded-full bg-sunken p-0.5 text-xs font-medium" role="tablist" aria-label="날짜">
          {(["yesterday", "today"] as Day[]).map((d) => (
            <button
              key={d}
              role="tab"
              aria-selected={day === d}
              onClick={() => setDay(d)}
              className={`rounded-full px-3 py-1 transition-colors ${
                day === d ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,28,43,0.08)]" : "text-ink-2 hover:text-ink"
              }`}
            >
              {d === "yesterday" ? "어제" : "오늘"}
              {data && <span className="numeral ml-1 text-ink-3">{shortDate(data.dates[d])}</span>}
            </button>
          ))}
        </div>
      </div>

      {sample && (
        <p className="mb-3 rounded-lg bg-accent-soft px-3 py-2 text-xs leading-relaxed text-ink-2">
          API 키를 넣기 전이라 예시 경기를 보여주고 있어요.
        </p>
      )}

      {!data && !failed && (
        <ul className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-7 rounded-md bg-sunken/70" />
          ))}
        </ul>
      )}

      {failed && <p className="text-sm text-ink-2">경기 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>}

      {data && groups.length === 0 && (
        <p className="py-4 text-sm text-ink-3">
          {day === "today" ? "오늘은 관심 리그 경기가 없어요." : "어제는 관심 리그 경기가 없었어요."}
        </p>
      )}

      <div className="space-y-4">
        {groups.map(({ league, items }) => (
          <div key={league.id}>
            <h3 className="flex items-center gap-2 text-xs font-bold text-ink-2">
              <span className="h-3 w-1 rounded-full" style={{ background: league.color }} />
              {league.name}
              <span className="font-medium text-ink-3">{items.length}</span>
            </h3>
            <ul className="divide-y divide-line-soft">
              {items.map((m) => (
                <MatchRow key={m.id} m={m} />
              ))}
            </ul>
          </div>
        ))}
      </div>

      {data && partialError && (
        <p className="mt-3 text-xs text-ink-3">
          {data.sources.domestic === "error" ? "K리그" : "해외 리그"} 정보를 일부 불러오지 못했어요.
        </p>
      )}
    </section>
  );
}
