/**
 * Daily CS 글 읽기 (서버 전용)
 * - content/cs/YYYY-MM-DD.md 를 읽음. 평일 아침 GitHub Actions 가 scripts/generate-cs.mjs 로 만들어 올림.
 * - 아직 글이 하나도 없으면 예시 글(sample.ts)을 보여줌.
 *
 * 파일 형식:
 *   ---
 *   no: 12
 *   category: network
 *   title: "TCP 3-way handshake는 왜 3번일까?"
 *   summary: "..."
 *   minutes: 4
 *   keywords: ["SYN", "ACK"]
 *   interview: {"question": "...", "answer": "..."}
 *   quiz: {"question": "...", "options": ["..."], "answer": 2, "explain": "..."}
 *   ---
 *   본문 마크다운
 *   <!-- practice -->
 *   실무에서는 (마크다운)
 */
import fs from "node:fs";
import path from "node:path";
import { SAMPLE_NOTES } from "./sample";
import { CS_CATEGORY, type CsCategory, type CsNote } from "./types";

export * from "./types";

const DIR = path.join(process.cwd(), "content", "cs");

function parse(file: string, raw: string): CsNote | null {
  const m = raw.match(/^﻿?---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!m) return null;
  const data: Record<string, unknown> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const kv = line.match(/^\s*([\w-]+)\s*:\s*(.*)$/);
    if (!kv) continue;
    const v = kv[2].trim();
    try {
      // 값은 JSON 으로 씀 (문자열은 따옴표, 객체·배열 그대로)
      data[kv[1]] = JSON.parse(v);
    } catch {
      data[kv[1]] = v;
    }
  }
  const [body, practice = ""] = raw.slice(m[0].length).split(/<!--\s*practice\s*-->/);
  const date = file.replace(/\.md$/, "");
  const category = (String(data.category) in CS_CATEGORY ? data.category : "arch") as CsCategory;
  const interview = data.interview as CsNote["interview"] | undefined;
  const quiz = data.quiz as CsNote["quiz"] | undefined;
  if (!data.title || !interview || !quiz) return null;
  return {
    date,
    no: Number(data.no) || 0,
    category,
    title: String(data.title),
    summary: String(data.summary ?? ""),
    minutes: Number(data.minutes) || 4,
    keywords: Array.isArray(data.keywords) ? (data.keywords as string[]) : [],
    body: body.trim(),
    practice: practice.trim(),
    interview,
    quiz,
  };
}

function readAll(): CsNote[] {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .map((f) => {
      try {
        return parse(f, fs.readFileSync(path.join(DIR, f), "utf8"));
      } catch {
        return null;
      }
    })
    .filter((n): n is CsNote => !!n);
}

/** 진짜 글이 하나도 없으면 예시 글 */
export function isCsSample() {
  return readAll().length === 0;
}

/** 최신 글이 맨 앞 */
export function getCsNotes(): CsNote[] {
  const real = readAll();
  return (real.length ? real : SAMPLE_NOTES).slice().sort((a, b) => b.date.localeCompare(a.date));
}

export function getCsNote(date: string) {
  const all = getCsNotes();
  const i = all.findIndex((n) => n.date === date);
  if (i < 0) return null;
  // 목록이 최신순이라 '이전 글'은 뒤쪽, '다음 글'은 앞쪽
  return { note: all[i], prev: all[i + 1] ?? null, next: all[i - 1] ?? null };
}
