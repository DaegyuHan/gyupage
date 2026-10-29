"use client";

import { useState } from "react";
import type { Leader, Leaders } from "@/lib/football/standings";
import { Crest } from "./icons";

const TABS: { key: keyof Leaders; label: string; unit: string }[] = [
  { key: "goals", label: "득점", unit: "골" },
  { key: "assists", label: "도움", unit: "도움" },
  { key: "points", label: "공격포인트", unit: "P" },
];

function sub(p: Leader, key: keyof Leaders) {
  if (key === "goals") return `도움 ${p.assists}`;
  if (key === "assists") return `골 ${p.goals}`;
  return `${p.goals}골 ${p.assists}도움`;
}

/** 득점 · 도움 · 공격포인트 순위 */
export default function LeaderTabs({ data, note }: { data: Leaders; note?: string }) {
  const [tab, setTab] = useState<keyof Leaders>("goals");
  const list = data[tab];
  const t = TABS.find((x) => x.key === tab)!;
  const [first, ...rest] = list;

  return (
    <div>
      <div className="mb-3 flex gap-1 rounded-full bg-sunken p-1 text-xs font-semibold" role="tablist">
        {TABS.map((x) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={tab === x.key}
            onClick={() => setTab(x.key)}
            className={`flex-1 rounded-full px-3 py-1.5 transition ${tab === x.key ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
          >
            {x.label}
          </button>
        ))}
      </div>

      {!first ? (
        <p className="py-6 text-sm text-ink-3">아직 기록이 없어요.</p>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-4 rounded-2xl border border-line bg-surface p-4">
            {first.photo ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={first.photo} alt="" width={52} height={52} className="h-[52px] w-[52px] rounded-full bg-sunken object-cover" />
            ) : (
              <span className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-sunken">
                <Crest src={first.teamLogo} size={28} />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-lg font-bold leading-tight">{first.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-2">
                <Crest src={first.teamLogo} size={14} />
                <span className="truncate">{first.team}</span>
              </div>
            </div>
            <div className="text-right">
              <div className="numeral text-4xl font-extrabold leading-none">{first.value}</div>
              <div className="mt-1 text-[11px] text-ink-3">{sub(first, tab)}</div>
            </div>
          </div>
          <ol className="divide-y divide-line-soft">
            {rest.slice(0, 14).map((p) => (
              <li key={`${p.rank}-${p.name}`} className="flex items-center gap-3 py-2 text-sm">
                <span className="numeral w-5 text-right text-xs font-semibold text-ink-3">{p.rank}</span>
                <Crest src={p.teamLogo} size={18} />
                <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                <span className="shrink-0 text-[11px] text-ink-3">{sub(p, tab)}</span>
                <span className="numeral w-7 text-right text-base font-extrabold">{p.value}</span>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-[11px] text-ink-3">
            단위: {t.unit}
            {note ? ` · ${note}` : ""}
          </p>
        </>
      )}
    </div>
  );
}
