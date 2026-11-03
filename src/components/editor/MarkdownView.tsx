"use client";

import { useMemo } from "react";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: true });
marked.use({
  renderer: {
    // 체크박스를 클릭 가능하게 (data-task 로 표시)
    checkbox({ checked }) {
      return `<input type="checkbox" data-task${checked ? " checked" : ""}> `;
    },
  },
});

// [글자] 또는 줄 앞에 '[' 만 붙인 줄 → 편집기처럼 파란 밑줄 강조 (링크 [글자](주소) 는 그대로)
marked.use({
  extensions: [
    {
      name: "bracket",
      level: "inline",
      start(src: string) {
        const i = src.indexOf("[");
        return i < 0 ? undefined : i;
      },
      tokenizer(src: string) {
        const m = /^\[(?![ xX]\])([^\]\n]+)\](?![(\[:])/.exec(src) ?? /^\[(?![ xX]\])([^\]\n]+)(?=\n|$)/.exec(src);
        if (!m) return undefined;
        return { type: "bracket", raw: m[0], text: m[1], tokens: this.lexer.inlineTokens(m[1]) };
      },
      renderer(token) {
        return `<span class="bk">${this.parser.parseInline(token.tokens ?? [])}</span>`;
      },
    },
  ],
});

/** 마크다운 본문에서 index 번째 체크박스를 토글한 새 문자열 */
export function toggleTask(md: string, index: number): string {
  let i = 0;
  return md.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)([ xX])(\])/gm, (m, a: string, mark: string, b: string) =>
    i++ === index ? `${a}${mark === " " ? "x" : " "}${b}` : m,
  );
}

interface Props {
  source: string;
  /** 체크박스 클릭 시 토글된 새 마크다운 */
  onChange?: (next: string) => void;
  className?: string;
}

export default function MarkdownView({ source, onChange, className = "" }: Props) {
  // 글 바로 아래 '---' 도 제목 밑줄이 아니라 구분선으로 (편집기와 같게)
  const html = useMemo(() => marked.parse(source.replace(/([^\n])\n([ \t]*-{3,}[ \t]*)(?=\n|$)/g, "$1\n\n$2"), { async: false }) as string, [source]);

  return (
    <div
      className={`prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:mb-1 prose-headings:mt-3 prose-p:my-1 prose-ul:my-1 prose-li:my-0 [&_li:has(>input)]:list-none [&_li>input]:mr-1 [&_span.red]:text-[#e5484d] [&_.bk]:text-accent [&_.bk]:underline [&_.bk]:underline-offset-2 [&_hr]:my-3 [&_hr]:border-line ${className}`}
      onClick={(e) => {
        const t = e.target as HTMLElement;
        if (t instanceof HTMLInputElement && t.dataset.task !== undefined) {
          e.stopPropagation();
          if (!onChange) {
            e.preventDefault();
            return;
          }
          const boxes = Array.from(e.currentTarget.querySelectorAll("input[data-task]"));
          onChange(toggleTask(source, boxes.indexOf(t)));
        }
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
