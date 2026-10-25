"use client";

import { useEffect, useState } from "react";
import type { F1Race, F1Response, F1Results } from "@/lib/f1";

const FMT = new Intl.DateTimeFormat("ko-KR", {
  timeZone: "Asia/Seoul",
  month: "numeric",
  day: "numeric",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** "10월 26일 (월) 05:00" */
function when(iso: string) {
  const p = Object.fromEntries(FMT.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.month}월 ${p.day}일 (${p.weekday}) ${p.hour}:${p.minute}`;
}

function dday(iso: string, now: number) {
  const kst = (t: number) => new Date(t + 9 * 3600_000).toISOString().slice(0, 10);
  const diff = Math.round((Date.parse(kst(Date.parse(iso))) - Date.parse(kst(now))) / 86_400_000);
  return diff <= 0 ? "D-DAY" : `D-${diff}`;
}

const RACE_LEN = 2.5 * 60 * 60 * 1000;
const F1_RED = "#e10600";

function Flag() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path d="M3 2v15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <rect x="4" y="2.5" width="11" height="8" rx="1" fill="#fff" stroke="currentColor" strokeWidth="1" />
      {[0, 1, 2, 3].map((c) =>
        [0, 1].map((r) =>
          (c + r) % 2 === 0 ? <rect key={`${c}-${r}`} x={4 + c * 2.75} y={2.5 + r * 4} width="2.75" height="4" fill="currentColor" /> : null,
        ),
      )}
    </svg>
  );
}

function Header({ r, now }: { r: F1Race; now: number }) {
  const start = Date.parse(r.raceStart);
  const live = now >= start && now < start + RACE_LEN;
  const done = now >= start + RACE_LEN;
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <div className="text-xs text-ink-3">{r.round}라운드</div>
        <div className="truncate text-lg font-bold leading-snug tracking-tight">{r.name}</div>
        <div className="truncate text-sm text-ink-2">{r.place}</div>
      </div>
      {live ? (
        <span className="shrink-0 rounded-full px-2.5 py-1 text-xs font-bold" style={{ color: F1_RED, background: `${F1_RED}1a` }}>
          결승 진행 중
        </span>
      ) : done ? (
        <span className="shrink-0 rounded-full bg-sunken px-2.5 py-1 text-xs font-semibold text-ink-2">결승 종료</span>
      ) : (
        <span className="numeral shrink-0 text-2xl font-extrabold">{dday(r.raceStart, now)}</span>
      )}
    </div>
  );
}

function Schedule({ r, now }: { r: F1Race; now: number }) {
  const shown = r.sessions.filter((s) => ["sprintQuali", "sprint", "quali", "race"].includes(s.key));
  return (
    <ul className="mt-3 divide-y divide-line-soft text-sm">
      {shown.map((s) => {
        const past = Date.parse(s.start) + (s.key === "race" ? RACE_LEN : 60 * 60 * 1000) < now;
        return (
          <li key={s.key} className={`flex items-center justify-between py-1.5 ${past ? "text-ink-3" : ""}`}>
            <span className={s.key === "race" && !past ? "font-bold" : ""}>{s.label}</span>
            <span className={`tabular-nums ${s.key === "race" && !past ? "font-bold" : ""}`}>{when(s.start)}</span>
          </li>
        );
      })}
    </ul>
  );
}

function ResultTable({ res }: { res: F1Results }) {
  const [all, setAll] = useState(false);
  const rows = all ? res.rows : res.rows.slice(0, 10);
  const winner = res.rows[0];

  return (
    <div>
      {/* 1위 강조 */}
      {winner && (
        <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2.5" style={{ background: `color-mix(in oklab, ${winner.color} 12%, var(--color-surface))` }}>
          <span className="numeral text-2xl font-extrabold leading-none">1</span>
          <span className="h-8 w-1 rounded-full" style={{ background: winner.color }} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold leading-tight">
              {winner.name} <span className="text-xs font-semibold text-ink-2">{winner.code}</span>
            </div>
            <div className="truncate text-xs text-ink-2">{winner.team}</div>
          </div>
          <div className="text-right">
            <div className="text-[10px] font-semibold text-ink-3">{res.key === "quali" ? "폴 포지션" : "우승"}</div>
            <div className="numeral text-sm font-bold tabular-nums">{winner.time}</div>
          </div>
        </div>
      )}

      <ol className="text-[13px]">
        {rows.slice(1).map((r) => (
          <li key={r.code} className="flex items-center gap-2.5 py-1">
            <span className={`numeral w-5 text-right font-semibold ${r.pos !== null && r.pos <= 3 ? "text-ink" : "text-ink-3"}`}>
              {r.pos ?? "-"}
            </span>
            <span className="h-3.5 w-[3px] rounded-full" style={{ background: r.color }} />
            <span className="w-9 font-bold">{r.code}</span>
            <span className="min-w-0 flex-1 truncate text-ink-2">{r.team}</span>
            <span className={`tabular-nums ${r.note ? "text-[#c92a2a]" : "text-ink-2"}`}>{r.note ?? r.time}</span>
          </li>
        ))}
      </ol>

      {res.rows.length > 10 && (
        <button onClick={() => setAll((v) => !v)} className="mt-1 text-xs font-medium text-ink-2 hover:text-ink">
          {all ? "10위까지만 보기" : `전체 ${res.rows.length}명 보기`}
        </button>
      )}
    </div>
  );
}

function Results({ list }: { list: F1Results[] }) {
  const [active, setActive] = useState(list[0]?.key);
  const cur = list.find((r) => r.key === active) ?? list[0];
  if (!cur) return null;
  return (
    <div className="mt-4 border-t border-line-soft pt-3">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-xs font-bold text-ink-2">결과</span>
        <div className="flex rounded-full bg-sunken p-0.5 text-xs font-medium" role="tablist">
          {list.map((r) => (
            <button
              key={r.key}
              role="tab"
              aria-selected={r.key === cur.key}
              onClick={() => setActive(r.key)}
              className={`rounded-full px-3 py-1 ${r.key === cur.key ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,28,43,0.08)]" : "text-ink-2"}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>
      <ResultTable key={cur.key} res={cur} />
    </div>
  );
}

export default function F1Card() {
  const [data, setData] = useState<F1Response | null>(null);
  const [failed, setFailed] = useState(false);
  const now = Date.now();

  useEffect(() => {
    fetch("/api/f1")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then(setData)
      .catch(() => setFailed(true));
  }, []);

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <span style={{ color: F1_RED }}>
          <Flag />
        </span>
        <h2 className="font-bold">F1</h2>
        {data && <span className="ml-auto text-xs text-ink-3">{data.season} 시즌 · 한국 시간</span>}
      </div>

      {failed && <p className="text-sm text-ink-3">F1 일정을 불러오지 못했어요.</p>}
      {!data && !failed && <div className="h-24 rounded-xl bg-sunken/70" aria-busy="true" />}

      {data && (
        <div className="space-y-4">
          {data.current ? (
            <div className="rounded-2xl border border-line bg-surface p-4">
              <Header r={data.current} now={now} />
              <Schedule r={data.current} now={now} />
              {data.current.results.length > 0 && <Results list={data.current.results} />}
            </div>
          ) : (
            data.next && (
              <div className="rounded-2xl border border-line bg-surface p-4">
                <Header r={data.next} now={now} />
                <Schedule r={data.next} now={now} />
              </div>
            )
          )}

          {data.current && data.next && (
            <p className="px-1 text-sm text-ink-2">
              다음 <span className="font-semibold text-ink">{data.next.name}</span> · {data.next.place} · {when(data.next.raceStart)}
            </p>
          )}

          {data.standings.length > 0 && (
            <div className="px-1">
              <h3 className="mb-1.5 text-xs font-bold text-ink-2">드라이버 챔피언십</h3>
              <ol className="text-[13px]">
                {data.standings.slice(0, 3).map((s) => (
                  <li key={s.pos} className="flex items-center gap-2.5 py-1">
                    <span className="numeral w-4 text-right font-semibold text-ink-3">{s.pos}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{s.name}</span>
                    <span className="truncate text-xs text-ink-3">{s.team}</span>
                    <span className="numeral w-10 text-right font-bold">{s.points}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {!data.current && !data.next && <p className="text-sm text-ink-3">이번 시즌 남은 경기가 없어요.</p>}
        </div>
      )}
    </section>
  );
}
