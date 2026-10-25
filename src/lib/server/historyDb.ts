import { getAllHistory, getHistory, parseDoc, toKind, type HistoryDoc } from "@/lib/history";
import { db, hasDb } from "./db";

/**
 * 히스토리 = 저장소의 content/history/*.md + 설정에서 올린 md(DB)
 * DB 가 없거나 실패해도 저장소 파일은 그대로 보여줌.
 */
interface Row {
  slug: string;
  filename: string;
  raw: string;
  kind?: string;
  created_at: string | number;
  updated_at: string | number;
}

function rowToDoc(r: Row): HistoryDoc {
  // 올릴 때 고른 구분이 파일 안 값보다 우선
  return { ...parseDoc(r.filename, r.raw), slug: r.slug, source: "upload", kind: toKind(r.kind) };
}

export async function listUploaded(): Promise<(HistoryDoc & { filename: string; updatedAt: number })[]> {
  if (!hasDb()) return [];
  try {
    const sql = await db();
    const rows = (await sql`SELECT * FROM history_docs ORDER BY updated_at DESC`) as Row[];
    return rows.map((r) => ({ ...rowToDoc(r), filename: r.filename, updatedAt: Number(r.updated_at) }));
  } catch (e) {
    console.error("[history]", e);
    return [];
  }
}

/** 파일 + 올린 것 전부, 날짜 최신순 */
export async function getAllHistoryMerged(): Promise<HistoryDoc[]> {
  const files = getAllHistory().map((d) => ({ ...d, source: "file" as const }));
  const uploaded = await listUploaded();
  return [...files, ...uploaded].sort((a, b) => (b.date || "0000").localeCompare(a.date || "0000"));
}

export async function getHistoryMerged(slug: string): Promise<HistoryDoc | undefined> {
  const file = getHistory(slug);
  if (file) return { ...file, source: "file" };
  if (!hasDb()) return undefined;
  try {
    const sql = await db();
    const rows = (await sql`SELECT * FROM history_docs WHERE slug = ${slug} OR slug = ${slug.normalize("NFC")}`) as Row[];
    return rows[0] ? rowToDoc(rows[0]) : undefined;
  } catch (e) {
    console.error("[history]", e);
    return undefined;
  }
}
