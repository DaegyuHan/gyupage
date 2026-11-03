"use client";

import { useEffect, useRef, useState } from "react";
import LiveMarkdownEditor from "@/components/editor/LiveMarkdownEditor";
import { DateRangeField, TimeField } from "./pickers";
import ProjectPhases from "./ProjectPhases";
import { emptyPlan, parsePhase, planOf, sharedMemo, type PhasePlan, type ProjectSave } from "@/lib/projectPhases";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import type { EventInput } from "@/lib/eventStore";
import type { CalendarEvent, CategoryId } from "@/lib/types";

const DEVLOG_TEMPLATE = `## 오늘 한 일


## 이슈 / 해결

`;

/** 템플릿 그대로(아무것도 안 적음)인지 */
const isBlankMemo = (m: string) => !m.trim() || m.replace(/\s+/g, "") === DEVLOG_TEMPLATE.replace(/\s+/g, "");

interface Props {
  open: boolean;
  /** 수정이면 기존 일정, 새로 만들면 null */
  editing: CalendarEvent | null;
  defaultDate: string;
  /** 새로 만들 때 기본 카테고리 */
  defaultCategory?: CategoryId;
  onClose: () => void;
  onSave: (input: EventInput) => void;
  onDelete?: () => void;
  /** 프로젝트 단계 저장용: 지금 있는 프로젝트 일정들 */
  projectEvents?: CalendarEvent[];
  /** 프로젝트를 단계별(개발·SIT·UAT·PVT·대고객 오픈)로 저장 */
  onSaveProject?: (s: ProjectSave) => void;
}

/** 오른쪽에서 열리는 작성 패널 */
export default function EventModal({
  open,
  editing,
  defaultDate,
  defaultCategory = "devlog",
  onClose,
  onSave,
  onDelete,
  projectEvents = [],
  onSaveProject,
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");
  const [done, setDone] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  /** 프로젝트를 단계별로 입력하는 중인지 */
  const [planMode, setPlanMode] = useState(false);
  const [plan, setPlan] = useState<PhasePlan>(emptyPlan);
  const [originalName, setOriginalName] = useState<string | undefined>(undefined);
  /** 열었을 때 값 — 바뀐 게 없으면 닫을 때 저장 안 함 */
  const initial = useRef("");
  /** Esc 로 닫을 때도 자동 저장하려고 최신 함수를 담아 둠 */
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    if (!open) return;
    // 프로젝트: 새로 만들거나, 'ㅇㅇ 개발/SIT/…' 처럼 단계 일정을 열면 단계별 입력
    const parsed = editing?.category === "project" ? parsePhase(editing.title) : null;
    const pm = (!editing && defaultCategory === "project") || !!parsed;
    const pl = parsed ? planOf(projectEvents, parsed.name) : emptyPlan();
    setPlanMode(pm);
    setPlan(pl);
    setOriginalName(parsed?.name);
    setTitle(parsed ? parsed.name : (editing?.title ?? ""));
    setCategory(editing?.category ?? defaultCategory);
    setStart(editing?.start ?? defaultDate);
    setEnd(editing?.end ?? defaultDate);
    setTime(editing?.time ?? "");
    setDone(!!editing?.done);
    // 단계별 프로젝트는 메모를 모든 단계가 같이 씀
    const m = parsed ? sharedMemo(projectEvents, parsed.name) : (editing?.memo ?? (!editing && defaultCategory === "devlog" ? DEVLOG_TEMPLATE : ""));
    setMemo(m);
    setConfirmDelete(false);
    initial.current = JSON.stringify([parsed ? parsed.name : (editing?.title ?? ""), editing?.category ?? defaultCategory, editing?.start ?? defaultDate, editing?.end ?? defaultDate, editing?.time ?? "", m, !!editing?.done, pm, pl]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing, defaultDate, defaultCategory]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        document.getElementById("event-form-submit")?.click();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const c = CATEGORY_MAP[category];
  const isPlan = category === "project" && planMode && !!onSaveProject;

  /** 단계별 프로젝트 저장 (이름이 없으면 false) */
  const savePlan = () => {
    const name = title.trim();
    if (!name || !onSaveProject) return false;
    onSaveProject({ name, original: originalName, plan, memo: memo.trimEnd() });
    return true;
  };

  /** 지금 입력값 → 저장할 값 (제목이 없어 저장할 수 없으면 null) */
  const build = (): EventInput | null => {
    const finalTitle = title.trim() || (category === "devlog" ? "개발일지" : "");
    if (!finalTitle) return null;
    if (category === "todo") {
      // 할일은 하루짜리 한 줄 (홈 '오늘 꼭 할 일'과 같은 데이터)
      return { title: finalTitle.slice(0, 80), category, start, end: start, done };
    }
    return {
      title: finalTitle,
      category,
      start,
      end: end < start ? start : end,
      time: time || undefined,
      memo: memo.trimEnd() || undefined,
    };
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isPlan) {
      savePlan();
      return;
    }
    const input = build();
    if (input) onSave(input);
  };

  /**
   * 닫기(바깥 클릭·X·Esc·닫기 버튼) = 자동 저장
   * - 바뀐 게 없으면 그냥 닫음
   * - 새 일정인데 아무것도 안 적었으면(템플릿 그대로) 만들지 않음
   */
  const closeWithSave = () => {
    const now = JSON.stringify([title, category, start, end, time, memo, done, planMode, plan]);
    if (now === initial.current) return onClose();
    if (!editing && !title.trim() && isBlankMemo(memo)) return onClose();
    if (isPlan) {
      if (!savePlan()) onClose();
      return;
    }
    const input = build();
    if (input) onSave(input);
    else onClose();
  };
  closeRef.current = closeWithSave;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={closeWithSave} />
      <form
        onSubmit={submit}
        className="anim-drawer relative flex h-full w-full max-w-[640px] flex-col bg-surface shadow-[-24px_0_60px_-20px_rgba(20,28,43,0.25)]"
        aria-label={editing ? "일정 수정" : "새 일정"}
      >
        {/* 상단 바 */}
        <div className="flex items-center justify-between border-b border-line-soft px-6 py-3">
          <div className="flex gap-1">
            {CATEGORIES.map((cat) => {
              const on = category === cat.id;
              return (
                <button
                  type="button"
                  key={cat.id}
                  onClick={() => {
                    setCategory(cat.id);
                    if (cat.id === "devlog" && !memo) setMemo(DEVLOG_TEMPLATE);
                    if (cat.id === "project" && !editing) setPlanMode(true);
                  }}
                  aria-pressed={on}
                  className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-colors"
                  style={on ? { background: cat.soft, color: cat.color } : undefined}
                >
                  <span className="h-2 w-2 rounded-full" style={{ background: cat.color }} />
                  <span className={on ? "" : "text-ink-2"}>{cat.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={closeWithSave}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
            aria-label="닫기 (자동 저장)"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
              <path d="M2 2l10 10M12 2L2 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-6">
          <input
            autoFocus={!editing}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={category === "devlog" ? "개발일지" : category === "project" ? "프로젝트 이름" : category === "todo" ? "할 일" : "제목"}
            className="w-full bg-transparent text-[28px] font-extrabold tracking-tight outline-none placeholder:text-ink-3/70"
            aria-label="제목"
          />

          {category === "todo" ? (
            <>
              <dl className="mt-4 grid grid-cols-[64px_1fr] items-center gap-y-1 text-sm">
                <dt className="text-ink-2">날짜</dt>
                <dd className="-ml-2.5">
                  <DateRangeField start={start} end={start} onChange={(s) => setStart(s)} />
                </dd>
              </dl>
              <label className="mt-4 flex cursor-pointer items-center gap-2.5 text-sm font-medium">
                <input type="checkbox" checked={done} onChange={(e) => setDone(e.target.checked)} className="h-[18px] w-[18px] accent-[var(--cat-todo)]" />
                다 했어요
              </label>
            </>
          ) : isPlan ? (
            <>
              <ProjectPhases plan={plan} defaultDate={defaultDate} onChange={setPlan} />
              {!editing && (
                <button type="button" onClick={() => setPlanMode(false)} className="mt-3 text-xs font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline">
                  단계 없이 기간 하나로 만들기
                </button>
              )}
              <div className="mt-5 border-t-2 pt-3" style={{ borderColor: c.soft }}>
                <LiveMarkdownEditor value={memo} onChange={setMemo} minHeight={220} placeholder="메모" toolbar />
              </div>
            </>
          ) : (
            <>
          {category === "project" && !editing && onSaveProject && (
            <button type="button" onClick={() => setPlanMode(true)} className="mt-3 text-xs font-semibold text-ink-3 underline-offset-2 hover:text-ink hover:underline">
              개발 · SIT · UAT · PVT · 대고객 오픈 단계별로 나누기
            </button>
          )}
          <dl className="mt-4 grid grid-cols-[64px_1fr] items-center gap-y-1 text-sm">
            <dt className="text-ink-2">날짜</dt>
            <dd className="-ml-2.5">
              <DateRangeField
                start={start}
                end={end}
                onChange={(s, e) => {
                  setStart(s);
                  setEnd(e);
                }}
              />
            </dd>
            <dt className="text-ink-2">시간</dt>
            <dd className="-ml-2.5">
              <TimeField value={time} onChange={setTime} />
            </dd>
          </dl>

          <div className="mt-5 border-t-2 pt-3" style={{ borderColor: c.soft }}>
            <LiveMarkdownEditor
              value={memo}
              onChange={setMemo}
              minHeight={category === "devlog" ? 360 : 220}
              toolbar
              autoFocus={!!editing}
              placeholder="메모"
            />
          </div>
            </>
          )}
        </div>

        {/* 하단 바 */}
        <div className="flex items-center justify-between border-t border-line-soft px-6 py-3">
          {editing && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-2">{isPlan ? "프로젝트의 모든 단계를 삭제할까요?" : "정말 삭제할까요?"}</span>
                <button
                  type="button"
                  onClick={isPlan && originalName ? () => onSaveProject?.({ name: originalName, original: originalName, plan: emptyPlan() }) : onDelete}
                  className="font-semibold text-[#d4483b] hover:underline"
                >
                  삭제
                </button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="text-ink-2 hover:underline">
                  취소
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="text-sm text-ink-3 hover:text-[#d4483b]"
              >
                삭제
              </button>
            )
          ) : (
            <span className="text-xs text-ink-3">바깥을 누르거나 닫으면 자동 저장돼요</span>
          )}
          <div className="flex gap-2">
            <button
              id="event-form-submit"
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper transition-transform active:scale-[0.97]"
            >
              완료
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
