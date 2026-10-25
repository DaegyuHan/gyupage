import type { Absence, AbsenceKind, MatchDetail, Side } from "@/lib/football/detail";
import { Crest } from "./icons";

const KIND: Record<AbsenceKind, { label: string; fg: string; bg: string }> = {
  suspension: { label: "출전 정지", fg: "#c92a2a", bg: "color-mix(in oklab, #e03a3a 12%, var(--color-surface))" },
  injury: { label: "부상", fg: "#c2570c", bg: "color-mix(in oklab, #e07a2f 14%, var(--color-surface))" },
  doubtful: { label: "출전 불확실", fg: "var(--color-ink-2)", bg: "var(--color-sunken)" },
};

function Person({ a }: { a: Absence }) {
  const k = KIND[a.kind];
  return (
    <li className="flex items-center gap-3 py-2.5">
      {a.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.photo} alt="" width={36} height={36} loading="lazy" className="h-9 w-9 shrink-0 rounded-full bg-sunken object-cover" />
      ) : (
        <span className="h-9 w-9 shrink-0 rounded-full bg-sunken" />
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate font-semibold">{a.name}</div>
        <div className="truncate text-xs text-ink-2">{a.reason}</div>
      </div>
      <span className="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold" style={{ color: k.fg, background: k.bg }}>
        {k.label}
      </span>
    </li>
  );
}

function Column({ d, side }: { d: MatchDetail; side: Side }) {
  const list = d.absences?.[side] ?? [];
  const t = d[side];
  const counts = (["suspension", "injury", "doubtful"] as AbsenceKind[])
    .map((k) => [k, list.filter((a) => a.kind === k).length] as const)
    .filter(([, n]) => n > 0);

  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <div className="mb-2 flex items-center gap-2.5">
        <Crest src={t.logo} size={28} />
        <h3 className="font-bold">{t.name}</h3>
        <span className="ml-auto text-xs text-ink-3">
          {counts.length ? counts.map(([k, n]) => `${KIND[k].label} ${n}`).join(", ") : ""}
        </span>
      </div>
      {list.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">알려진 결장자가 없어요.</p>
      ) : (
        <ul className="divide-y divide-line-soft">
          {list.map((a, i) => (
            <Person key={`${a.name}-${i}`} a={a} />
          ))}
        </ul>
      )}
    </div>
  );
}

export default function Absences({ d }: { d: MatchDetail }) {
  if (!d.absences) {
    return <p className="py-8 text-center text-sm text-ink-3">결장자 정보를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p>;
  }
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Column d={d} side="home" />
      <Column d={d} side="away" />
    </div>
  );
}
