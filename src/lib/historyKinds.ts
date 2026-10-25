/** 히스토리 구분 (브라우저에서도 쓰는 부분이라 fs 쓰는 history.ts 와 따로) */
export type HistoryKind = "company" | "etc";

export const HISTORY_KINDS: { id: HistoryKind; label: string }[] = [
  { id: "company", label: "회사" },
  { id: "etc", label: "기타" },
];

/** frontmatter 의 kind/type/분류 → 회사·기타 */
export function toKind(v: unknown): HistoryKind {
  return typeof v === "string" && /^(etc|기타|개인|personal|side|other)$/i.test(v.trim()) ? "etc" : "company";
}
