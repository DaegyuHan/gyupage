import fs from "node:fs";
import path from "node:path";
import { Marked } from "marked";

/**
 * content/history 폴더의 .md 파일을 읽어서 정리해 주는 모듈.
 *
 * 파일 맨 위에 frontmatter 를 쓰면 그걸 쓰고, 없으면 알아서 추측함:
 *   ---
 *   title: 결제 시스템 개편
 *   date: 2024-03-01
 *   company: OO회사
 *   tags: [backend, 결제]
 *   ---
 * - title 없으면 → 첫 번째 "# 제목" → 그것도 없으면 파일명
 * - date 없으면 → 파일명 앞의 2024-03-01 / 20240301 / 2024-03 → 그것도 없으면 '날짜 없음'
 */
const HISTORY_DIR = path.join(process.cwd(), "content", "history");

export interface HistoryDoc {
  slug: string;
  title: string;
  /** YYYY-MM-DD 또는 YYYY-MM, 없으면 "" */
  date: string;
  company?: string;
  tags: string[];
  excerpt: string;
  content: string;
}

export interface Heading {
  id: string;
  text: string;
  depth: number;
}

export function parseFrontmatter(raw: string): { data: Record<string, string | string[]>; body: string } {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return { data: {}, body: raw.replace(/^﻿/, "") };
  const data: Record<string, string | string[]> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    let val = kv[2].trim();
    if (val.startsWith("[") && val.endsWith("]")) {
      data[key] = val
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    } else {
      val = val.replace(/^["']|["']$/g, "");
      data[key] = key === "tags" ? val.split(",").map((s) => s.trim()).filter(Boolean) : val;
    }
  }
  return { data, body: raw.slice(m[0].length) };
}

export function dateFromFilename(name: string): string {
  let m = name.match(/^(\d{4})[-_.]?(\d{2})[-_.]?(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = name.match(/^(\d{4})[-_.](\d{2})(?!\d)/);
  if (m) return `${m[1]}-${m[2]}`;
  return "";
}

function normalizeDate(v: string): string {
  const m = v.match(/(\d{4})[-./](\d{1,2})(?:[-./](\d{1,2}))?/);
  if (!m) return "";
  const mm = m[2].padStart(2, "0");
  return m[3] ? `${m[1]}-${mm}-${m[3].padStart(2, "0")}` : `${m[1]}-${mm}`;
}

function makeExcerpt(body: string): string {
  const text = body
    .replace(/```[\s\S]*?```/g, "")
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/!\[[^\]]*]\([^)]*\)/g, "")
    .replace(/\[([^\]]+)]\([^)]*\)/g, "$1")
    .replace(/^\s*(>|[-*+]|\d+\.)\s+/gm, "")
    .replace(/[*_`|]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > 140 ? `${text.slice(0, 140)}…` : text;
}

export function parseDoc(filename: string, raw: string): HistoryDoc {
  const base = filename.replace(/\.md$/i, "");
  const { data, body } = parseFrontmatter(raw);
  const h1 = body.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fallbackTitle = base.replace(/^\d{4}[-_.]?\d{2}([-_.]?\d{2})?[-_ ]*/, "").replace(/[-_]+/g, " ").trim() || base;
  const tags = data.tags;

  return {
    slug: base,
    title: (data.title as string) || h1 || fallbackTitle,
    date: data.date ? normalizeDate(data.date as string) : dateFromFilename(base),
    company: (data.company as string) || undefined,
    tags: Array.isArray(tags) ? tags : tags ? [tags] : [],
    excerpt: (data.summary as string) || makeExcerpt(body),
    content: body,
  };
}

export function getAllHistory(): HistoryDoc[] {
  if (!fs.existsSync(HISTORY_DIR)) return [];
  return fs
    .readdirSync(HISTORY_DIR)
    .filter((f) => f.toLowerCase().endsWith(".md") && !f.startsWith("_"))
    .map((f) => parseDoc(f, fs.readFileSync(path.join(HISTORY_DIR, f), "utf8")))
    .sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
}

export function getHistory(slug: string): HistoryDoc | undefined {
  return getAllHistory().find((d) => d.slug === slug || d.slug.normalize("NFC") === slug.normalize("NFC"));
}

/** 연도별 묶음 (최신 연도 먼저) */
export function groupByYear(docs: HistoryDoc[]): [string, HistoryDoc[]][] {
  const map = new Map<string, HistoryDoc[]>();
  for (const d of docs) {
    const y = d.date ? d.date.slice(0, 4) : "날짜 없음";
    if (!map.has(y)) map.set(y, []);
    map.get(y)!.push(d);
  }
  return [...map.entries()];
}

function slugifyHeading(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/<[^>]+>/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "") || "section"
  );
}

/** markdown → html, 그리고 목차(h2/h3) */
export function renderMarkdown(md: string): { html: string; headings: Heading[] } {
  const headings: Heading[] = [];
  const used = new Map<string, number>();
  // 본문 첫 h1 은 페이지 제목과 겹치므로 제거
  const body = md.replace(/^\s*#\s+.+\r?\n/, "");

  const marked = new Marked({ gfm: true, breaks: true });
  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens);
        const plain = text.replace(/<[^>]+>/g, "");
        let id = slugifyHeading(plain);
        const n = used.get(id) ?? 0;
        used.set(id, n + 1);
        if (n > 0) id = `${id}-${n}`;
        if (depth === 2 || depth === 3) headings.push({ id, text: plain, depth });
        return `<h${depth} id="${id}">${text}</h${depth}>\n`;
      },
    },
  });

  const html = marked.parse(body, { async: false }) as string;
  return { html, headings };
}
