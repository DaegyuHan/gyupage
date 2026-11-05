"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import type { HealthDay } from "@/lib/health";

const WD = ["일", "월", "화", "수", "목", "금", "토"];
const kstDay = (offset = 0) => new Date(Date.now() + 9 * 3600_000 - offset * 86400_000).toISOString().slice(0, 10);
const label = (d: string) => `${Number(d.slice(5, 7))}.${Number(d.slice(8))} (${WD[new Date(`${d}T00:00:00Z`).getUTCDay()]})`;
const sleepText = (m: number | null) => (m == null ? "" : `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")}`);

interface Draft {
  steps: string;
  sleep: string;
}

function Row({ day, rec, onSaved, onDeleted }: { day: string; rec?: HealthDay; onSaved: () => void; onDeleted: () => void }) {
  const init = (): Draft => ({ steps: rec?.steps != null ? String(rec.steps) : "", sleep: sleepText(rec?.sleepMin ?? null) });
  const [d, setD] = useState<Draft>(init);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => setD(init()), [rec?.steps, rec?.sleepMin]);
  const dirty = JSON.stringify(d) !== JSON.stringify(init());

  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/health", {
        method: "PUT",
        body: {
          day,
          steps: d.steps.replace(/[^\d]/g, "") || null,
          sleepMinutes: d.sleep.trim() || null,
          // 활동·운동은 그대로 두기
          activeKcal: rec?.activeKcal ?? null,
          exerciseMinutes: rec?.exerciseMin ?? null,
          distanceKm: rec?.distanceKm ?? null,
        },
      });
      setMsg("저장됨");
      onSaved();
    } catch (e) {
      setMsg(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      await api(`/api/health?day=${day}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setBusy(false);
    }
  };

  const input = "h-8 w-full min-w-0 rounded-lg border border-line bg-paper px-2 text-right text-sm tabular-nums outline-none focus:border-accent";
  return (
    <li className="grid grid-cols-[76px_minmax(0,1fr)_minmax(0,0.8fr)_auto] items-center gap-2 py-2 text-sm">
      <span className="numeral text-xs font-semibold text-ink-2">{label(day)}</span>
      <input inputMode="numeric" placeholder="걸음" value={d.steps} onChange={(e) => setD({ ...d, steps: e.target.value })} className={input} aria-label={`${day} 걸음`} />
      <input placeholder="수면 6:40" value={d.sleep} onChange={(e) => setD({ ...d, sleep: e.target.value })} className={input} aria-label={`${day} 수면`} />
      <span className="flex items-center gap-1">
        {dirty ? (
          <button type="button" onClick={save} disabled={busy} className="h-8 rounded-lg bg-ink px-3 text-xs font-semibold text-paper disabled:opacity-50">
            저장
          </button>
        ) : msg ? (
          <span className="w-10 text-center text-[11px] text-ink-3">{msg}</span>
        ) : rec ? (
          <button type="button" onClick={remove} disabled={busy} className="h-8 rounded-lg px-2 text-xs text-ink-3 hover:text-[#e5484d]" aria-label={`${day} 기록 지우기`}>
            지우기
          </button>
        ) : (
          <span className="w-10" />
        )}
      </span>
    </li>
  );
}

/** 설정 > 건강: 최근 7일 기록 직접 고치기 (걸음·수면) */
export default function HealthEditor() {
  const [list, setList] = useState<HealthDay[] | null>(null);
  const load = () =>
    api<{ list: HealthDay[] }>("/api/health?days=7")
      .then((r) => setList(r.list))
      .catch(() => setList([]));
  useEffect(() => {
    load();
  }, []);

  const days = Array.from({ length: 7 }, (_, i) => kstDay(i));
  const byDay = new Map((list ?? []).map((h) => [h.day, h]));
  return (
    <div className="mt-6 rounded-2xl border border-line bg-surface p-5">
      <div className="mb-1 grid grid-cols-[76px_minmax(0,1fr)_minmax(0,0.8fr)_auto] gap-2 text-[11px] font-semibold text-ink-3">
        <span>기록 고치기</span>
        <span className="text-right">걸음</span>
        <span className="text-right">수면 (시:분)</span>
        <span className="w-10" />
      </div>
      {!list ? (
        <div className="h-40 animate-pulse rounded-lg bg-sunken/70" />
      ) : (
        <ul className="divide-y divide-line-soft">
          {days.map((day) => (
            <Row key={day} day={day} rec={byDay.get(day)} onSaved={load} onDeleted={load} />
          ))}
        </ul>
      )}
    </div>
  );
}
