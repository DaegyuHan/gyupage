"use client";

import { useCallback, useEffect, useState } from "react";
import { autoKey, COMMUTE, isTopTime, type CommuteBus, type CommuteData, type CommuteKey } from "@/lib/commute";

/** 출퇴근: 오후 2시 전 출근(아주대학교입구 · 광교역), 이후 퇴근(강남역홍우빌딩앞 · 강남역) */
type Mode = "auto" | CommuteKey;

const SBD = "#D4003B"; // 신분당선 색
/** 경기도 노선 유형 색: 직행좌석·광역급행 빨강, 좌석 파랑, 일반 초록, 마을 노랑 */
const busColor = (type: number) => (type === 11 || type === 14 ? "#E5484D" : type === 12 ? "#2563EB" : type === 30 ? "#D9A100" : "#16A34A");

function Countdown({ sec, dim = false }: { sec: number; dim?: boolean }) {
  if (sec < 60)
    return <span className={`font-extrabold ${dim ? "text-sm text-ink-3" : "text-xl"}`}>{sec <= 15 ? "도착" : "곧 도착"}</span>;
  return (
    <span className={`numeral tabular-nums ${dim ? "text-ink-3" : ""}`}>
      <span className={dim ? "text-sm font-semibold" : "text-[26px] font-extrabold leading-none"}>{Math.floor(sec / 60)}</span>
      <span className={`ml-0.5 ${dim ? "text-[11px]" : "text-xs font-semibold text-ink-2"}`}>분</span>
    </span>
  );
}

function Seats({ n }: { n: number | null }) {
  if (n == null) return null;
  return n === 0 ? (
    <span className="rounded-md bg-[#e5484d]/12 px-1.5 py-0.5 text-[10.5px] font-bold text-[#e5484d]">만석</span>
  ) : (
    <span className="rounded-md bg-[#12a150]/12 px-1.5 py-0.5 text-[10.5px] font-bold text-[#12a150]">{n}석</span>
  );
}

const STATUS: Record<string, string> = { NONE: "도착 정보 없음", STOP: "운행 종료", WAIT: "회차지 대기" };

/** 버스 한 줄 */
function BusRow({ b, left, small = false }: { b: CommuteBus; left: (s: number) => number; small?: boolean }) {
  const [a, z] = b.next;
  const reserved = b.route.endsWith("예약");
  return (
    <li className={`flex items-center justify-between gap-3 ${small ? "py-2" : "py-2.5"}`}>
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className={`numeral rounded-lg px-2 text-center font-extrabold text-white ${small ? "min-w-[48px] py-0.5 text-[12px]" : "min-w-[54px] py-1 text-[13px]"}`}
          style={{ background: busColor(b.type) }}
        >
          {b.route.replace("예약", "")}
        </span>
        <div className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-ink-3">
          {reserved && <span className="rounded-md border border-line px-1.5 py-0.5 text-[10.5px] font-bold text-ink-2">예약</span>}
          {a ? (
            <>
              {a.stops != null && <span>{a.stops}정거장 전</span>}
              <Seats n={a.seats} />
            </>
          ) : (
            <span>{STATUS[b.status] ?? "도착 정보 없음"}</span>
          )}
        </div>
      </div>
      <div className="shrink-0 text-right">
        {a ? <Countdown sec={left(a.sec)} dim={small} /> : <span className="text-sm text-ink-3">–</span>}
        {z && !small && (
          <div className="mt-0.5 text-[11px] text-ink-3">
            다음 <Countdown sec={left(z.sec)} dim />
          </div>
        )}
      </div>
    </li>
  );
}

export default function CommuteCard() {
  const [mode, setMode] = useState<Mode>("auto");
  const [data, setData] = useState<CommuteData | null>(null);
  const [failed, setFailed] = useState(false);
  const [, setTick] = useState(0);
  /** 버스 칸을 누르면 같은 정류장 다른 버스도 */
  const [showAll, setShowAll] = useState(false);

  const key: CommuteKey = mode === "auto" ? autoKey() : mode;
  const c = COMMUTE[key];

  const load = useCallback(() => {
    fetch(`/api/commute?mode=${key}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<CommuteData>) : Promise.reject(r.status)))
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [key]);

  // 출퇴근 시간엔 30초, 그 밖엔 3분마다 · 화면을 안 보고 있으면 멈춤
  useEffect(() => {
    setData((d) => (d?.key === key ? d : null));
    load();
    let timer: ReturnType<typeof setTimeout>;
    const next = () => {
      timer = setTimeout(() => {
        if (!document.hidden) load();
        next();
      }, isTopTime() ? 30_000 : 180_000);
    };
    next();
    const onVis = () => !document.hidden && load();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [load, key]);

  // 1초마다 남은 시간 줄이기
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const passed = data ? Math.floor((Date.now() - data.fetchedAt) / 1000) : 0;
  const left = (s: number) => Math.max(0, s - passed);

  // 지금 가장 빨리 오는 것
  const cands = [
    ...(data?.bus.buses ?? []).filter((b) => b.next[0]).map((b) => ({ label: `${b.route.replace("예약", " 예약")}번 버스`, sec: b.next[0].sec, color: busColor(b.type) })),
    ...(data?.subway.trains ?? []).filter((t) => t.sec != null).slice(0, 1).map((t) => ({ label: `신분당선 ${t.to}행`, sec: t.sec!, color: SBD })),
  ].sort((a, b) => a.sec - b.sec);
  const best = cands[0];

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-2xl font-extrabold tracking-tight">{c.title}</h2>
        <div className="flex rounded-full bg-sunken p-0.5 text-xs font-semibold" role="tablist" aria-label="출퇴근 모드">
          {(
            [
              ["auto", "자동"],
              ["am", "출근"],
              ["pm", "퇴근"],
            ] as const
          ).map(([m, l]) => (
            <button
              key={m}
              role="tab"
              aria-selected={mode === m}
              onClick={() => setMode(m)}
              className={`rounded-full px-3 py-1.5 transition-colors ${mode === m ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink"}`}
            >
              {l}
            </button>
          ))}
        </div>
      </div>

      {failed && !data && <p className="text-sm text-ink-3">도착 정보를 불러오지 못했어요.</p>}
      {!data && !failed && <div className="h-56 animate-pulse rounded-2xl bg-sunken/70" aria-busy="true" />}

      {data && (
        <>
          {best && (
            <div
              className="mb-3 flex items-center justify-between gap-3 rounded-2xl px-5 py-4"
              style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${best.color} 18%, var(--color-surface)), var(--color-surface) 75%)` }}
            >
              <div className="min-w-0">
                <div className="text-[11px] font-semibold text-ink-3">지금 가장 빨리 오는 것</div>
                <div className="truncate text-lg font-extrabold" style={{ color: best.color }}>
                  {best.label}
                </div>
              </div>
              <span className="numeral shrink-0 tabular-nums">
                {left(best.sec) < 60 ? (
                  <span className="text-3xl font-extrabold">곧 도착</span>
                ) : (
                  <>
                    <span className="text-[40px] font-extrabold leading-none">{Math.floor(left(best.sec) / 60)}</span>
                    <span className="ml-0.5 text-sm font-semibold text-ink-2">분 {String(left(best.sec) % 60).padStart(2, "0")}초</span>
                  </>
                )}
              </span>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            {/* 버스 */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="flex w-full items-start justify-between gap-2 text-left"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3">
                    <svg width="13" height="13" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="4" y="3" width="16" height="15" rx="3" />
                      <path d="M4 11h16M8 18v2M16 18v2" />
                    </svg>
                    버스 · {data.stop.number}
                  </span>
                  <span className="mt-0.5 block truncate font-bold">{data.stop.name}</span>
                </span>
                <span className="mt-1 flex shrink-0 items-center gap-1 text-[11px] font-semibold text-ink-3">
                  {showAll ? "접기" : `다른 버스 ${data.bus.others.length}`}
                  <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden className={`transition-transform ${showAll ? "rotate-180" : ""}`}>
                    <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </button>
              {data.bus.error && <p className="mt-2 text-xs text-[#e5484d]">{data.bus.error}</p>}
              <ul className="mt-2 divide-y divide-line-soft">
                {data.bus.buses.map((b) => (
                  <BusRow key={b.route} b={b} left={left} />
                ))}
              </ul>
              {showAll && (
                <div className="mt-2 border-t border-line pt-2">
                  <div className="text-[11px] font-semibold text-ink-3">이 정류장 다른 버스</div>
                  {data.bus.others.length === 0 ? (
                    <p className="py-2 text-xs text-ink-3">곧 오는 다른 버스가 없어요</p>
                  ) : (
                    <ul className="divide-y divide-line-soft">
                      {data.bus.others.map((b) => (
                        <BusRow key={b.route} b={b} left={left} small />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* 지하철 */}
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-3">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: SBD }} />
                신분당선
              </div>
              <div className="mt-0.5 font-bold">
                {c.subway.label} <span className="font-medium text-ink-3">· {c.subway.toward}</span>
              </div>
              {data.subway.error && <p className="mt-2 text-xs text-[#e5484d]">{data.subway.error}</p>}
              {data.subway.trains.length === 0 && !data.subway.error ? (
                <p className="py-3 text-sm text-ink-3">도착 정보가 없어요</p>
              ) : (
                <ul className="mt-2 divide-y divide-line-soft">
                  {data.subway.trains.slice(0, 3).map((t, i) => (
                    <li key={i} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <span
                          className="min-w-[54px] rounded-lg px-2 py-1 text-center text-[13px] font-extrabold"
                          style={{ color: SBD, background: `color-mix(in oklab, ${SBD} 13%, transparent)` }}
                        >
                          {t.to}행
                        </span>
                        <span className="truncate text-[11.5px] text-ink-3">
                          {t.msg}
                          {t.last && <b className="ml-1 text-[#e5484d]">막차</b>}
                        </span>
                      </div>
                      {t.sec != null ? <Countdown sec={left(t.sec)} dim={i > 0} /> : <span className="text-sm text-ink-3">–</span>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
          <p className="mt-2 text-right text-[11px] text-ink-3">{passed}초 전 갱신</p>
        </>
      )}
    </section>
  );
}
