"use client";

import { useEffect, useMemo, useState } from "react";
import { holidayMap, type Holiday } from "./holidays";

const memo = new Map<string, Holiday[]>();

/**
 * 날짜 → 공휴일 이름. 기본 공휴일은 바로 계산하고,
 * 서버에서 받은 임시공휴일·선거일(공공데이터 연동 시)을 뒤에 더함.
 */
export function useHolidays(years: number[]): Map<string, string> {
  const id = [...new Set(years)].sort().join(",");
  const [extra, setExtra] = useState<Holiday[]>(() => memo.get(id) ?? []);

  useEffect(() => {
    if (memo.has(id)) {
      setExtra(memo.get(id)!);
      return;
    }
    let alive = true;
    fetch(`/api/holidays?years=${id}`)
      .then((r) => (r.ok ? r.json() : { holidays: [] }))
      .then((j: { holidays: Holiday[] }) => {
        memo.set(id, j.holidays ?? []);
        if (alive) setExtra(j.holidays ?? []);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [id]);

  return useMemo(() => {
    // 공공데이터 이름("1월1일", "기독탄신일")은 우리 이름과 달라서, 이미 있는 날은 건너뜀
    const base = holidayMap(id.split(",").map(Number));
    const add = extra.filter((h) => !base.has(h.date));
    return add.length ? holidayMap(id.split(",").map(Number), add) : base;
  }, [id, extra]);
}
