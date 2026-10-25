"use client";

import { useEffect, useState } from "react";
import type { SteamSummary } from "@/lib/games/steam";

const STEAM = "#1b9be0";
const PLAYING = "#90ba3c";

const STATE: Record<number, string> = { 0: "오프라인", 1: "온라인", 2: "다른 용무 중", 3: "자리 비움", 4: "잠자는 중", 5: "거래 가능", 6: "게임 가능" };

/** 분 → "12.5시간" / "40분" */
function hours(min: number) {
  if (min < 60) return `${min}분`;
  const h = min / 60;
  return `${h >= 100 ? Math.round(h).toLocaleString() : h.toFixed(1)}시간`;
}

function Setup() {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-sm leading-relaxed text-ink-2">
      <p className="font-bold text-ink">Steam 연결 준비</p>
      <ol className="mt-2 list-decimal space-y-1 pl-5">
        <li>
          <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
            Steam Web API 키
          </a>
          를 받아요. (도메인 칸에는 아무 주소나 적어도 돼요)
        </li>
        <li>
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">.env.local</code> 에{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">STEAM_API_KEY</code> 와{" "}
          <code className="rounded bg-sunken px-1.5 py-0.5 text-[0.85em]">STEAM_ID</code>(프로필 주소)를 넣어요.
        </li>
        <li>Steam 프로필의 개인정보 설정에서 &lsquo;게임 세부 정보&rsquo;를 공개로 해 두면 플레이 기록이 나와요.</li>
      </ol>
    </div>
  );
}

/** Steam 탭: 프로필 + 최근 2주 플레이한 게임 */
export default function SteamPanel() {
  const [data, setData] = useState<SteamSummary | null>(null);
  const [setup, setSetup] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/steam")
      .then(async (r) => {
        const j = await r.json();
        if (j.setup) setSetup(true);
        else if (!r.ok) setFailed(j.detail ?? j.error ?? "불러오지 못했어요");
        else setData(j as SteamSummary);
      })
      .catch(() => setFailed("불러오지 못했어요"));
  }, []);

  if (setup) return <Setup />;
  if (failed) return <p className="py-6 text-sm text-ink-3">Steam 정보를 불러오지 못했어요. ({failed})</p>;
  if (!data) return <div className="h-[200px] rounded-2xl bg-sunken/70" aria-busy="true" />;

  const online = data.state !== 0;
  const max = Math.max(1, ...data.games.map((g) => g.recent));

  return (
    <div className="grid gap-x-8 gap-y-6 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      {/* 프로필 */}
      <div className="min-w-0">
        <a href={data.profileUrl} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-4">
          <span className="relative shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={data.avatar}
              alt=""
              width={64}
              height={64}
              className="h-16 w-16 rounded-xl ring-2"
              style={{ ["--tw-ring-color" as string]: data.playing ? PLAYING : online ? STEAM : "var(--color-line)" }}
            />
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-xl font-extrabold tracking-tight group-hover:text-accent">{data.name}</span>
              {data.level != null && (
                <span className="numeral shrink-0 rounded-full border-2 px-1.5 text-[11px] font-bold leading-4" style={{ borderColor: STEAM, color: STEAM }}>
                  {data.level}
                </span>
              )}
            </span>
            <span className="mt-1 block truncate text-[12px] font-medium" style={{ color: data.playing ? PLAYING : online ? STEAM : undefined }}>
              {data.playing ? `${data.playing} 플레이 중` : <span className={online ? "" : "text-ink-3"}>{STATE[data.state] ?? "온라인"}</span>}
            </span>
          </span>
        </a>

        <div className="mt-5 grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-sunken/60 px-3 py-2.5">
            <div className="text-[11px] text-ink-3">최근 2주</div>
            <div className="numeral mt-0.5 text-[17px] font-extrabold">{hours(data.recentMinutes)}</div>
          </div>
          <div className="rounded-xl bg-sunken/60 px-3 py-2.5">
            <div className="text-[11px] text-ink-3">보유 게임</div>
            <div className="numeral mt-0.5 text-[17px] font-extrabold">
              {data.gameCount != null ? data.gameCount.toLocaleString() : "–"}
              {data.gameCount != null && <span className="text-xs font-bold text-ink-3">개</span>}
            </div>
          </div>
        </div>
      </div>

      {/* 최근 플레이한 게임 */}
      <div className="min-w-0 lg:border-l lg:border-line-soft lg:pl-8">
        <h3 className="mb-2 text-[11px] font-bold text-ink-2">최근 2주 플레이한 게임</h3>
        {data.privateGames ? (
          <p className="py-4 text-sm text-ink-3">게임 기록이 비공개예요. Steam 프로필 → 개인정보 설정에서 &lsquo;게임 세부 정보&rsquo;를 공개로 바꿔 주세요.</p>
        ) : data.games.length === 0 ? (
          <p className="py-4 text-sm text-ink-3">최근 2주 동안 플레이한 게임이 없어요.</p>
        ) : (
          <ul className="space-y-2.5">
            {data.games.slice(0, 5).map((g) => (
              <li key={g.appid}>
                <a href={`https://store.steampowered.com/app/${g.appid}`} target="_blank" rel="noopener noreferrer" className="group flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={g.image}
                    alt=""
                    width={92}
                    height={43}
                    loading="lazy"
                    onError={(e) => {
                      // 대표 이미지가 없으면 아이콘으로
                      const img = e.currentTarget;
                      if (g.icon && img.src !== g.icon) {
                        img.src = g.icon;
                        img.style.objectFit = "contain";
                      }
                    }}
                    className="h-[43px] w-[92px] shrink-0 rounded-md bg-sunken object-cover"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-[13px] font-bold group-hover:text-accent">{g.name}</span>
                      <span className="numeral shrink-0 text-[12px] font-bold tabular-nums">{hours(g.recent)}</span>
                    </span>
                    <span className="mt-1 block h-1.5 overflow-hidden rounded-full bg-sunken">
                      <span className="block h-full rounded-full" style={{ width: `${(g.recent / max) * 100}%`, background: STEAM }} />
                    </span>
                    <span className="mt-0.5 block text-[10px] text-ink-3">전체 {hours(g.total)}</span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
