import { NextResponse } from "next/server";
import { guarded } from "@/lib/server/api";
import { deleteProject, renameProject } from "@/lib/server/historyProjects";

type Ctx = { params: Promise<{ id: string }> };

/** 이름 바꾸기 { name } */
export async function PATCH(req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    const { name } = (await req.json()) as { name?: string };
    if (typeof name !== "string" || !name.trim()) return NextResponse.json({ error: "이름을 적어 주세요" }, { status: 400 });
    await renameProject(id, name);
    return NextResponse.json({ ok: true });
  });
}

/** 프로젝트 지우기 (안의 기록은 남김) */
export async function DELETE(_req: Request, { params }: Ctx) {
  return guarded(async () => {
    const { id } = await params;
    await deleteProject(id);
    return NextResponse.json({ ok: true });
  });
}
