export type CategoryId = "devlog" | "project" | "appointment" | "personal";

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
  createdAt: number;
  updatedAt: number;
}
