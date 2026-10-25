/** 독서: 책과 읽은 기록 */
export type BookStatus = "reading" | "done" | "paused";

export interface Book {
  id: string;
  title: string;
  /** 표지 이미지 (data URL 이나 이미지 주소) */
  cover: string | null;
  totalPages: number;
  currentPage: number;
  status: BookStatus;
  startedAt: number | null;
  finishedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface ReadingLog {
  id: string;
  bookId: string;
  /** KST YYYY-MM-DD */
  day: string;
  fromPage: number;
  toPage: number;
  createdAt: number;
}

export const STATUS_LABEL: Record<BookStatus, string> = { reading: "읽는 중", paused: "잠시 멈춤", done: "다 읽음" };
