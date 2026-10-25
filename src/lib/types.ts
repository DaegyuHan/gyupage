export type CategoryId = "devlog" | "project" | "appointment" | "personal" | "todo";

export interface CalendarEvent {
  id: string;
  title: string;
  category: CategoryId;
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD (하루짜리면 start 와 같음) */
  end: string;
  /** HH:mm, 선택 */
  time?: string;
  /** 개발일지 본문이나 메모 */
  memo?: string;
  /** 할일: 다 했는지 (홈 '오늘 꼭 할 일'과 같은 데이터) */
  done?: boolean;
  createdAt: number;
  updatedAt: number;
}
