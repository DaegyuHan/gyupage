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
  java: "Java·JVM (언어 특성, 컬렉션, 동시성, GC, JVM 메모리 등)",
  spring: "Spring·JPA (IoC/DI, AOP, 트랜잭션, 영속성 컨텍스트, N+1, Spring Boot 등)",
  db: "데이터베이스 (인덱스, 트랜잭션 격리 수준, 락, 실행 계획, 정규화, MySQL/PostgreSQL)",
  network: "네트워크 (HTTP, TCP/IP, HTTPS/TLS, 로드밸런서, 커넥션 풀 등)",
  os: "운영체제 (프로세스/스레드, 동기화, 메모리, 컨텍스트 스위칭 등)",
  arch: "설계·아키텍처 (객체지향/SOLID, 레이어드·헥사고날, MSA, 캐시 전략, 메시지 큐 등)",
  security: "보안 (인증/인가, JWT·세션, OAuth2, SQL Injection, XSS/CSRF 등)",
  ds: "자료구조·알고리즘 (해시, 트리, 정렬, 시간 복잡도 — Java 구현 관점)",
  web: "웹·인프라 (REST API 설계, 캐시, CDN, Docker, CI/CD, 모니터링 등)",
};

/** 한국 시간 오늘 YYYY-MM-DD */
function kstToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/**
 * 요일별 분야 (Java 백엔드 2년차 기준)
 * 월 Java·JVM · 화 Spring·JPA · 수 DB · 목 네트워크/OS 번갈아 · 금 설계/보안/자료구조/웹 돌아가며
 */
function categoryFor(date) {
  const d = new Date(`${date}T12:00:00+09:00`);
  const dow = d.getUTCDay();
  const week = Math.floor(d.getTime() / (7 * 86400_000));
  if (dow === 1) return "java";
  if (dow === 2) return "spring";
  if (dow === 3) return "db";
  if (dow === 4) return ["network", "os"][week % 2];
  return ["arch", "security", "ds", "web"][week % 4];
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
  return `너는 대기업·유니콘에서 Java/Spring 백엔드 면접관을 여러 번 해 본 시니어 개발자야.
독자는 **Java·Spring 으로 일하는 2년차 백엔드 개발자**이고, **이직 준비**도 하고 있어.
출근길 5분 안에 읽고 "이건 면접에서 이렇게 답하면 되겠구나"까지 정리되는 글을 한 편 써 줘.

오늘 분야: ${label}

조건
- 한국어, 부드러운 해요체.
- 주제는 **실제 이직 기술 면접(2~4년차 Java 백엔드)에서 자주 나오는 것** 위주로. 너무 기초(변수란?)나 너무 학술적인 것은 피해.
- 본문에 Java/Spring 코드 예시가 어울리면 짧게 넣어 (10줄 안팎, \`\`\`java 코드블록).
- "개념 → 왜 중요한지(실무) → 자주 하는 오해/함정" 흐름으로.
- 아래 지난 주제와 겹치지 않는 새 주제. 비슷한 주제의 다른 각도도 피해.
- body: 마크다운, "## 소제목" 2~4개, 필요하면 표. 800~1300자.
- practice: 실무에서 마주치는 상황 3개를 "- " 목록으로 (장애·성능·코드 리뷰 상황 등 구체적으로).
- interview: 이 주제로 **이직 면접에서 실제로 받을 법한 질문** 1개와 모범 답안(4~6문장, 면접에서 말하듯이 결론 먼저).
  followUps: 면접관이 이어서 물어볼 **꼬리 질문 2개**와 각각의 짧은 모범 답안(2~4문장).
- quiz: 보기 4개짜리 객관식 1문제. answer 는 정답 보기의 0부터 시작하는 번호.
- keywords: 같이 찾아보면 좋은 키워드 4~6개.
- summary: 홈 카드에 보일 2~3문장 요약 (150자 안팎).
- minutes: 읽는 데 걸리는 분(3~6).

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
  "interview": {
    "question": "...",
    "answer": "...",
    "followUps": [{ "question": "...", "answer": "..." }, { "question": "...", "answer": "..." }]
  },
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
  // 꼬리 질문은 있으면 정리, 없어도 됨
  const f = Array.isArray(n.interview.followUps) ? n.interview.followUps : [];
  n.interview.followUps = f.filter((x) => x && x.question && x.answer).slice(0, 3);
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
