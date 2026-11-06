"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import { COMMUTE, type CommuteKey, type CommuteStop, type CommuteStops } from "@/lib/commute";

interface Station {
  stationId: string;
  name: string;
  number: string;
  region: string;
}
interface Route {
  route: string;
  type: number;
}

const busColor = (type: number) => (type === 11 || type === 14 ? "#E5484D" : type === 12 ? "#2563EB" : type === 30 ? "#D9A100" : "#16A34A");
const DEF: CommuteStops = { am: { ...COMMUTE.am.stop, routes: [...COMMUTE.am.stop.routes] }, pm: { ...COMMUTE.pm.stop, routes: [...COMMUTE.pm.stop.routes] } };

function StopEditor({ k, value, onSave }: { k: CommuteKey; value: CommuteStop; onSave: (s: CommuteStop) => Promise<void> }) {
  const [draft, setDraft] = useState<CommuteStop>(value);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Station[] | null>(null);
  const [routes, setRoutes] = useState<Route[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setDraft(value), [value]);
  // 정류장을 고르면 그 정류장을 지나는 노선
  useEffect(() => {
    setRoutes(null);
    api<{ routes: Route[] }>(`/api/commute/routes?stationId=${draft.stationId}`)
      .then((r) => setRoutes(r.routes))
      .catch(() => setRoutes([]));
  }, [draft.stationId]);

  const search = async () => {
    if (q.trim().length < 2) return;
    setResults(null);
    try {
      setResults((await api<{ stations: Station[] }>(`/api/commute/stations?q=${encodeURIComponent(q.trim())}`)).stations);
    } catch {
      setResults([]);
    }
  };
  const dirty = JSON.stringify(draft) !== JSON.stringify(value);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-lg font-bold">{COMMUTE[k].title}</h3>
        <span className="text-xs text-ink-3">{k === "am" ? "오후 2시 전" : "오후 2시 이후"}</span>
      </div>
      <div className="mt-2 text-sm">
        <b>{draft.name}</b> <span className="text-ink-3">· {draft.number}</span>
      </div>

      <form
        className="mt-3 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          search();
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="정류장 이름 또는 번호"
          className="h-9 min-w-0 flex-1 rounded-lg border border-line bg-paper px-3 text-sm outline-none focus:border-accent"
        />
        <button type="submit" className="h-9 rounded-lg border border-line px-3 text-sm font-semibold text-ink-2 hover:text-ink">
          찾기
        </button>
      </form>
      {results && (
        <ul className="mt-2 max-h-56 divide-y divide-line-soft overflow-y-auto rounded-lg border border-line-soft">
          {results.length === 0 && <li className="px-3 py-2 text-sm text-ink-3">결과가 없어요</li>}
          {results.map((s) => (
            <li key={s.stationId}>
              <button
                type="button"
                onClick={() => {
                  setDraft({ name: s.name, number: s.number, stationId: s.stationId, routes: [] });
                  setResults(null);
                  setQ("");
                }}
                className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-sunken/60"
              >
                <span className="truncate">{s.name}</span>
                <span className="shrink-0 text-xs text-ink-3">
                  {s.number} · {s.region}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4 text-xs font-semibold text-ink-3">타는 버스</div>
      {!routes ? (
        <div className="mt-2 h-16 animate-pulse rounded-lg bg-sunken/70" />
      ) : routes.length === 0 ? (
        <p className="mt-2 text-sm text-ink-3">노선 정보를 불러오지 못했어요</p>
      ) : (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {routes.map((r) => {
            const on = draft.routes.includes(r.route);
            return (
              <button
                key={r.route}
                type="button"
                aria-pressed={on}
                onClick={() => setDraft({ ...draft, routes: on ? draft.routes.filter((x) => x !== r.route) : [...draft.routes, r.route] })}
                className="numeral rounded-lg border px-2.5 py-1 text-xs font-bold transition-colors"
                style={on ? { background: busColor(r.type), borderColor: busColor(r.type), color: "#fff" } : { borderColor: "var(--color-line)", color: "var(--color-ink-2)" }}
              >
                {r.route}
              </button>
            );
          })}
        </div>
      )}

      <div className="mt-4 flex items-center justify-end gap-3">
        {msg && <span className="text-xs text-ink-3">{msg}</span>}
        <button
          type="button"
          disabled={!dirty || busy || draft.routes.length === 0}
          onClick={async () => {
            setBusy(true);
            setMsg(null);
            try {
              await onSave(draft);
              setMsg("저장됨");
            } catch (e) {
              setMsg(String(e).replace(/^Error: /, ""));
            } finally {
              setBusy(false);
            }
          }}
          className="h-9 rounded-full bg-ink px-5 text-sm font-semibold text-paper disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  );
}

/** 설정 > 출퇴근: 출근·퇴근 정류장과 타는 버스 */
export default function CommuteSettings() {
  const [stops, setStops] = useState<CommuteStops | null>(null);
  useEffect(() => {
    api<{ value: Partial<CommuteStops> | null }>("/api/prefs/commute")
      .then((r) => setStops({ am: r.value?.am ?? DEF.am, pm: r.value?.pm ?? DEF.pm }))
      .catch(() => setStops(DEF));
  }, []);

  const save = (k: CommuteKey) => async (s: CommuteStop) => {
    const next = { ...(stops ?? DEF), [k]: s };
    await api("/api/prefs/commute", { method: "PUT", body: { value: next } });
    setStops(next);
  };

  return (
    <section id="commute" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">출퇴근</h2>
      {!stops ? (
        <div className="mt-5 h-48 animate-pulse rounded-2xl bg-sunken/70" />
      ) : (
        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <StopEditor k="am" value={stops.am} onSave={save("am")} />
          <StopEditor k="pm" value={stops.pm} onSave={save("pm")} />
        </div>
      )}
    </section>
  );
}
