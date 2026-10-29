"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/auth-client";
import { HISTORY_KINDS, type HistoryKind } from "@/lib/historyKinds";

interface Uploaded {
  slug: string;
  title: string;
  date: string;
  company?: string;
  tags: string[];
  filename: string;
  updatedAt: number;
  kind: HistoryKind;
  projectId: string | null;
}

interface Project {
  id: string;
  name: string;
  docCount: number;
}

interface Result {
  name: string;
  ok: boolean;
  slug?: string;
  title?: string;
  date?: string;
  error?: string;
  replaced?: boolean;
}

const TEMPLATE = `---
title: 결제 시스템 개편
date: 2025-03-04
kind: 회사
company: 회사명
tags: [백엔드, 결제]
summary: 목록에 보일 한 줄 요약 (없으면 본문 앞부분)
---

# 결제 시스템 개편

## 배경
## 내가 한 일
## 결과
## 회고`;

function shortDate(d: string) {
  if (!d) return "날짜 없음";
  const [y, m, day] = d.split("-");
  return day ? `${y}.${Number(m)}.${Number(day)}` : `${y}.${Number(m)}`;
}

/** 설정 > 히스토리: md 파일을 끌어다 놓거나 골라서 올리기 */
export default function HistoryUpload() {
  const [docs, setDocs] = useState<Uploaded[] | null>(null);
  const [drag, setDrag] = useState(false);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[]>([]);
  const [showTemplate, setShowTemplate] = useState(false);
  const [kind, setKind] = useState<HistoryKind>("company");
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectId, setProjectId] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const depth = useRef(0);

  const reload = useCallback(() => {
    api<{ docs: Uploaded[] }>("/api/history")
      .then((j) => setDocs(j.docs))
      .catch(() => setDocs([]));
  }, []);
  useEffect(reload, [reload]);
  const loadProjects = useCallback(() => {
    api<{ projects: Project[] }>("/api/history/projects?kind=company")
      .then((j) => setProjects(j.projects))
      .catch(() => {});
  }, []);
  useEffect(loadProjects, [loadProjects]);

  const newProject = async () => {
    const name = prompt("새 프로젝트 이름 (예: 등록금 프로젝트)");
    if (!name?.trim()) return;
    try {
      const { id } = await api<{ id: string }>("/api/history/projects", { method: "POST", body: { name, kind: "company" } });
      loadProjects();
      setProjectId(id);
    } catch (e) {
      alert(String(e).replace(/^Error: /, ""));
    }
  };

  const upload = async (list: FileList | File[]) => {
    const files = [...list].filter((f) => /\.(md|markdown)$/i.test(f.name));
    const skipped = [...list].filter((f) => !/\.(md|markdown)$/i.test(f.name)).map((f) => ({ name: f.name, ok: false, error: "md 파일이 아니에요" }));
    if (!files.length) {
      setResults(skipped);
      return;
    }
    setBusy(true);
    try {
      const payload = await Promise.all(files.map(async (f) => ({ name: f.name, content: await f.text() })));
      const j = await api<{ results: Result[] }>("/api/history", { method: "POST", body: { files: payload, kind, projectId: kind === "company" && projectId ? projectId : null } });
      setResults([...j.results, ...skipped]);
      reload();
    } catch (e) {
      setResults([{ name: "업로드", ok: false, error: String(e).replace(/^Error: /, "") }]);
    } finally {
      setBusy(false);
    }
  };

  const changeKind = async (d: Uploaded, k: HistoryKind) => {
    setDocs((list) => list?.map((x) => (x.slug === d.slug ? { ...x, kind: k } : x)) ?? null);
    await api(`/api/history/${encodeURIComponent(d.slug)}`, { method: "PATCH", body: { kind: k } }).catch(() => reload());
  };

  const changeProject = async (d: Uploaded, pid: string) => {
    setDocs((list) => list?.map((x) => (x.slug === d.slug ? { ...x, projectId: pid || null } : x)) ?? null);
    // 프로젝트에는 문서 하나만이라 원래 있던 문서가 빠질 수 있어서 다시 불러옴
    await api(`/api/history/${encodeURIComponent(d.slug)}`, { method: "PATCH", body: { projectId: pid || null } }).catch(() => {});
    reload();
  };

  const remove = async (d: Uploaded) => {
    if (!confirm(`'${d.title}' 기록을 지울까요?`)) return;
    await api(`/api/history/${encodeURIComponent(d.slug)}`, { method: "DELETE" }).catch(() => {});
    reload();
  };

  return (
    <section id="history" className="scroll-mt-6">
      <h2 className="text-xl font-extrabold tracking-tight">히스토리 문서</h2>
      <p className="mt-1 text-sm text-ink-2">
        md 파일을 올리면 제목·날짜·회사·태그를 읽어서{" "}
        <Link href="/history" className="font-semibold text-accent hover:underline">
          히스토리
        </Link>
        에 날짜순으로 정리돼요. 같은 파일 이름으로 다시 올리면 내용이 바뀌어요.
      </p>

      <div className="mt-5 grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-3">
          {/* 어디로 넣을지: 회사 / 기타 */}
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="text-sm font-semibold text-ink-2">넣을 곳</span>
            <div role="radiogroup" className="flex gap-1 rounded-full bg-sunken p-1">
              {HISTORY_KINDS.map((k) => (
                <button
                  key={k.id}
                  type="button"
                  role="radio"
                  aria-checked={kind === k.id}
                  onClick={() => setKind(k.id)}
                  className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${kind === k.id ? "bg-surface text-ink shadow-sm" : "text-ink-3 hover:text-ink-2"}`}
                >
                  {k.label}
                </button>
              ))}
            </div>
            <span className="text-xs text-ink-3">{kind === "company" ? "회사에서 한 일" : "개인 프로젝트·공부 등"}</span>
          </div>
          {kind === "company" && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="text-sm font-semibold text-ink-2">프로젝트</span>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="min-w-0 max-w-[60vw] rounded-lg border border-line bg-paper px-2.5 py-1.5 text-sm font-semibold sm:max-w-[240px]"
              >
                <option value="">없음</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button type="button" onClick={newProject} className="text-xs font-semibold text-accent hover:underline">
                + 새 프로젝트
              </button>
            </div>
          )}
          {kind === "company" && projectId && (
            <p className="rounded-xl bg-accent-soft/60 px-3 py-2 text-xs leading-relaxed text-ink-2">
              프로젝트에는 <b>최신 md 하나</b>만 보여요. 새로 올리면 이전 문서는 지워지고 바뀌어요. (한 번에 파일 하나)
            </p>
          )}

          {/* 끌어다 놓는 곳 (눌러서 고르기도 됨) */}
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            onDragEnter={(e) => {
              e.preventDefault();
              depth.current++;
              setDrag(true);
            }}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={() => {
              depth.current = Math.max(0, depth.current - 1);
              if (depth.current === 0) setDrag(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              depth.current = 0;
              setDrag(false);
              if (e.dataTransfer.files.length) upload(e.dataTransfer.files);
            }}
            disabled={busy}
            className={`flex min-h-[180px] w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition ${
              drag ? "scale-[1.01] border-accent bg-accent-soft/50" : "border-line bg-surface hover:border-accent/60"
            }`}
          >
            <svg viewBox="0 0 24 24" className={`h-9 w-9 ${drag ? "text-accent" : "text-ink-3"}`} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
              <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
              <path d="M14 3v5h5M12 17v-6M9.5 13.5 12 11l2.5 2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <span className="text-[15px] font-bold">
              {busy ? "올리는 중…" : drag ? "여기에 놓으세요" : `md 파일을 끌어다 놓기 → ${kind === "company" ? `회사${projectId ? ` · ${projects.find((p) => p.id === projectId)?.name ?? ""}` : ""}` : "기타"}`}
            </span>
            <span className="text-xs text-ink-3">
              또는 눌러서 파일 찾기 · {kind === "company" && projectId ? "프로젝트 문서를 이 파일로 바꿔요" : "여러 개 한 번에"} · 파일당 500KB 까지
            </span>
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".md,.markdown,text/markdown"
            multiple={!(kind === "company" && projectId)}
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.length) upload(e.target.files);
              e.target.value = "";
            }}
          />

          {results.length > 0 && (
            <ul className="space-y-1.5 rounded-2xl border border-line bg-surface p-3 text-sm">
              {results.map((r, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className={r.ok ? "text-[#0e8a6b]" : "text-[#d64545]"}>{r.ok ? "✓" : "✕"}</span>
                  {r.ok && r.slug ? (
                    <Link href={`/history/${encodeURIComponent(r.slug)}`} className="min-w-0 flex-1 truncate font-semibold hover:text-accent">
                      {r.title}
                    </Link>
                  ) : (
                    <span className="min-w-0 flex-1 truncate">{r.name}</span>
                  )}
                  <span className="shrink-0 text-xs text-ink-3">
                    {r.ok ? `${shortDate(r.date ?? "")}${r.replaced ? " · 이전 문서 바꿈" : ""}` : r.error}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <div className="rounded-2xl bg-sunken/60 p-4 text-xs leading-relaxed text-ink-2">
            <p>
              파일 맨 위에 <b>frontmatter</b> 를 쓰면 그대로 써요. 없으면 첫 <code># 제목</code>, 파일 이름 앞의 날짜(<code>2025-03-04-제목.md</code>)로 알아서
              채워요.
            </p>
            <button onClick={() => setShowTemplate((v) => !v)} className="mt-2 font-semibold text-accent hover:underline">
              {showTemplate ? "양식 닫기" : "양식 보기"}
            </button>
            {showTemplate && (
              <>
                <pre className="mt-2 overflow-x-auto rounded-lg bg-paper p-3 font-mono text-[11px] leading-relaxed text-ink">{TEMPLATE}</pre>
                <button
                  onClick={() => navigator.clipboard.writeText(TEMPLATE).catch(() => {})}
                  className="mt-2 rounded-lg border border-line px-2.5 py-1 font-semibold hover:border-ink-3"
                >
                  양식 복사
                </button>
              </>
            )}
          </div>
        </div>

        <div>
          <h3 className="mb-3 font-bold">
            올린 문서 {docs && docs.length > 0 && <span className="text-ink-3">{docs.length}</span>}
          </h3>
          {!docs ? (
            <div className="h-24 rounded-2xl bg-sunken/70" aria-busy="true" />
          ) : docs.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-ink-3">아직 올린 문서가 없어요.</p>
          ) : (
            <ul className="divide-y divide-line-soft rounded-2xl border border-line bg-surface">
              {docs.map((d) => (
                <li key={d.slug} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
                  <span className="numeral w-[60px] shrink-0 sm:w-[72px] text-sm font-semibold tabular-nums text-ink-2">{shortDate(d.date)}</span>
                  <div className="min-w-0 flex-1 basis-[55%]">
                    <Link href={`/history/${encodeURIComponent(d.slug)}`} className="block truncate font-bold hover:text-accent">
                      {d.title}
                    </Link>
                    <div className="truncate text-[11px] text-ink-3">
                      {d.company && `${d.company} · `}
                      {d.filename}
                    </div>
                  </div>
                  <div className="ml-[72px] flex min-w-0 items-center gap-2 sm:ml-0">
                  {d.kind === "company" && projects.length > 0 && (
                    <select
                      value={d.projectId ?? ""}
                      onChange={(e) => changeProject(d, e.target.value)}
                      className="min-w-0 max-w-[140px] rounded-lg border border-line bg-paper px-2 py-1 text-xs font-semibold"
                      aria-label="프로젝트"
                    >
                      <option value="">프로젝트 없음</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <select
                    value={d.kind}
                    onChange={(e) => changeKind(d, e.target.value as HistoryKind)}
                    className="shrink-0 rounded-lg border border-line bg-paper px-2 py-1 text-xs font-semibold"
                    aria-label="구분"
                  >
                    {HISTORY_KINDS.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.label}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => remove(d)}
                    className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-ink-3 hover:bg-[#d64545]/10 hover:text-[#d64545]"
                  >
                    삭제
                  </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
