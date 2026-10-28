import { randomUUID } from "node:crypto";
import { toKind, type HistoryKind } from "@/lib/historyKinds";
import { db, hasDb } from "./db";
import { listUploaded } from "./historyDb";

/**
 * 히스토리 > 회사 안의 세부 프로젝트 (예: 등록금 프로젝트)
 * 프로젝트마다 md 문서는 '최신 1개'만 유지 — 설정에서 새로 올리면 이전 문서를 바꿔 끼움.
 * (여러 기록을 합치는 건 직접 해서 하나로 올리는 방식)
 */
export interface HistoryProject {
  id: string;
  name: string;
  kind: HistoryKind;
  /** 프로젝트 문서 (없으면 null) */
  docSlug: string | null;
  docCount: number;
  updatedAt: number | null;
}

interface Row {
  id: string;
  name: string;
  kind: string;
}

export async function listProjects(kind?: HistoryKind): Promise<HistoryProject[]> {
  if (!hasDb()) return [];
  const sql = await db();
  const rows = (await sql`SELECT id, name, kind FROM history_projects ORDER BY position, created_at`) as Row[];
  const docs = await listUploaded();
  return rows
    .filter((r) => !kind || toKind(r.kind) === kind)
    .map((r) => {
      // 혹시 여러 개가 묶여 있어도 가장 최근에 올린 것 하나만
      const mine = docs.filter((d) => d.projectId === r.id).sort((a, b) => b.updatedAt - a.updatedAt);
      return {
        id: r.id,
        name: r.name,
        kind: toKind(r.kind),
        docSlug: mine[0]?.slug ?? null,
        docCount: mine.length ? 1 : 0,
        updatedAt: mine[0]?.updatedAt ?? null,
      };
    });
}

export async function createProject(name: string, kind: HistoryKind = "company") {
  const sql = await db();
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("이름을 적어 주세요");
  const [{ n }] = (await sql`SELECT count(*)::int AS n FROM history_projects`) as { n: number }[];
  const id = randomUUID().slice(0, 8);
  const now = Date.now();
  await sql`INSERT INTO history_projects (id, name, kind, position, created_at, updated_at) VALUES (${id}, ${clean}, ${kind}, ${n}, ${now}, ${now})`;
  return id;
}

export async function renameProject(id: string, name: string) {
  const clean = name.trim().slice(0, 40);
  if (!clean) throw new Error("이름을 적어 주세요");
  const sql = await db();
  await sql`UPDATE history_projects SET name = ${clean}, updated_at = ${Date.now()} WHERE id = ${id}`;
}

/** 프로젝트만 지움 — 안의 문서는 '전체 기록'에 남김 */
export async function deleteProject(id: string) {
  const sql = await db();
  await sql`UPDATE history_docs SET project_id = NULL WHERE project_id = ${id}`;
  await sql`DELETE FROM history_projects WHERE id = ${id}`;
}
