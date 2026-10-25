"use client";

import { useEffect, useRef } from "react";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { markdown, markdownLanguage } from "@codemirror/lang-markdown";
import { EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, keymap, placeholder as cmPlaceholder } from "@codemirror/view";
import { livePreviewPlugin, livePreviewTheme } from "@/lib/editor/livePreview";

interface Props {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  minHeight?: number;
  autoFocus?: boolean;
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
export default function LiveMarkdownEditor({ value, onChange, placeholder, minHeight = 160, autoFocus }: Props) {
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
          keymap.of([
            { key: "Mod-b", run: wrap("**") },
            { key: "Mod-i", run: wrap("*") },
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

  return (
    <div
      ref={hostRef}
      className="cursor-text"
      style={{ minHeight }}
      onClick={() => viewRef.current?.focus()}
    />
  );
}
