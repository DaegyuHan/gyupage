import { NextResponse } from "next/server";
import { toKind } from "@/lib/historyKinds";
import { guarded } from "@/lib/server/api";
import { createProject, listProjects } from "@/lib/server/historyProjects";

/** 프로젝트 목록 (?kind=company) */
export async function GET(req: Request) {
  return guarded(async () => {
    const k = new URL(req.url).searchParams.get("kind");
    return NextResponse.json({ projects: await listProjects(k ? toKind(k) : undefined) });
  });
}

/** 새 프로젝트 { name, kind } */
export async function POST(req: Request) {
  return guarded(async () => {
    const { name, kind } = (await req.json()) as { name?: string; kind?: string };
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "이름을 적어 주세요" }, { status: 400 });
    const id = await createProject(name, toKind(kind ?? "company"));
    return NextResponse.json({ id });
  });
}
