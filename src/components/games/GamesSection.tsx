"use client";

import { useEffect, useState } from "react";
import LolPanel from "./LolPanel";
import MaplePanel from "./MaplePanel";
import SteamPanel from "./SteamPanel";

const TABS = [
  { id: "steam", label: "Steam", color: "#1b9be0" },
  { id: "lol", label: "LoL", color: "#c89b3c" },
  { id: "maple", label: "메이플스토리", color: "#f68b1f" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const KEY = "gyupage.gamesTab";

/** 홈: 게임 — Steam / LoL / 메이플스토리 탭 */
export default function GamesSection() {
  const [tab, setTab] = useState<TabId>("steam");

  useEffect(() => {
    try {
      const saved = localStorage.getItem(KEY) as TabId | null;
      if (saved && TABS.some((t) => t.id === saved)) setTab(saved);
    } catch {}
  }, []);

  const pick = (id: TabId) => {
    setTab(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {}
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h2 className="text-2xl font-extrabold tracking-tight">Games</h2>
        <div role="tablist" className="flex gap-1 rounded-full bg-sunken p-1">
          {TABS.map((t) => {
            const on = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={on}
                onClick={() => pick(t.id)}
                className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  on ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: on ? t.color : "currentColor", opacity: on ? 1 : 0.5 }} />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="rounded-2xl border border-line bg-surface p-5" role="tabpanel">
        {tab === "steam" && <SteamPanel />}
        {tab === "lol" && <LolPanel />}
        {tab === "maple" && <MaplePanel />}
      </div>
    </section>
  );
}
