"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api, useAuth } from "@/lib/auth-client";

/** 회사 탭: 새 프로젝트 만들기 칩 */
export function NewProjectButton() {
  const router = useRouter();
  const { authed } = useAuth();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!authed) return null;

  const submit = async () => {
    if (!name.trim() || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const { id } = await api<{ id: string }>("/api/history/projects", { method: "POST", body: { name, kind: "company" } });
      setOpen(false);
      setName("");
      router.push(`/history?project=${id}`);
      router.refresh();
    } catch (e) {
      setErr(String(e).replace(/^Error: /, ""));
    } finally {
      setBusy(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 rounded-full border border-dashed border-line px-3.5 py-1.5 text-sm font-semibold text-ink-2 hover:border-ink-3 hover:text-ink"
      >
        <svg width="11" height="11" viewBox="0 0 12 12" aria-hidden>
          <path d="M6 1v10M1 6h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
        새 프로젝트
      </button>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="flex items-center gap-1.5"
    >
      <input
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
        placeholder="예: 등록금 프로젝트"
        maxLength={40}
        className="h-8 w-44 rounded-full border border-line bg-surface px-3.5 text-sm outline-none focus:border-accent"
      />
      <button type="submit" disabled={busy || !name.trim()} className="h-8 rounded-full bg-accent px-3.5 text-sm font-semibold text-on-accent disabled:opacity-50">
        만들기
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-8 rounded-full px-2 text-sm text-ink-3 hover:text-ink">
        취소
      </button>
      {err && <span className="text-xs text-[#e5484d]">{err}</span>}
    </form>
  );
}

/** 프로젝트 이름 바꾸기 / 지우기 */
export function ProjectActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const { authed } = useAuth();
  if (!authed) return null;

  const rename = async () => {
    const next = prompt("프로젝트 이름", name);
    if (!next || next.trim() === name) return;
    await api(`/api/history/projects/${id}`, { method: "PATCH", body: { name: next } }).catch((e) => alert(String(e)));
    router.refresh();
  };
  const remove = async () => {
    if (!confirm(`'${name}' 프로젝트를 지울까요?\n안에 있던 기록은 지워지지 않고 '전체'에 그대로 남아요.`)) return;
    await api(`/api/history/projects/${id}`, { method: "DELETE" }).catch((e) => alert(String(e)));
    router.push("/history");
    router.refresh();
  };
  return (
    <div className="flex gap-1">
      <button onClick={rename} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-3 hover:bg-sunken hover:text-ink">
        이름 바꾸기
      </button>
      <button onClick={remove} className="rounded-full px-3 py-1.5 text-sm font-semibold text-ink-3 hover:bg-[#e5484d]/10 hover:text-[#e5484d]">
        삭제
      </button>
    </div>
  );
}
