"use client";

import { PHASES, type PhasePlan } from "@/lib/projectPhases";
import { DateRangeField } from "./pickers";

interface Props {
  plan: PhasePlan;
  defaultDate: string;
  onChange: (plan: PhasePlan) => void;
}

/** 프로젝트 단계별 기간 — 개발 · SIT · UAT · PVT · 대고객 오픈, 각각 기간 또는 미정 */
export default function ProjectPhases({ plan, defaultDate, onChange }: Props) {
  // 미정을 풀면 바로 앞 단계 끝난 다음 날부터 (없으면 오늘)
  const nextStart = (i: number) => {
    for (let j = i - 1; j >= 0; j--) {
      const r = plan[PHASES[j]];
      if (r) {
        const d = new Date(`${r.end}T00:00:00`);
        d.setDate(d.getDate() + 1);
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      }
    }
    return defaultDate;
  };
  return (
    <div className="mt-5">
      <h3 className="mb-2 text-sm font-bold">단계별 일정</h3>
      <ul className="divide-y divide-line-soft rounded-xl border border-line-soft">
        {PHASES.map((p, i) => {
          const r = plan[p];
          return (
            <li key={p} className="grid grid-cols-[84px_minmax(0,1fr)_auto] items-center gap-2 px-3 py-2">
              <span className="text-sm font-semibold">{p}</span>
              <div className="-ml-2.5 min-w-0">
                {r ? (
                  <DateRangeField start={r.start} end={r.end} onChange={(s, e) => onChange({ ...plan, [p]: { start: s, end: e < s ? s : e } })} />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      const s = nextStart(i);
                      onChange({ ...plan, [p]: { start: s, end: s } });
                    }}
                    className="rounded-lg px-2.5 py-1.5 text-sm text-ink-3 hover:bg-sunken hover:text-ink"
                  >
                    미정 · 날짜 정하기
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={() => onChange({ ...plan, [p]: r ? null : { start: nextStart(i), end: nextStart(i) } })}
                aria-pressed={!r}
                className={`rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors ${
                  !r ? "border-ink bg-ink text-paper" : "border-line text-ink-3 hover:text-ink"
                }`}
              >
                미정
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
