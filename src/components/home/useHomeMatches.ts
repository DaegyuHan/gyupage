"use client";

import { useEffect, useState } from "react";
import type { HomeMatch } from "@/lib/home/matches";

/** 홈 일정표용 응원 팀 경기 (10분마다 새로) */
export function useHomeMatches() {
  const [matches, setMatches] = useState<HomeMatch[]>([]);
  useEffect(() => {
    const load = () =>
      fetch("/api/home-matches")
        .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
        .then((d: { matches: HomeMatch[] }) => setMatches(d.matches))
        .catch(() => {});
    load();
    const t = setInterval(load, 10 * 60_000);
    return () => clearInterval(t);
  }, []);
  return matches;
}
