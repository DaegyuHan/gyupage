"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { indentUnit } from "@codemirror/language";
import { EditorState, Prec } from "@codemirror/state";
import { backspaceIndent, outdent, toggleRed, wrap } from "@/lib/editor/commands";
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
          // 마크다운 기본 Backspace 보다 먼저: 들여쓰기는 4칸씩 지움
          Prec.highest(keymap.of([{ key: "Backspace", run: backspaceIndent }, { key: "Shift-Tab", run: outdent }])),
          markdown({ base: markdownLanguage }),
          // Tab 들여쓰기를 4칸으로 (2칸은 목차 단계가 잘 안 보였음)
          indentUnit.of("    "),
          EditorState.tabSize.of(4),
          keymap.of([
            { key: "Mod-b", run: wrap("**") },
            { key: "Mod-i", run: wrap("*") },
            // Ctrl+R: 드래그한 글자를 빨간 글씨로 / 다시 누르면 원래대로 (편집 중엔 새로고침 대신)
            { key: "Mod-r", run: toggleRed, preventDefault: true },
            { key: "Mod-Shift-r", run: toggleRed, preventDefault: true },
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
          title="빨간 글씨 (Ctrl+R)"
          aria-label="빨간 글씨"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line transition-colors hover:border-[#e5484d]"
        >
          <span className="text-base font-extrabold leading-none text-[#e5484d] underline decoration-[#e5484d] decoration-2 underline-offset-2">A</span>
        </button>
      </div>
      {editor}
    </div>
  );
}
