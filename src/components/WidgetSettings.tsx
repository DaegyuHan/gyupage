"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/auth-client";

/** 설정 > 아이폰 위젯: Scriptable 스크립트 복사 + 설치 안내 */
export default function WidgetSettings() {
  const [state, setState] = useState<"idle" | "copied" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [data, setData] = useState<{ script: string; local: boolean } | null>(null);

  // 아이폰 사파리는 버튼을 누른 그 순간에만 복사를 허락해서, 스크립트를 미리 받아 둠
  useEffect(() => {
    api<{ script: string; local: boolean }>("/api/widget/script")
      .then(setData)
      .catch((e) => {
        setState("error");
        setMsg(String(e).replace(/^Error: /, ""));
      });
  }, []);

  const copy = async () => {
    if (!data) return;
    try {
      await navigator.clipboard.writeText(data.script);
      setState("copied");
    } catch {
      setState("error");
      setMsg("복사하지 못했어요. 아래 칸을 길게 눌러 전체 선택 후 복사해 주세요.");
    }
  };
  const local = data?.local ?? false;

  return (
    <section id="widget" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">아이폰 위젯</h2>
      <p className="mt-1 text-sm text-ink-2">
        &lsquo;오늘 꼭 할 일&rsquo;을 아이폰 홈 화면·잠금 화면 위젯으로 볼 수 있어요. 무료 앱 <b>Scriptable</b> 이 위젯을 그려 줘요.
      </p>

      <div className="mt-5 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <ol className="space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm leading-relaxed">
          {[
            <>
              App Store 에서{" "}
              <a href="https://apps.apple.com/app/scriptable/id1405459188" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                Scriptable
              </a>{" "}
              을 설치해요.
            </>,
            <>
              아이폰에서 이 화면을 열고 <b>스크립트 복사</b>를 눌러요.
            </>,
            <>
              Scriptable 에서 <b>+</b> → 붙여 넣기 → 이름을 &lsquo;규페이지&rsquo;로 저장해요.
            </>,
            <>
              홈 화면을 길게 눌러 <b>위젯 추가 → Scriptable</b> (원하는 크기) → 추가한 위젯을 길게 눌러 <b>위젯 편집 → Script: 규페이지</b>.
            </>,
          ].map((t, i) => (
            <li key={i} className="flex gap-3">
              <span className="numeral flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">{i + 1}</span>
              <span>{t}</span>
            </li>
          ))}
          <li className="pt-1 text-xs text-ink-3">잠금 화면 위젯도 같은 방법으로 넣을 수 있어요. 위젯을 누르면 규페이지가 열려요.</li>
        </ol>

        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5">
          <div className="rounded-xl bg-[#141c2b] p-4 text-[13px] text-[#e8ecf3]">
            <div className="flex items-center gap-1.5 font-bold">
              오늘 꼭 할 일 <span className="text-[8px] text-[#7d95ff]">●</span>
              <span className="ml-auto text-[#7d95ff]">1/3</span>
            </div>
            <div className="mt-0.5 text-[11px] text-[#8a94a6]">위젯 미리보기</div>
            <div className="mt-2.5 space-y-1.5">
              <div>☐ 결제 API 리뷰</div>
              <div>☐ Daily CS 읽기</div>
              <div className="text-[#8a94a6]">
                <span className="text-[#3cc99a]">☑</span> 운동
              </div>
            </div>
          </div>
          <button
            onClick={copy}
            disabled={!data}
            className="rounded-xl bg-ink py-3 text-sm font-bold text-paper transition disabled:opacity-50"
          >
            {!data && state !== "error" ? "준비 중…" : state === "copied" ? "복사했어요 ✓ Scriptable 에 붙여 넣어 주세요" : "스크립트 복사"}
          </button>
          {state === "copied" && local && (
            <p className="text-xs font-medium text-[#b26b00]">
              지금 내 컴퓨터(localhost) 주소가 들어갔어요. 아이폰에서 쓰려면 배포한 사이트에서 다시 복사해 주세요.
            </p>
          )}
          {state === "error" && <p className="text-xs font-medium text-[#d64545]">{msg}</p>}
          {state === "error" && data && (
            <textarea readOnly value={data.script} className="h-28 w-full rounded-lg border border-line bg-paper p-2 font-mono text-[11px]" />
          )}
          <p className="text-xs text-ink-3">
            스크립트에는 위젯 전용 토큰이 들어 있어요. 이 토큰으로는 오늘 할 일을 <b>읽기만</b> 할 수 있어요. 새어 나가면 Vercel 의 WIDGET_TOKEN 을 바꾸면 돼요.
          </p>
        </div>
      </div>
    </section>
  );
}
