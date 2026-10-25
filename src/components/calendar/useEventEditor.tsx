"use client";

import { useState } from "react";
import { todayKey } from "@/lib/date";
import type { EventInput, useEvents } from "@/lib/eventStore";
import type { CalendarEvent, CategoryId } from "@/lib/types";
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
