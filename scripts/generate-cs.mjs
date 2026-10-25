#!/usr/bin/env node
/**
 * Daily CS 글 만들기 — 평일 아침 GitHub Actions 가 실행 (.github/workflows/daily-cs.yml)
 *
 *   ANTHROPIC_API_KEY=... node scripts/generate-cs.mjs           오늘(한국 시간) 글
 *   ANTHROPIC_API_KEY=... node scripts/generate-cs.mjs 2026-10-27  특정 날짜 글
 *
 * content/cs/YYYY-MM-DD.md 로 저장. 그날 글이 이미 있으면 아무것도 안 함.
 * 요일마다 분야를 돌리고, 지난 글 제목을 넘겨서 주제가 겹치지 않게 함.
 */
import fs from "node:fs";
import path from "node:path";

const MODEL = process.env.CS_MODEL || "claude-sonnet-5-5";
const DIR = path.join(process.cwd(), "content", "cs");

const CATEGORIES = {
  os: "운영체제",
  network: "네트워크",
  db: "데이터베이스",
  ds: "자료구조·알고리즘",
  web: "웹",
  security: "보안",
  arch: "설계·아키텍처",
};

/** 한국 시간 오늘 YYYY-MM-DD */
function kstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** 요일별 분야: 월 OS · 화 네트워크 · 수 DB · 목 자료구조 · 금 웹/보안/설계 번갈아 */
function categoryFor(date) {
  const d = new Date(`${date}T12:00:00+09:00`);
  const dow = d.getUTCDay();
  const byDay = { 1: "os", 2: "network", 3: "db", 4: "ds" };
  if (byDay[dow]) return byDay[dow];
  const week = Math.floor(d.getTime() / (7 * 86400_000));
  return ["web", "security", "arch"][week % 3];
}

function readExisting() {
  if (!fs.existsSync(DIR)) return [];
  return fs
    .readdirSync(DIR)
    .filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f))
    .sort()
    .map((f) => {
      const raw = fs.readFileSync(path.join(DIR, f), "utf8");
      const title = raw.match(/^title:\s*(.*)$/m)?.[1];
      const no = Number(raw.match(/^no:\s*(\d+)/m)?.[1] ?? 0);
      let t = title ?? "";
      try {
        t = JSON.parse(t);
      } catch {}
      return { date: f.slice(0, 10), title: t, no };
    });
}

function buildPrompt(category, previous) {
  const label = CATEGORIES[category];
  const prevList = previous.length ? previous.map((p) => `- ${p.title}`).join("\n") : "(아직 없음)";
  return `너는 시니어 백엔드 개발자이자 친절한 멘토야. 2년차 개발자가 출근길 5분 안에 읽고 "아, 그래서 그렇구나" 할 수 있는 CS 글을 한 편 써 줘.

오늘 분야: ${label}

조건
- 한국어, 존댓말 대신 부드러운 해요체.
- 이론만 나열하지 말고 "실무에서 왜 중요한지"가 꼭 들어가게.
- 너무 기초(변수란 무엇인가)도, 너무 학술적인 것(논문 수준)도 피하고 2년차가 면접이나 실무에서 마주칠 수준으로.
- 아래 지난 주제와 겹치지 않는 새 주제를 골라. 비슷한 주제의 다른 각도도 피해.
- 본문(body)은 마크다운. "## 소제목" 2~4개, 필요하면 표나 짧은 코드 블록. 700~1200자 정도.
- practice 는 실무에서 마주치는 상황 3개를 "- " 목록으로.
- interview 는 이 주제로 면접에서 나올 만한 질문 1개와 모범 답안(3~5문장).
- quiz 는 보기 4개짜리 객관식 1문제. answer 는 정답 보기의 0부터 시작하는 번호.
- keywords 는 같이 찾아보면 좋은 키워드 4~6개.
- summary 는 홈 카드에 보일 2~3문장 요약 (150자 안팎).
- minutes 는 읽는 데 걸리는 분(3~6).

지난 주제
${prevList}

출력은 아래 JSON 하나만. 설명이나 코드펜스 없이.
{
  "title": "질문형이나 호기심을 끄는 제목 (40자 이내)",
  "summary": "...",
  "minutes": 4,
  "keywords": ["...", "..."],
  "body": "## ...\\n...",
  "practice": "- ...\\n- ...\\n- ...",
  "interview": { "question": "...", "answer": "..." },
  "quiz": { "question": "...", "options": ["...", "...", "...", "..."], "answer": 0, "explain": "..." }
}`;
}

async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 가 없어요");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODEL, max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  const j = JSON.parse(text);
  return j.content.filter((c) => c.type === "text").map((c) => c.text).join("");
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end < start) throw new Error("JSON 을 찾지 못했어요");
  return JSON.parse(text.slice(start, end + 1));
}

function validate(n) {
  const ok =
    typeof n.title === "string" &&
    typeof n.summary === "string" &&
    typeof n.body === "string" &&
    typeof n.practice === "string" &&
    n.interview?.question &&
    n.interview?.answer &&
    n.quiz?.question &&
    Array.isArray(n.quiz?.options) &&
    n.quiz.options.length >= 2 &&
    Number.isInteger(n.quiz?.answer) &&
    n.quiz.answer >= 0 &&
    n.quiz.answer < n.quiz.options.length &&
    Array.isArray(n.keywords);
  if (!ok) throw new Error("필요한 항목이 빠졌어요");
  return n;
}

function toMarkdown(date, no, category, n) {
  const j = (v) => JSON.stringify(v);
  return `---
no: ${no}
category: ${j(category)}
title: ${j(n.title.trim())}
summary: ${j(n.summary.trim())}
minutes: ${Math.min(10, Math.max(2, Number(n.minutes) || 4))}
keywords: ${j(n.keywords.slice(0, 6))}
interview: ${j(n.interview)}
quiz: ${j(n.quiz)}
model: ${j(MODEL)}
---
${n.body.trim()}

<!-- practice -->
${n.practice.trim()}
`;
}

async function main() {
  const date = process.argv[2] || kstToday();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error(`날짜 형식이 이상해요: ${date}`);
  const dow = new Date(`${date}T12:00:00+09:00`).getUTCDay();
  if (!process.argv[2] && (dow === 0 || dow === 6)) {
    console.log(`${date} 는 주말이라 쉬어요`);
    return;
  }

  fs.mkdirSync(DIR, { recursive: true });
  const file = path.join(DIR, `${date}.md`);
  if (fs.existsSync(file)) {
    console.log(`${date} 글이 이미 있어요`);
    return;
  }

  const existing = readExisting();
  const category = categoryFor(date);
  const no = existing.reduce((m, e) => Math.max(m, e.no), 0) + 1;
  // 최근 80개 제목만 넘김 (프롬프트가 너무 길어지지 않게)
  const prompt = buildPrompt(category, existing.slice(-80));

  let lastErr;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const note = validate(extractJson(await callClaude(prompt)));
      fs.writeFileSync(file, toMarkdown(date, no, category, note), "utf8");
      console.log(`✓ ${date} No.${no} [${CATEGORIES[category]}] ${note.title}`);
      return;
    } catch (e) {
      lastErr = e;
      console.warn(`시도 ${attempt} 실패: ${e.message}`);
    }
  }
  throw lastErr;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
