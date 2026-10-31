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

다 쓰면 save_note 도구로 제출해. (body·practice 는 마크다운 문자열 그대로, 코드블록도 그대로 넣으면 돼)`;
}

/**
 * 글은 '도구 호출' 형태로 받음 → API 가 JSON 구조를 보장해 줘서
 * 본문에 Java 코드(따옴표·줄바꿈)가 들어가도 JSON 이 깨지지 않음
 */
const STR = { type: "string" };
// 중첩 객체를 문자열로 뭉쳐 보내는 일이 있어서, 모든 칸을 맨 위 한 단계로 펼쳐서 받음
const NOTE_TOOL = {
  name: "save_note",
  description: "완성한 CS 글을 저장한다. 모든 칸을 각각 채운다.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: "string", description: "질문형이나 호기심을 끄는 제목 (40자 이내)" },
      summary: { type: "string", description: "홈 카드용 2~3문장 요약 (150자 안팎)" },
      minutes: { type: "integer", description: "읽는 데 걸리는 분 (3~6)" },
      keywords: { type: "array", items: STR, description: "같이 찾아보면 좋은 키워드 4~6개" },
      body: { type: "string", description: "본문 마크다운 (## 소제목 2~4개, 필요하면 ```java 코드블록)" },
      practice: { type: "string", description: "실무 상황 3개, '- ' 목록 마크다운" },
      interview_question: { type: "string", description: "이직 면접에서 실제로 받을 법한 질문" },
      interview_answer: { type: "string", description: "모범 답안 4~6문장, 결론 먼저" },
      followup1_question: { type: "string", description: "면접관의 꼬리 질문 1" },
      followup1_answer: { type: "string", description: "꼬리 질문 1 모범 답안 2~4문장" },
      followup2_question: { type: "string", description: "면접관의 꼬리 질문 2" },
      followup2_answer: { type: "string", description: "꼬리 질문 2 모범 답안 2~4문장" },
      quiz_question: { type: "string", description: "객관식 문제" },
      quiz_options: { type: "array", items: STR, description: "보기 4개" },
      quiz_answer: { type: "integer", description: "정답 보기의 0부터 시작하는 번호" },
      quiz_explain: { type: "string", description: "정답 해설" },
    },
    required: [
      "title", "summary", "minutes", "keywords", "body", "practice",
      "interview_question", "interview_answer", "followup1_question", "followup1_answer", "followup2_question", "followup2_answer",
      "quiz_question", "quiz_options", "quiz_answer", "quiz_explain",
    ],
  },
};

/** 펼쳐 받은 칸 → 글 파일에 쓰는 모양 */
function assemble(x) {
  const arr = (v) => (Array.isArray(v) ? v : typeof v === "string" ? (() => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : [v]; } catch { return v.split(/\n|,\s*/).filter(Boolean); } })() : []);
  return {
    title: x.title,
    summary: x.summary,
    minutes: x.minutes,
    keywords: arr(x.keywords),
    body: x.body,
    practice: x.practice,
    interview: {
      question: x.interview_question,
      answer: x.interview_answer,
      followUps: [
        { question: x.followup1_question, answer: x.followup1_answer },
        { question: x.followup2_question, answer: x.followup2_answer },
      ],
    },
    quiz: { question: x.quiz_question, options: arr(x.quiz_options), answer: Number(x.quiz_answer), explain: x.quiz_explain },
  };
}

async function callClaude(prompt) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new Error("ANTHROPIC_API_KEY 가 없어요");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 6000,
      // 이 모델은 도구 강제(tool_choice: tool)를 안 받아서 auto — 프롬프트에서 save_note 로 내라고 함
      tools: [NOTE_TOOL],
      messages: [{ role: "user", content: prompt }],
    }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Claude API ${res.status}: ${text.slice(0, 300)}`);
  const j = JSON.parse(text);
  const call = j.content.find((c) => c.type === "tool_use" && c.name === "save_note");
  if (!call) throw new Error(`도구 호출이 없어요 (stop_reason: ${j.stop_reason})`);
  if (j.stop_reason === "max_tokens") throw new Error("글이 너무 길어서 잘렸어요");
  const note = assemble(call.input);
  // 설정 > AI 사용량에서 비용 계산용
  note.usage = { input: j.usage?.input_tokens ?? 0, output: j.usage?.output_tokens ?? 0 };
  return note;
}

function validate(n) {
  const bad = [];
  if (typeof n.title !== "string" || !n.title.trim()) bad.push("title");
  if (typeof n.summary !== "string") bad.push("summary");
  if (typeof n.body !== "string") bad.push("body");
  if (typeof n.practice !== "string") bad.push("practice");
  if (!n.interview?.question || !n.interview?.answer) bad.push(`interview(${typeof n.interview})`);
  if (!n.quiz?.question || !Array.isArray(n.quiz?.options) || n.quiz.options.length < 2) bad.push("quiz");
  // 정답 번호가 "2" 처럼 문자열로 와도 받아 줌
  if (n.quiz && typeof n.quiz.answer === "string" && /^\d+$/.test(n.quiz.answer)) n.quiz.answer = Number(n.quiz.answer);
  if (!Number.isInteger(n.quiz?.answer) || n.quiz.answer < 0 || n.quiz.answer >= (n.quiz?.options?.length ?? 0)) bad.push("quiz.answer");
  if (!Array.isArray(n.keywords)) bad.push("keywords");
  if (bad.length) throw new Error(`필요한 항목이 빠졌어요: ${bad.join(", ")}`);
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
model: ${j(MODEL)}${n.usage ? `\nusage: ${j(n.usage)}` : ""}
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
      const note = validate(await callClaude(prompt));
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
