"use client";

import { useEffect, useState } from "react";
import LiveMarkdownEditor from "@/components/editor/LiveMarkdownEditor";
import { DateRangeField, TimeField } from "./pickers";
import { CATEGORIES, CATEGORY_MAP } from "@/lib/categories";
import type { EventInput } from "@/lib/eventStore";
import type { CalendarEvent, CategoryId } from "@/lib/types";

const DEVLOG_TEMPLATE = `## 오늘 한 일
- [ ]

## 이슈 / 해결
-

## 내일 할 일
- [ ]
`;

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
}: Props) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<CategoryId>(defaultCategory);
  const [start, setStart] = useState(defaultDate);
  const [end, setEnd] = useState(defaultDate);
  const [time, setTime] = useState("");
  const [memo, setMemo] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(editing?.title ?? "");
    setCategory(editing?.category ?? defaultCategory);
    setStart(editing?.start ?? defaultDate);
    setEnd(editing?.end ?? defaultDate);
    setTime(editing?.time ?? "");
    setMemo(editing?.memo ?? (!editing && defaultCategory === "devlog" ? DEVLOG_TEMPLATE : ""));
    setConfirmDelete(false);
  }, [open, editing, defaultDate, defaultCategory]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
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

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalTitle = title.trim() || (category === "devlog" ? "개발일지" : "");
    if (!finalTitle) return;
    onSave({
      title: finalTitle,
      category,
      start,
      end: end < start ? start : end,
      time: time || undefined,
      memo: memo.trimEnd() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="anim-fade absolute inset-0 bg-ink/25 backdrop-blur-[2px]" onClick={onClose} />
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
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-ink-2 hover:bg-sunken hover:text-ink"
            aria-label="닫기"
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
            placeholder={category === "devlog" ? "개발일지" : category === "project" ? "프로젝트 이름" : "제목"}
            className="w-full bg-transparent text-[28px] font-extrabold tracking-tight outline-none placeholder:text-ink-3/70"
            aria-label="제목"
          />

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
              autoFocus={!!editing}
              placeholder="## 제목, - [ ] 할 일, **굵게** 처럼 마크다운으로 적어요"
            />
          </div>
        </div>

        {/* 하단 바 */}
        <div className="flex items-center justify-between border-t border-line-soft px-6 py-3">
          {editing && onDelete ? (
            confirmDelete ? (
              <div className="flex items-center gap-2 text-sm">
                <span className="text-ink-2">정말 삭제할까요?</span>
                <button type="button" onClick={onDelete} className="font-semibold text-[#d4483b] hover:underline">
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
            <span className="text-xs text-ink-3">Ctrl+Enter 로 저장</span>
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-full px-4 py-2 text-sm font-medium text-ink-2 hover:bg-sunken">
              취소
            </button>
            <button
              id="event-form-submit"
              type="submit"
              className="rounded-full bg-ink px-5 py-2 text-sm font-semibold text-paper transition-transform active:scale-[0.97]"
            >
              저장
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
