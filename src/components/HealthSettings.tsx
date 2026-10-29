"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";
import type { HealthDay } from "@/lib/health";

function Copy({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  return (
    <div>
      <div className="mb-1 text-xs font-semibold text-ink-2">{label}</div>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg bg-paper px-2.5 py-2 text-[11px] text-ink-2">{value}</code>
        <button
          onClick={() =>
            navigator.clipboard
              .writeText(value)
              .then(() => {
                setDone(true);
                setTimeout(() => setDone(false), 1500);
              })
              .catch(() => {})
          }
          className="shrink-0 rounded-lg border border-line px-3 py-2 text-xs font-semibold hover:border-ink-3"
        >
          {done ? "복사됨" : "복사"}
        </button>
      </div>
    </div>
  );
}

const STEPS: React.ReactNode[] = [
  <>
    아이폰 <b>단축어</b> 앱 → 오른쪽 위 <b>+</b> → 이름을 <b>규페이지 건강</b>으로.
  </>,
  <>
    <b>건강 샘플 찾기</b> 동작을 4개 넣고 각각 이렇게 바꿔요.
    <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
      <li>① <b>걸음</b> · 시작 날짜 <b>오늘</b> · 그룹화 기준 <b>일</b></li>
      <li>② <b>활동 에너지</b> · 시작 날짜 <b>오늘</b> · 그룹화 기준 <b>일</b></li>
      <li>③ <b>운동하기 시간</b> · 시작 날짜 <b>오늘</b> · 그룹화 기준 <b>일</b></li>
      <li>④ <b>수면 분석</b> · 시작 날짜 <b>지난 1일</b> · 필터 추가 → 값이 <b>깨어 있음 아님</b>, 값이 <b>침대에 있음 아님</b></li>
    </ul>
  </>,
  <>
    <b>URL의 콘텐츠 가져오기</b> 동작 → URL 에 위의 <b>보낼 주소</b>, 화살표를 펼쳐서
    <ul className="mt-1.5 space-y-1 text-[13px] text-ink-2">
      <li>· 방법 <b>POST</b></li>
      <li>· 헤더: 키 <code>Authorization</code>, 값 <code>Bearer </code>+토큰 (띄어쓰기 한 칸)</li>
      <li>· 요청 본문 <b>JSON</b>, 필드 4개 (유형 <b>텍스트</b>)</li>
      <li className="pl-3">
        <code>steps</code> → ①의 결과 · <code>activeKcal</code> → ② · <code>exerciseMinutes</code> → ③ ·{" "}
        <code>sleepMinutes</code> → ④를 누르고 <b>지속 시간</b> 선택
      </li>
    </ul>
  </>,
  <>
    (선택) <b>결과 보기</b> 동작을 넣으면 실행할 때 &ldquo;✅ 저장 · 걸음 8,240 · 수면 6시간 40분&rdquo;처럼 확인돼요.
  </>,
  <>
    단축어 앱 <b>자동화</b> 탭 → <b>+</b> → <b>특정 시간</b> → 매일 <b>23:50</b> → <b>즉시 실행</b> → 방금 만든 단축어. 낮에도 보고 싶으면 12:00·18:00 자동화를 더 만들어요 (같은 날은 덮어써요).
  </>,
];

/** 설정 > 건강: 아이폰 단축어로 건강 앱 기록 보내기 */
export default function HealthSettings() {
  const [info, setInfo] = useState<{ url: string; token: string; local: boolean } | null>(null);
  const [last, setLast] = useState<{ list: HealthDay[]; updatedAt: number | null } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api<{ url: string; token: string; local: boolean }>("/api/health/token")
      .then(setInfo)
      .catch((e) => setErr(String(e).replace(/^Error: /, "")));
    api<{ list: HealthDay[]; updatedAt: number | null }>("/api/health?days=3")
      .then(setLast)
      .catch(() => {});
  }, []);

  const latest = last?.list.at(-1);

  return (
    <section id="health" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">건강 (아이폰)</h2>
      <p className="mt-1 text-sm text-ink-2">
        아이폰 <b>단축어</b>가 건강 앱의 걸음·수면·활동·운동 기록을 보내 주면 홈에 보여요. 건강 앱 데이터는 아이폰 밖으로 직접 꺼낼 수 없어서 단축어가 대신 보내는 방식이에요.
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="space-y-4 rounded-2xl border border-line bg-surface p-5">
          {err && <p className="text-sm text-[#e5484d]">{err}</p>}
          {!info && !err && <div className="h-24 animate-pulse rounded-lg bg-sunken/70" />}
          {info && (
            <>
              {info.local && <p className="rounded-lg bg-[#f5a524]/12 px-3 py-2 text-xs text-ink-2">지금은 내 PC 주소예요. 배포된 사이트의 설정에서 복사해 주세요.</p>}
              <Copy label="보낼 주소" value={info.url} />
              <Copy label="헤더 Authorization 값" value={`Bearer ${info.token}`} />
            </>
          )}
          <div className="border-t border-line-soft pt-3 text-xs text-ink-2">
            {latest ? (
              <>
                마지막으로 받은 기록 <b className="text-ink">{latest.day}</b> · 걸음 {latest.steps?.toLocaleString("ko-KR") ?? "–"} · 수면{" "}
                {latest.sleepMin != null ? `${Math.floor(latest.sleepMin / 60)}시간 ${latest.sleepMin % 60}분` : "–"}
              </>
            ) : (
              "아직 받은 기록이 없어요. 단축어를 한 번 실행해 보세요."
            )}
          </div>
          <p className="text-[11px] text-ink-3">토큰이 새어 나가면 Vercel 에 HEALTH_TOKEN 을 새로 넣으면 예전 토큰은 막혀요.</p>
        </div>

        <ol className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed">
          {STEPS.map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="numeral flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-bold text-accent">{i + 1}</span>
              <div className="min-w-0">{t}</div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
