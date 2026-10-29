"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import UsageChart from "./UsageChart";

interface Usage {
  source: string;
  label: string;
  calls: number;
  errors: number;
  lastError: string | null;
  lastErrorAt: number | null;
  remaining: number | null;
  quota: number | null;
}
interface Data {
  discord: boolean;
  push: boolean;
  cron: boolean;
  cronLast: number | null;
  afSaver?: boolean;
  usage: Usage[];
}

function ago(t: number) {
  const m = Math.round((Date.now() - t) / 60_000);
  if (m < 1) return "방금";
  if (m < 60) return `${m}분 전`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h}시간 전` : `${Math.round(h / 24)}일 전`;
}

/** 설정 > API 모니터: 오늘 외부 API 사용량 + 디스코드 연결 */
export default function MonitorSettings() {
  const [data, setData] = useState<Data | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(() => {
    api<Data>("/api/monitor")
      .then(setData)
      .catch((e) => setMsg(String(e).replace(/^Error: /, "")));
  }, []);
  useEffect(load, [load]);

  const send = async (action: "test" | "report") => {
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/monitor", { method: "POST", body: { action } });
      setMsg(action === "test" ? "디스코드로 테스트 메시지를 보냈어요." : "디스코드로 리포트를 보냈어요.");
    } catch (e) {
      setMsg(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  const cronOk = data?.cronLast && Date.now() - data.cronLast < 20 * 60_000;
  const badges = data
    ? [
        { label: "디스코드", ok: data.discord, text: data.discord ? "연결됨" : "DISCORD_WEBHOOK_URL 없음" },
        { label: "푸시", ok: data.push, text: data.push ? "준비됨" : "VAPID 키 없음" },
        { label: "축구 절약", ok: data.afSaver !== false, text: data.afSaver === false ? "꺼짐 · 예전 방식으로 측정 중 (AF_SAVER=off)" : "켜짐" },
        {
          label: "5분 작업",
          ok: !!cronOk,
          text: !data.cron ? "CRON_SECRET 없음" : data.cronLast ? `마지막 실행 ${ago(data.cronLast)}` : "아직 한 번도 안 돌았어요",
        },
      ]
    : [];

  return (
    <section id="monitor" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">API 모니터</h2>
      <p className="mt-1 text-sm text-ink-2">
        외부 API 에러는 디스코드로 바로, 하루 사용량·남은 한도는 매일 오전 9시에 리포트로 보내요.
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
        <div className="space-y-3">
          <ul className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
            {!data && <li className="h-16 animate-pulse rounded-lg bg-sunken/70" />}
            {badges.map((b) => (
              <li key={b.label} className="flex items-center gap-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${b.ok ? "bg-[#30a46c]" : "bg-[#f5a524]"}`} />
                <span className="w-16 shrink-0 font-semibold">{b.label}</span>
                <span className="truncate text-ink-2">{b.text}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => send("test")} disabled={busy || !data?.discord} className="rounded-full border border-line px-4 py-2 text-sm font-semibold hover:border-ink-3 disabled:opacity-50">
              디스코드 테스트
            </button>
            <button onClick={() => send("report")} disabled={busy || !data?.discord} className="rounded-full bg-accent px-4 py-2 text-sm font-semibold text-on-accent disabled:opacity-50">
              지금 리포트 보내기
            </button>
            <button onClick={load} className="rounded-full px-3 py-2 text-sm font-semibold text-ink-3 hover:text-ink">
              새로고침
            </button>
          </div>
          {msg && <p className="text-xs text-ink-2">{msg}</p>}
        </div>

        <div>
          <h3 className="mb-3 font-bold">오늘 외부 API 호출</h3>
          {data && data.usage.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-3">오늘은 아직 기록이 없어요 (캐시로만 응답했어요).</p>
          ) : (
            <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface">
              {data?.usage.map((u) => (
                <li key={u.source} className="px-4 py-2.5 text-sm">
                  <button className="flex w-full items-center gap-3 text-left" onClick={() => setOpen(open === u.source ? null : u.source)} disabled={!u.lastError}>
                    <span className={`h-2 w-2 shrink-0 rounded-full ${u.errors ? "bg-[#e5484d]" : "bg-[#30a46c]"}`} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{u.label}</span>
                    {u.remaining != null && u.quota != null && (
                      <span className={`shrink-0 text-xs tabular-nums ${u.remaining <= u.quota * 0.2 ? "font-bold text-[#e5484d]" : "text-ink-3"}`}>
                        남은 {u.remaining}/{u.quota}
                      </span>
                    )}
                    <span className="w-14 shrink-0 text-right tabular-nums text-ink-2">{u.calls}회</span>
                    <span className={`w-12 shrink-0 text-right text-xs tabular-nums ${u.errors ? "font-bold text-[#e5484d]" : "text-ink-3"}`}>{u.errors ? `에러 ${u.errors}` : "–"}</span>
                  </button>
                  {open === u.source && u.lastError && (
                    <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-all rounded-lg bg-paper p-2.5 font-mono text-[11px] text-ink-2">
                      {u.lastErrorAt ? `${ago(u.lastErrorAt)}\n` : ""}
                      {u.lastError}
                    </pre>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <UsageChart />
    </section>
  );
}
