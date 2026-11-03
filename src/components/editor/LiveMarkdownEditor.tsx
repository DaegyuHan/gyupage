"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { livePreviewPlugin, livePreviewTheme } from "@/lib/editor/livePreview";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
  /** 위쪽에 서식 버튼 (빨간 글씨) */
  toolbar?: boolean;
}

const RED_OPEN = '<span class="red">';
const RED_CLOSE = "</span>";

/** 선택한 글자를 빨간 글씨로 (이미 빨간색이면 해제). 여러 줄이면 줄마다 감쌈 */
function toggleRed(view: EditorView) {
  const { state } = view;
  view.dispatch(
    state.changeByRange((range) => {
      const text = state.sliceDoc(range.from, range.to);
      // 선택 영역 바로 바깥이 태그면 해제
      const before = state.sliceDoc(range.from - RED_OPEN.length, range.from);
      const after = state.sliceDoc(range.to, range.to + RED_CLOSE.length);
      if (before === RED_OPEN && after === RED_CLOSE) {
        return {
          changes: [
            { from: range.from - RED_OPEN.length, to: range.from },
            { from: range.to, to: range.to + RED_CLOSE.length },
          ],
          range: EditorSelection.range(range.from - RED_OPEN.length, range.to - RED_OPEN.length),
        };
      }
      // 선택 영역 안이 통째로 빨간 글씨면 해제
      const inner = text.match(/^<span class="red">([\s\S]*)<\/span>$/);
      if (inner && !inner[1].includes(RED_OPEN)) {
        return { changes: { from: range.from, to: range.to, insert: inner[1] }, range: EditorSelection.range(range.from, range.from + inner[1].length) };
      }
      if (range.empty) {
        return { changes: { from: range.from, insert: RED_OPEN + RED_CLOSE }, range: EditorSelection.cursor(range.from + RED_OPEN.length) };
      }
      // 줄마다 감쌈 (마크다운은 여러 줄에 걸친 태그를 잘 못 읽어서). 목록 기호·들여쓰기는 밖에 둠
      const wrapped = text
        .split("\n")
        .map((line) => {
          const m = line.match(/^(\s*(?:[-*+]\s+(?:\[[ xX]\]\s+)?|\d+[.)]\s+|#{1,6}\s+|>\s*)?)(.*?)(\s*)$/);
          if (!m || !m[2]) return line;
          return `${m[1]}${RED_OPEN}${m[2]}${RED_CLOSE}${m[3]}`;
        })
        .join("\n");
      return { changes: { from: range.from, to: range.to, insert: wrapped }, range: EditorSelection.range(range.from, range.from + wrapped.length) };
    }),
  );
  view.focus();
  return true;
}

/** 굵게/기울임 토글: 선택 영역을 마커로 감쌈 */
function wrap(marker: string) {
  return (view: EditorView) => {
    view.dispatch(
      view.state.changeByRange((range) => ({
        changes: [
          { from: range.from, insert: marker },
          { from: range.to, insert: marker },
        ],
        range: EditorSelection.range(range.from + marker.length, range.to + marker.length),
      })),
    );
    return true;
  };
}

/**
 * Obsidian 스타일 마크다운 에디터.
 * - "## 제목" → 큰 글씨 제목, "- [ ] 할 일" → 체크박스, "**굵게**", "`코드`", "> 인용", "---"
 * - 리스트/체크박스에서 Enter 치면 다음 줄에 자동으로 이어짐
 * - Ctrl+B 굵게, Ctrl+I 기울임, Tab 들여쓰기
 */
export default function LiveMarkdownEditor({ value, onChange, placeholder, minHeight = 160, autoFocus, toolbar = false }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (!hostRef.current) return;
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          markdown({ base: markdownLanguage }),
          // Tab 들여쓰기를 4칸으로 (2칸은 목차 단계가 잘 안 보였음)
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          keymap.of([
            { key: "Mod-b", run: wrap("**") },
            { key: "Mod-i", run: wrap("*") },
            { key: "Mod-Shift-r", run: toggleRed },
            indentWithTab,
            ...defaultKeymap,
            ...historyKeymap,
          ]),
          EditorView.lineWrapping,
          cmPlaceholder(placeholder ?? ""),
          livePreviewPlugin,
          livePreviewTheme,
          EditorView.updateListener.of((u) => {
            if (u.docChanged) onChangeRef.current(u.state.doc.toString());
          }),
        ],
      }),
    });
    viewRef.current = view;
    if (autoFocus) view.focus();
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // 에디터는 한 번만 만들고, 이후 value 변경은 아래 effect 에서 동기화
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 바깥에서 value 가 바뀐 경우(모달 열 때 등)만 에디터에 반영
  useEffect(() => {
    const view = viewRef.current;
    if (view && view.state.doc.toString() !== value) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
    }
  }, [value]);

  const editor = <div ref={hostRef} className="cursor-text" style={{ minHeight }} onClick={() => viewRef.current?.focus()} />;
  if (!toolbar) return editor;
  return (
    <div>
      <div className="sticky top-0 z-10 -mx-1 mb-1 flex items-center gap-1 bg-surface px-1 py-1">
        <button
          type="button"
          // 버튼을 눌러도 에디터 선택 영역이 풀리지 않게
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => viewRef.current && toggleRed(viewRef.current)}
          title="빨간 글씨 (드래그한 뒤 누르기 · Ctrl+Shift+R)"
          aria-label="빨간 글씨"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-xs font-semibold text-ink-2 transition-colors hover:border-[#e5484d] hover:text-ink"
        >
          <span className="text-base font-extrabold leading-none text-[#e5484d] underline decoration-[#e5484d] decoration-2 underline-offset-2">A</span>
          빨간 글씨
        </button>
      </div>
      {editor}
    </div>
  );
}
