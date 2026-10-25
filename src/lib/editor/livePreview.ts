/**
 * Obsidian 'Live Preview' 비슷한 동작을 CodeMirror 6 으로 구현.
 *
 * - 커서가 있는 줄: 마크다운 원문(##, **, [ ] 등)이 그대로 보임
 * - 커서가 없는 줄: 기호는 숨기고 서식만 보임 (제목 크게, 굵게, 체크박스 등)
 */
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Range } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  EditorView,
  ViewPlugin,
  type ViewUpdate,
  WidgetType,
} from "@codemirror/view";

class CheckboxWidget extends WidgetType {
  constructor(
    readonly checked: boolean,
    /** "[ ]" 의 '[' 위치 */
    readonly pos: number,
  ) {
    super();
  }
  eq(other: CheckboxWidget) {
    return other.checked === this.checked && other.pos === this.pos;
  }
  toDOM(view: EditorView) {
    const box = document.createElement("input");
    box.type = "checkbox";
    box.checked = this.checked;
    box.className = "cm-lp-checkbox";
    box.addEventListener("mousedown", (e) => {
      e.preventDefault();
      view.dispatch({
        changes: { from: this.pos + 1, to: this.pos + 2, insert: this.checked ? " " : "x" },
      });
    });
    return box;
  }
}

class BulletWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-lp-bullet";
    s.textContent = "•";
    return s;
  }
}

class HrWidget extends WidgetType {
  eq() {
    return true;
  }
  toDOM() {
    const s = document.createElement("span");
    s.className = "cm-lp-hr";
    return s;
  }
}

const hide = Decoration.replace({});
const bullet = Decoration.replace({ widget: new BulletWidget() });
const hr = Decoration.replace({ widget: new HrWidget() });

/** 커서/선택 영역이 걸친 줄 번호들 */
function activeLines(state: EditorState): Set<number> {
  const lines = new Set<number>();
  for (const r of state.selection.ranges) {
    const a = state.doc.lineAt(r.from).number;
    const b = state.doc.lineAt(r.to).number;
    for (let n = a; n <= b; n++) lines.add(n);
  }
  return lines;
}

function build(view: EditorView): DecorationSet {
  const { state } = view;
  const doc = state.doc;
  const active = view.hasFocus ? activeLines(state) : new Set<number>();
  const decos: Range<Decoration>[] = [];
  const isActive = (pos: number) => active.has(doc.lineAt(pos).number);
  const lineClass = (pos: number, cls: string) =>
    decos.push(Decoration.line({ class: cls }).range(doc.lineAt(pos).from));
  /** from~to 를 숨기되, 뒤에 공백 하나 있으면 같이 숨김 */
  const hideWithSpace = (from: number, to: number) => {
    const end = doc.sliceString(to, to + 1) === " " ? to + 1 : to;
    decos.push(hide.range(from, end));
  };

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        const name = node.name;
        const parent = node.node.parent?.name ?? "";

        // 제목: # ~ ######
        const h = /^ATXHeading(\d)$/.exec(name);
        if (h) {
          lineClass(node.from, `cm-lp-h cm-lp-h${h[1]}`);
          return;
        }
        if (name === "HeaderMark" && parent.startsWith("ATXHeading")) {
          if (!isActive(node.from)) hideWithSpace(node.from, node.to);
          else decos.push(Decoration.mark({ class: "cm-lp-mark" }).range(node.from, node.to));
          return;
        }

        // 인라인 서식
        if (name === "StrongEmphasis") decos.push(Decoration.mark({ class: "cm-lp-strong" }).range(node.from, node.to));
        if (name === "Emphasis") decos.push(Decoration.mark({ class: "cm-lp-em" }).range(node.from, node.to));
        if (name === "Strikethrough") decos.push(Decoration.mark({ class: "cm-lp-strike" }).range(node.from, node.to));
        if (name === "InlineCode") decos.push(Decoration.mark({ class: "cm-lp-code" }).range(node.from, node.to));
        if (
          name === "EmphasisMark" ||
          name === "StrikethroughMark" ||
          (name === "CodeMark" && parent === "InlineCode")
        ) {
          if (!isActive(node.from)) decos.push(hide.range(node.from, node.to));
          else decos.push(Decoration.mark({ class: "cm-lp-mark" }).range(node.from, node.to));
          return;
        }

        // 링크 [텍스트](url)
        if (name === "Link") {
          decos.push(Decoration.mark({ class: "cm-lp-link" }).range(node.from, node.to));
          if (!isActive(node.from)) {
            const n = node.node;
            for (let c = n.firstChild; c; c = c.nextSibling) {
              if (c.name === "LinkMark" || c.name === "URL") decos.push(hide.range(c.from, c.to));
            }
          }
          return false;
        }

        // 목록
        if (name === "ListMark") {
          const listItem = node.node.parent;
          const isTask = !!listItem?.getChild("Task");
          const isBullet = listItem?.parent?.name === "BulletList";
          if (!isActive(node.from)) {
            if (isTask) hideWithSpace(node.from, node.to);
            else if (isBullet) decos.push(bullet.range(node.from, node.to));
          }
          if (!isBullet && !isTask) decos.push(Decoration.mark({ class: "cm-lp-olmark" }).range(node.from, node.to));
          return;
        }

        // 체크박스 - [ ] / - [x]
        if (name === "TaskMarker") {
          const checked = /x/i.test(doc.sliceString(node.from, node.to));
          decos.push(
            Decoration.replace({ widget: new CheckboxWidget(checked, node.from) }).range(node.from, node.to),
          );
          if (checked) {
            const task = node.node.parent;
            if (task && node.to < task.to) {
              decos.push(Decoration.mark({ class: "cm-lp-done" }).range(node.to, task.to));
            }
          }
          return;
        }

        // 인용 >
        if (name === "Blockquote") {
          for (let p = node.from; p <= node.to; ) {
            const line = doc.lineAt(p);
            lineClass(line.from, "cm-lp-quote");
            p = line.to + 1;
          }
          return;
        }
        if (name === "QuoteMark") {
          if (!isActive(node.from)) hideWithSpace(node.from, node.to);
          return;
        }

        // 코드 블록 ```
        if (name === "FencedCode" || name === "CodeBlock") {
          for (let p = node.from; p <= node.to; ) {
            const line = doc.lineAt(p);
            lineClass(line.from, "cm-lp-codeblock");
            p = line.to + 1;
          }
          return false;
        }

        // 구분선 ---
        if (name === "HorizontalRule") {
          if (!isActive(node.from)) decos.push(hr.range(node.from, node.to));
          return;
        }
      },
    });
  }

  return Decoration.set(decos, true);
}

export const livePreviewPlugin = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;
    constructor(view: EditorView) {
      this.decorations = build(view);
    }
    update(u: ViewUpdate) {
      if (
        u.docChanged ||
        u.viewportChanged ||
        u.selectionSet ||
        u.focusChanged ||
        syntaxTree(u.startState) !== syntaxTree(u.state)
      ) {
        this.decorations = build(u.view);
      }
    }
  },
  { decorations: (v) => v.decorations },
);

export const livePreviewTheme = EditorView.theme({
  "&": { fontSize: "15px", backgroundColor: "transparent", color: "inherit" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "inherit", lineHeight: "1.75" },
  ".cm-content": { padding: "8px 0", caretColor: "var(--color-accent)" },
  ".cm-line": { padding: "0 2px" },
  ".cm-placeholder": { color: "var(--color-ink-3)" },
  ".cm-cursor": { borderLeftColor: "var(--color-accent)", borderLeftWidth: "2px" },
  "&.cm-focused .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--color-accent-soft) !important",
  },

  ".cm-lp-h": { fontWeight: "700", lineHeight: "1.35" },
  ".cm-lp-h1": { fontSize: "1.6em", paddingTop: "6px" },
  ".cm-lp-h2": { fontSize: "1.35em", paddingTop: "4px" },
  ".cm-lp-h3": { fontSize: "1.18em", paddingTop: "2px" },
  ".cm-lp-h4": { fontSize: "1.05em" },
  ".cm-lp-h5, .cm-lp-h6": { fontSize: "1em", color: "var(--muted)" },
  ".cm-lp-mark": { color: "var(--muted)", opacity: "0.7" },

  ".cm-lp-strong": { fontWeight: "700" },
  ".cm-lp-em": { fontStyle: "italic" },
  ".cm-lp-strike": { textDecoration: "line-through" },
  ".cm-lp-code": {
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "0.9em",
    background: "rgba(127,127,127,0.15)",
    borderRadius: "4px",
    padding: "1px 4px",
  },
  ".cm-lp-link": { color: "var(--color-accent)", textDecoration: "underline", textUnderlineOffset: "2px" },

  ".cm-lp-bullet": { display: "inline-block", width: "1em", color: "var(--muted)" },
  ".cm-lp-olmark": { color: "var(--muted)" },
  ".cm-lp-checkbox": {
    width: "15px",
    height: "15px",
    margin: "0 6px 0 0",
    verticalAlign: "-2px",
    cursor: "pointer",
    accentColor: "var(--color-accent)",
  },
  ".cm-lp-done": { color: "var(--color-ink-3)", textDecoration: "line-through" },

  ".cm-lp-quote": { borderLeft: "3px solid var(--line)", paddingLeft: "12px !important", color: "var(--muted)" },
  ".cm-lp-codeblock": {
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace",
    fontSize: "0.9em",
    background: "rgba(127,127,127,0.1)",
  },
  ".cm-lp-hr": {
    display: "inline-block",
    width: "100%",
    borderTop: "1px solid var(--line)",
    verticalAlign: "middle",
  },
});
