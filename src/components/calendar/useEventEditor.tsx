"use client";

import { useState } from "react";
import { todayKey } from "@/lib/date";
import type { EventInput, useEvents } from "@/lib/eventStore";
import type { CalendarEvent, CategoryId } from "@/lib/types";
import { PHASES, phaseEvents, phaseTitle, type ProjectSave } from "@/lib/projectPhases";
import EventModal from "./EventModal";

type Store = ReturnType<typeof useEvents>;

/**
 * 일정 작성/수정 패널을 여는 공용 훅 (홈·캘린더에서 같이 씀)
 * 사용: const editor = useEventEditor(store); … editor.openNew(날짜) / editor.openEdit(일정) / {editor.modal}
 */
export function useEventEditor(store: Store) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<CalendarEvent | null>(null);
  const [date, setDate] = useState(todayKey());
  const [category, setCategory] = useState<CategoryId>("appointment");

  const openNew = (key: string, cat: CategoryId = "appointment") => {
    setEditing(null);
    setDate(key);
    setCategory(cat);
    setOpen(true);
  };

  const openEdit = (ev: CalendarEvent) => {
    setEditing(ev);
    setDate(ev.start);
    setOpen(true);
  };

  const save = (input: EventInput) => {
    if (editing) store.update(editing.id, input);
    else store.add(input);
    setOpen(false);
  };

  /**
   * 프로젝트 단계 저장: 단계마다 "이름 단계" 일정 하나
   * - 기간을 정한 단계: 있으면 고치고(메모·시간은 그대로), 없으면 새로 만듦
   * - 미정 단계: 있던 일정은 지움
   */
  const saveProject = ({ name, original, plan, memo }: ProjectSave) => {
    const existing = phaseEvents(store.events, original ?? name);
    for (const p of PHASES) {
      const r = plan[p];
      const ev = existing.get(p);
      if (!r) {
        if (ev) store.remove(ev.id);
        continue;
      }
      if (ev) {
        const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = ev;
        store.update(ev.id, { ...rest, title: phaseTitle(name, p), start: r.start, end: r.end, memo: memo || undefined });
      } else {
        store.add({ title: phaseTitle(name, p), category: "project", start: r.start, end: r.end, memo: memo || undefined });
      }
    }
    setOpen(false);
  };

  /** 패널에서 체크박스만 눌렀을 때 메모 저장 */
  const updateMemo = (ev: CalendarEvent, memo: string) => {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = ev;
    store.update(ev.id, { ...rest, memo });
  };

  const modal = (
    <EventModal
      open={open}
      editing={editing}
      defaultDate={date}
      defaultCategory={category}
      onClose={() => setOpen(false)}
      onSave={save}
      projectEvents={store.events.filter((e) => e.category === "project")}
      onSaveProject={saveProject}
      onDelete={
        editing
          ? () => {
              store.remove(editing.id);
              setOpen(false);
            }
          : undefined
      }
    />
  );

  return { openNew, openEdit, updateMemo, modal };
}
