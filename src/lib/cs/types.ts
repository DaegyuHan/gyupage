/** 오늘의 CS: 매일 아침 AI 가 만들어 줄 글 한 편 */
export type CsCategory = "java" | "spring" | "os" | "network" | "db" | "ds" | "web" | "security" | "arch";

export interface CsQuiz {
  question: string;
  options: string[];
  /** 정답 options 인덱스 */
  answer: number;
  explain: string;
}

export interface CsNote {
  /** YYYY-MM-DD (KST) — 주소로도 씀 */
  date: string;
  /** 만든 모델과 토큰 사용량 (2026-11 부터 기록) */
  model?: string;
  usage?: { input: number; output: number };
  /** 몇 번째 글인지 */
  no: number;
  category: CsCategory;
  title: string;
  /** 홈 카드에 보이는 2~3줄 요약 */
  summary: string;
  /** 본문 (마크다운) */
  body: string;
  /** 실무에서 마주치는 상황 (마크다운) */
  practice: string;
  interview: {
    question: string;
    answer: string;
    /** 면접관이 이어서 물어볼 꼬리 질문 */
    followUps?: { question: string; answer: string }[];
  };
  quiz: CsQuiz;
  keywords: string[];
  /** 읽는 데 걸리는 시간(분) */
  minutes: number;
}

export const CS_CATEGORY: Record<CsCategory, { label: string; color: string }> = {
  java: { label: "Java·JVM", color: "#e76f00" },
  spring: { label: "Spring·JPA", color: "#4f9a2d" },
  os: { label: "운영체제", color: "#7c5cff" },
  network: { label: "네트워크", color: "#1f8fe5" },
  db: { label: "데이터베이스", color: "#0e9f6e" },
  ds: { label: "자료구조", color: "#e8590c" },
  web: { label: "웹", color: "#d6336c" },
  security: { label: "보안", color: "#c92a2a" },
  arch: { label: "설계", color: "#5c7cfa" },
};
