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
  const html = useMemo(() => marked.parse(source, { async: false }) as string, [source]);

  return (
    <div
      className={`prose prose-sm prose-neutral max-w-none dark:prose-invert prose-headings:mb-1 prose-headings:mt-3 prose-p:my-1 prose-ul:my-1 prose-li:my-0 [&_li:has(>input)]:list-none [&_li>input]:mr-1 ${className}`}
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
