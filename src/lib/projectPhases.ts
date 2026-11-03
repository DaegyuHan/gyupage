/**
 * 프로젝트 단계: 한 프로젝트 이름으로 개발 · SIT · UAT · PVT · 대고객 오픈 일정을 따로 잡음
 * 캘린더에는 단계마다 "ㅇㅇㅇ 프로젝트 SIT" 처럼 일정 하나씩 저장 (미정이면 일정 없음)
 */
import type { CalendarEvent } from "./types";

export const PHASES = ["개발", "SIT", "UAT", "PVT", "대고객 오픈"] as const;
export type Phase = (typeof PHASES)[number];

/** 단계별 기간 (null = 미정) */
export type PhasePlan = Record<Phase, { start: string; end: string } | null>;

export const emptyPlan = (): PhasePlan => Object.fromEntries(PHASES.map((p) => [p, null])) as PhasePlan;

/** "MCash 프로젝트 대고객오픈" → { name: "MCash 프로젝트", phase: "대고객 오픈" } */
export function parsePhase(title: string): { name: string; phase: Phase } | null {
  const t = title.trim();
  for (const p of PHASES) {
    const re = new RegExp(`^(.*\\S)\\s+${p.replace(" ", "\\s*")}$`, "i");
    const m = t.match(re);
    if (m) return { name: m[1].trim(), phase: p };
  }
  return null;
}

export const phaseTitle = (name: string, phase: Phase) => `${name.trim()} ${phase}`;

/** 이 프로젝트 이름으로 저장된 단계 일정들 */
export function phaseEvents(events: CalendarEvent[], name: string) {
  const key = name.trim();
  const out = new Map<Phase, CalendarEvent>();
  for (const e of events) {
    if (e.category !== "project") continue;
    const p = parsePhase(e.title);
    if (p && p.name === key && !out.has(p.phase)) out.set(p.phase, e);
  }
  return out;
}

export function planOf(events: CalendarEvent[], name: string): PhasePlan {
  const plan = emptyPlan();
  for (const [p, e] of phaseEvents(events, name)) plan[p] = { start: e.start, end: e.end };
  return plan;
}

export interface ProjectSave {
  name: string;
  /** 수정 전 이름 (이름을 바꾼 경우 예전 단계 일정도 같이 바꿈) */
  original?: string;
  plan: PhasePlan;
}
