"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";

interface Bucket {
  count: number;
  input: number;
  output: number;
  searches: number;
  krw: number;
  unknown: number;
}
interface Data {
  rate: number;
  months: { month: string; by: Record<string, Bucket>; krw: number }[];
  price: { model: string; input: number; output: number; search: number };
}

const LABEL: Record<string, { name: string; unit: string }> = {
  predict: { name: "승부 예측", unit: "번" },
  cs: { name: "Daily CS", unit: "편" },
};
const won = (n: number) => `${Math.round(n).toLocaleString("ko-KR")}원`;
const tok = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(2)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));
const monthLabel = (m: string) => `${m.slice(0, 4)}년 ${Number(m.slice(5))}월`;

/** 설정 > AI 사용량: Claude 토큰·검색 사용량과 원화 비용 (월별·기능별) */
export default function AiUsageSettings() {
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<Data>("/api/ai-usage")
      .then(setData)
      .catch((e) => setErr(String(e).replace(/^Error: /, "")));
  }, []);

  const thisMonth = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 7);
  const cur = data?.months.find((m) => m.month === thisMonth);
  const total = data?.months.reduce((s, m) => s + m.krw, 0) ?? 0;

  return (
    <section id="ai-usage">
      <h2 className="text-2xl font-extrabold tracking-tight">AI 사용량</h2>
      <p className="mt-1 text-sm text-ink-2">Claude 를 쓴 기능별 토큰과 비용이에요 (원화 추정).</p>

      {err && <p className="mt-4 text-sm text-[#e5484d]">{err}</p>}
      {!data && !err && <div className="mt-6 h-32 animate-pulse rounded-2xl bg-sunken/70" />}

      {data && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">이번 달</div>
              <div className="numeral mt-1 text-3xl font-extrabold tabular-nums">{won(cur?.krw ?? 0)}</div>
            </div>
            <div className="rounded-2xl border border-line bg-surface p-4">
              <div className="text-xs font-semibold text-ink-3">지금까지 합계</div>
              <div className="numeral mt-1 text-3xl font-extrabold tabular-nums">{won(total)}</div>
            </div>
          </div>

          {data.months.length === 0 ? (
            <p className="mt-6 text-sm text-ink-3">아직 기록이 없어요.</p>
          ) : (
            <div className="mt-6 space-y-6">
              {data.months.map((m) => (
                <div key={m.month}>
                  <div className="mb-2 flex items-baseline justify-between">
                    <h3 className="font-bold">{monthLabel(m.month)}</h3>
                    <span className="numeral font-bold tabular-nums">{won(m.krw)}</span>
                  </div>
                  <div className="overflow-hidden rounded-xl border border-line-soft text-sm">
                    <div className="grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1.2fr)_72px] gap-2 bg-sunken/60 px-3 py-2 text-[11px] font-semibold text-ink-3">
                      <span>기능</span>
                      <span className="text-right">횟수</span>
                      <span className="text-right">토큰 (입력·출력) · 검색</span>
                      <span className="text-right">비용</span>
                    </div>
                    {Object.entries(m.by).map(([k, b]) => (
                      <div key={k} className="grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1.2fr)_72px] items-center gap-2 border-t border-line-soft px-3 py-2.5">
                        <span className="truncate font-semibold">{LABEL[k]?.name ?? k}</span>
                        <span className="numeral text-right tabular-nums text-ink-2">
                          {b.count}
                          {LABEL[k]?.unit}
                        </span>
                        <span className="numeral truncate text-right text-xs tabular-nums text-ink-2">
                          {tok(b.input)}·{tok(b.output)}
                          {b.searches > 0 && ` · ${b.searches}회`}
                          {b.unknown > 0 && <span className="block text-[10px] text-ink-3">기록 없는 {b.unknown}개 빠짐</span>}
                        </span>
                        <span className="numeral text-right font-bold tabular-nums">{won(b.krw)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          <p className="mt-4 text-[11px] leading-5 text-ink-3">
            {data.price.model} 기준 100만 토큰당 입력 ${data.price.input} · 출력 ${data.price.output}, 웹 검색 1회 ${data.price.search}, 환율 1달러 {data.rate.toLocaleString("ko-KR")}원으로 계산한 추정치예요. 정확한 청구 금액은 Anthropic 콘솔에서 확인하세요. Daily CS 는 사용량을 기록하기 시작한 글부터 계산돼요.
          </p>
        </>
      )}
    </section>
  );
}
