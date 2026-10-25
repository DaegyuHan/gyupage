"use client";

import { useEffect, useState } from "react";
import type { MapleSummary } from "@/lib/games/maple";

const MAPLE = "#f68b1f";

/** 1234567890 → "12억 3,456만" */
function korNum(n: number) {
  const eok = Math.floor(n / 1e8);
  const man = Math.floor((n % 1e8) / 1e4);
  if (eok > 0) return `${eok.toLocaleString()}억${man ? ` ${man.toLocaleString()}만` : ""}`;
  if (man > 0) return `${man.toLocaleString()}만`;
  return n.toLocaleString();
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 rounded-xl bg-sunken/60 px-3 py-2.5">
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className="numeral mt-0.5 truncate text-[17px] font-extrabold tabular-nums">{value}</div>
      {sub && <div className="truncate text-[10px] text-ink-3">{sub}</div>}
    </div>
  );
}

function ExpChart({ days }: { days: MapleSummary["history"] }) {
  const max = Math.max(1, ...days.map((d) => d.gain ?? 0));
  const total = days.reduce((s, d) => s + (d.gain ?? 0), 0);
  const WEEK = ["일", "월", "화", "수", "목", "금", "토"];
  return (
    <div>
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="text-[11px] font-bold text-ink-2">최근 7일 경험치</h3>
        <span className="text-[11px] text-ink-3">
          합계 <b className="numeral text-ink-2">+{total.toFixed(2)}%</b>
        </span>
      </div>
      <div className="relative grid h-[120px] grid-cols-7 items-end gap-2">
        {total === 0 && (
          <span className="absolute inset-x-0 top-6 text-center text-[11px] text-ink-3">이번 주는 경험치 변화가 없어요</span>
        )}
        {days.map((d, i) => {
          const today = i === days.length - 1;
          const g = d.gain ?? 0;
          const dow = WEEK[new Date(`${d.date}T12:00:00+09:00`).getUTCDay()];
          return (
            <div key={d.date} className="flex h-full flex-col items-center justify-end gap-1" title={`${d.date} · Lv.${d.level} ${d.rate.toFixed(3)}%`}>
              <span className={`numeral text-[10px] tabular-nums ${g > 0 ? "font-bold text-ink-2" : "text-ink-3"}`}>{g > 0 ? `+${g.toFixed(1)}` : "–"}</span>
              <span
                className="w-full max-w-[28px] rounded-t-md transition-[height]"
                style={{
                  height: `${Math.max(3, (g / max) * 72)}px`,
                  background: g > 0 ? (today ? MAPLE : `color-mix(in oklab, ${MAPLE} 45%, var(--color-sunken))`) : "var(--color-sunken)",
                }}
              />
              <span className={`text-[10px] ${today ? "font-bold" : "text-ink-3"}`} style={today ? { color: MAPLE } : undefined}>
                {today ? "오늘" : dow}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Setup() {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-sm leading-relaxed text-ink-2">
      <p className="font-bold text-ink">메이플스토리 연결 준비</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          <a href="https://openapi.nexon.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            넥슨 Open API
          </a>
          에서 애플리케이션을 만들고 API 키를 받아요.
        </li>
        <li>
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">.env.local</code> 에{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">NEXON_API_KEY</code> 와{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">MAPLE_CHARACTER</code>(캐릭터 이름)를 넣어요.
        </li>
        <li>개발 서버를 다시 켜면 여기에 캐릭터가 나와요.</li>
      </ol>
    </div>
  );
}

/** 메이플스토리 탭: 캐릭터 정보 + 최근 7일 경험치 */
export default function MaplePanel() {
  const [data, setData] = useState<MapleSummary | null>(null);
  const [setup, setSetup] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/maple")
      .then(async (r) => {
        const j = await r.json();
        if (j.setup) setSetup(true);
        else if (!r.ok) setFailed(j.detail ?? j.error ?? "불러오지 못했어요.");
        else setData(j as MapleSummary);
      })
      .catch(() => setFailed("불러오지 못했어요."));
  }, []);

  if (setup) return <Setup />;
  if (failed) return <p className="py-6 text-sm text-ink-3">메이플스토리 정보를 불러오지 못했어요. ({failed})</p>;
  if (!data) return <div className="h-[220px] rounded-2xl bg-sunken/70" aria-busy="true" />;

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.9fr)]">
      <div className="flex min-w-0 gap-5">
        {/* 캐릭터 */}
        <div
          className="relative flex h-[132px] w-[116px] shrink-0 items-end justify-center overflow-hidden rounded-2xl"
          style={{ background: `linear-gradient(160deg, color-mix(in oklab, ${MAPLE} 22%, var(--color-surface)), var(--color-sunken))` }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {/* 원본은 300×300 캔버스 가운데에 작은 캐릭터라, 크게 키워서 가운데만 보여줌 */}
          <img
            src={data.image}
            alt={data.name}
            width={300}
            height={300}
            className="pointer-events-none absolute left-1/2 top-1/2 h-[330px] w-[330px] max-w-none -translate-x-1/2 -translate-y-[57%] [image-rendering:pixelated]"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-3">
            <span className="rounded-full px-2 py-0.5 font-bold" style={{ color: MAPLE, background: `color-mix(in oklab, ${MAPLE} 14%, var(--color-surface))` }}>
              {data.world}
            </span>
            <span>
              {data.job} · {data.jobLevel}차
            </span>
            {data.guild && <span>· 길드 {data.guild}</span>}
          </div>
          <div className="mt-1.5 flex items-baseline gap-2">
            <h3 className="truncate text-2xl font-extrabold tracking-tight">{data.name}</h3>
            <span className="numeral shrink-0 text-lg font-extrabold" style={{ color: MAPLE }}>
              Lv.{data.level}
            </span>
          </div>
          <div className="mt-2.5">
            <div className="flex justify-between text-[11px] text-ink-3">
              <span>경험치</span>
              <span className="numeral font-bold tabular-nums text-ink-2">{data.expRate.toFixed(3)}%</span>
            </div>
            <div className="mt-1 h-2 overflow-hidden rounded-full bg-sunken">
              <div className="h-full rounded-full" style={{ width: `${Math.min(100, data.expRate)}%`, background: `linear-gradient(90deg, #ffd34d, ${MAPLE})` }} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="전투력" value={data.combatPower != null ? korNum(data.combatPower) : "–"} />
            <Stat label="유니온" value={data.unionLevel != null ? data.unionLevel.toLocaleString() : "–"} sub={data.unionGrade ?? undefined} />
            <Stat label="무릉도장" value={data.dojang != null ? `${data.dojang}층` : "–"} />
            <Stat label="인기도" value={data.popularity != null ? data.popularity.toLocaleString() : "–"} />
          </div>
        </div>
      </div>

      <div className="min-w-0 lg:border-l lg:border-line-soft lg:pl-8">
        <ExpChart days={data.history} />
      </div>
    </div>
  );
}
