"use client";

import { useCallback, useEffect, useState } from "react";
import { api, useAuth } from "@/lib/auth-client";
import type { Book, BookStatus, ReadingLog } from "./types";

/** 책과 읽은 기록 (DB) — 로그인해야 보여요 */
export function useBooks({ logs: withLogs = true } = {}) {
  const auth = useAuth();
  const [books, setBooks] = useState<Book[]>([]);
  const [logs, setLogs] = useState<ReadingLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const j = await api<{ books: Book[]; logs: ReadingLog[] }>(`/api/books${withLogs ? "" : "?logs=0"}`);
      setBooks(j.books);
      setLogs(j.logs);
    } catch (e) {
      setError(`책을 불러오지 못했어요 (${String(e).replace(/^Error: /, "")})`);
    } finally {
      setLoaded(true);
    }
  }, [withLogs]);

  useEffect(() => {
    if (auth.loading) return;
    if (!auth.authed) {
      setLoaded(true);
      return;
    }
    reload();
  }, [auth.loading, auth.authed, reload]);

  const fail = (e: unknown) => {
    setError(`저장하지 못했어요 (${String(e).replace(/^Error: /, "")})`);
    reload();
    throw e;
  };

  const add = useCallback(async (input: { title: string; cover: string | null; totalPages: number }) => {
    setError(null);
    const id = crypto.randomUUID();
    const j = await api<{ book: Book }>("/api/books", { method: "POST", body: { id, ...input } }).catch(fail);
    setBooks((b) => [j.book, ...b]);
    return j.book;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = useCallback(async (id: string, patch: Partial<{ title: string; cover: string | null; totalPages: number; status: BookStatus }>) => {
    setError(null);
    const j = await api<{ book: Book }>(`/api/books/${id}`, { method: "PUT", body: patch }).catch(fail);
    setBooks((b) => b.map((x) => (x.id === id ? j.book : x)));
    return j.book;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const remove = useCallback(async (id: string) => {
    setError(null);
    await api(`/api/books/${id}`, { method: "DELETE" }).catch(fail);
    setBooks((b) => b.filter((x) => x.id !== id));
    setLogs((l) => l.filter((x) => x.bookId !== id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 지금 몇 쪽까지 읽었는지 */
  const setProgress = useCallback(async (id: string, page: number) => {
    setError(null);
    const j = await api<{ book: Book; log: ReadingLog | null }>(`/api/books/${id}/progress`, { method: "POST", body: { page } }).catch(fail);
    setBooks((b) => b.map((x) => (x.id === id ? j.book : x)));
    if (j.log) setLogs((l) => [j.log!, ...l]);
    return j.book;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { books, logs, loaded, error, authed: auth.authed, authLoading: auth.loading, add, update, remove, setProgress, reload };
}

/** 표지 파일을 작게 줄여 data URL 로 (최대 360×540, JPEG) */
export async function resizeCover(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, 360 / img.width, 540 / img.height);
    const w = Math.round(img.width * scale);
    const h = Math.round(img.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL("image/jpeg", 0.82);
  } finally {
    URL.revokeObjectURL(url);
  }
}
