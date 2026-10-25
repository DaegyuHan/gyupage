import type { CategoryId } from "./types";

export interface Category {
  id: CategoryId;
  label: string;
  /** 칩/점/바 색 */
  color: string;
  /** 옅은 배경 (color-mix 로 다크모드에서도 자연스럽게) */
  soft: string;
}

const soft = (hex: string) => `color-mix(in oklab, ${hex} 14%, var(--color-surface))`;

export const CATEGORIES: Category[] = [
  // 실제 색은 globals.css 의 --cat-* (라이트/다크에 따라 달라짐)
  { id: "devlog", label: "개발일지", color: "var(--cat-devlog)", soft: soft("var(--cat-devlog)") },
  { id: "project", label: "프로젝트", color: "var(--cat-project)", soft: soft("var(--cat-project)") },
  { id: "appointment", label: "약속", color: "var(--cat-appointment)", soft: soft("var(--cat-appointment)") },
  { id: "personal", label: "개인", color: "var(--cat-personal)", soft: soft("var(--cat-personal)") },
  { id: "todo", label: "할일", color: "var(--cat-todo)", soft: soft("var(--cat-todo)") },
];

export const CATEGORY_MAP = Object.fromEntries(CATEGORIES.map((c) => [c.id, c])) as Record<
  CategoryId,
  Category
>;
