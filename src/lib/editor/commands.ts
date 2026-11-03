/** 마크다운 편집기 명령 (굵게·빨간 글씨·들여쓰기) */
import { EditorSelection, type ChangeSpec } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";

const INDENT = 4;

/** Shift+Tab: 선택한 줄마다 앞 공백을 4칸(한 단계)씩 뺌 */
export function outdent(view: EditorView) {
  const { state } = view;
  const changes: ChangeSpec[] = [];
  const seen = new Set<number>();
  for (const r of state.selection.ranges) {
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(r.to).number; n++) {
      if (seen.has(n)) continue;
      seen.add(n);
      const line = state.doc.line(n);
      const lead = /^[ \t]*/.exec(line.text)![0];
      if (!lead) continue;
      // 탭이면 하나, 공백이면 최대 4칸 (앞 단계 경계에 맞춤)
      const cut = lead[0] === "\t" ? 1 : lead.length % INDENT || Math.min(INDENT, lead.length);
      changes.push({ from: line.from, to: line.from + cut });
    }
  }
  if (!changes.length) return true;
  view.dispatch({ changes, userEvent: "delete.dedent" });
  return true;
}

/**
 * Backspace: 들여쓰기 안이나 목록 기호 바로 뒤에서 누르면 한 단계(4칸)씩 내어씀
 * 그 밖은 원래 동작 (false 를 돌려서 다음 키맵으로 넘김)
 */
export function backspaceIndent(view: EditorView) {
  const { state } = view;
  const r = state.selection.main;
  if (!r.empty || state.selection.ranges.length > 1) return false;
  const line = state.doc.lineAt(r.head);
  const before = line.text.slice(0, r.head - line.from);
  // ① 커서 앞이 공백뿐
  if (/^ +$/.test(before)) {
    const cut = before.length % INDENT || INDENT;
    view.dispatch({ changes: { from: r.head - Math.min(cut, before.length), to: r.head }, userEvent: "delete.dedent" });
    return true;
  }
  // ② 들여쓴 목록 기호 바로 뒤 ("    - |", "    - [ ] |", "    1. |") → 기호는 두고 들여쓰기만 한 단계 줄임
  const m = /^( +)(?:[-*+]|\d+[.)]) (?:\[[ xX]\] )?$/.exec(before);
  if (m) {
    const cut = m[1].length % INDENT || Math.min(INDENT, m[1].length);
    view.dispatch({ changes: { from: line.from, to: line.from + cut }, userEvent: "delete.dedent" });
    return true;
  }
  return false;
}

const RED_OPEN = '<span class="red">';
const RED_CLOSE = "</span>";

/** 선택한 글자를 빨간 글씨로 (이미 빨간색이면 해제). 여러 줄이면 줄마다 감쌈 */
export function toggleRed(view: EditorView) {
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
      // 선택 영역이 한 줄 안의 빨간 글씨 안쪽에 들어 있으면 그 빨간 글씨 전체를 해제
      const line = state.doc.lineAt(range.from);
      if (range.to <= line.to) {
        for (const m of line.text.matchAll(/<span class="red">(.*?)<\/span>/g)) {
          const s = line.from + m.index!;
          const open = s + RED_OPEN.length;
          const close = open + m[1].length;
          if (range.from >= open && range.to <= close && !(range.from === open && range.to === close && range.empty)) {
            return {
              changes: [
                { from: s, to: open },
                { from: close, to: close + RED_CLOSE.length },
              ],
              range: EditorSelection.range(range.from - RED_OPEN.length, range.to - RED_OPEN.length),
            };
          }
        }
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
export function wrap(marker: string) {
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

