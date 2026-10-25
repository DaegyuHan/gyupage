import type { Lineup, LineupPlayer, MatchDetail, Side } from "@/lib/football/detail";
import { BallIcon, CardIcon, Crest } from "./icons";

const POS: Record<string, string> = { G: "GK", D: "DF", M: "MF", F: "FW" };

function ratingColor(r: number) {
  if (r >= 8) return "#0e9f6e";
  if (r >= 7) return "#3f9b3a";
  if (r >= 6.3) return "#d99a18";
  return "#e0573a";
}

function Rating({ r, className = "" }: { r?: number; className?: string }) {
  if (!r) return null;
  return (
    <span
      className={`numeral rounded px-1 text-[10px] font-bold leading-[15px] text-white ${className}`}
      style={{ background: ratingColor(r) }}
    >
      {r.toFixed(1)}
    </span>
  );
}

/** 피치 위 선수 한 명 */
function Token({ p, color, numberColor }: { p: LineupPlayer; color: string; numberColor: string }) {
  return (
    <div className="flex w-[76px] flex-col items-center">
      <div className="relative">
        <span
          className="numeral flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold shadow-[0_2px_6px_rgba(0,0,0,0.35)] ring-2 ring-white/80"
          style={{ background: color, color: numberColor }}
        >
          {p.number ?? ""}
        </span>
        <Rating r={p.rating} className="absolute -right-4 -top-1.5" />
        <span className="absolute -bottom-1 -left-3 flex gap-px">
          {Array.from({ length: p.goals ?? 0 }, (_, i) => (
            <BallIcon key={i} size={12} className="text-ink" />
          ))}
        </span>
        {(p.red || p.yellow) && (
          <span className="absolute -left-2.5 -top-1">
            <CardIcon color={p.red ? "red" : "yellow"} size={12} />
          </span>
        )}
        {p.subOut !== undefined && (
          <span className="numeral absolute -bottom-1.5 -right-4 rounded bg-black/60 px-0.5 text-[9px] font-semibold leading-[13px] text-white">
            ↓{p.subOut}&apos;
          </span>
        )}
      </div>
      <span className="mt-1 max-w-full truncate text-[11px] font-semibold text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.6)]">
        {p.captain && <span className="mr-0.5 rounded-sm bg-white/90 px-0.5 text-[9px] text-black">C</span>}
        {p.name}
      </span>
    </div>
  );
}

function placed(lineup: Lineup, side: Side) {
  const rows = Math.max(...lineup.startXI.map((p) => p.grid?.[0] ?? 1));
  const perRow = new Map<number, number>();
  for (const p of lineup.startXI) if (p.grid) perRow.set(p.grid[0], Math.max(perRow.get(p.grid[0]) ?? 0, p.grid[1]));

  return lineup.startXI.map((p) => {
    const [row, col] = p.grid!;
    const n = perRow.get(row) ?? 1;
    // 홈: 아래쪽 절반(골키퍼가 맨 아래), 원정: 위쪽 절반(골키퍼가 맨 위)
    const t = rows > 1 ? (row - 1) / (rows - 1) : 0;
    const y = side === "home" ? 94 - t * 40 : 6 + t * 40;
    const fx = col / (n + 1);
    const x = side === "home" ? fx * 100 : (1 - fx) * 100;
    return { p, x, y };
  });
}

function Pitch({ d }: { d: MatchDetail }) {
  const h = d.lineups.home!;
  const a = d.lineups.away!;
  return (
    <div
      className="relative mx-auto aspect-[68/105] w-full max-w-[460px] overflow-hidden rounded-2xl"
      style={{
        background:
          "repeating-linear-gradient(0deg, #2f7d4f 0 9.52%, #2a7448 9.52% 19.04%)",
      }}
    >
      {/* 라인 */}
      <svg viewBox="0 0 68 105" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
        <g fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.35">
          <rect x="2" y="2" width="64" height="101" />
          <line x1="2" y1="52.5" x2="66" y2="52.5" />
          <circle cx="34" cy="52.5" r="9.15" />
          <rect x="13.85" y="2" width="40.3" height="16.5" />
          <rect x="24.85" y="2" width="18.3" height="5.5" />
          <rect x="13.85" y="86.5" width="40.3" height="16.5" />
          <rect x="24.85" y="97.5" width="18.3" height="5.5" />
          <path d="M26.7 18.5a9.15 9.15 0 0 0 14.6 0M26.7 86.5a9.15 9.15 0 0 1 14.6 0" />
        </g>
        <circle cx="34" cy="52.5" r="0.6" fill="rgba(255,255,255,0.7)" />
      </svg>

      {/* 포메이션 */}
      <span className="absolute left-3 top-2.5 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white">
        {d.away.name} {a.formation}
      </span>
      <span className="absolute bottom-2.5 left-3 rounded-full bg-black/25 px-2 py-0.5 text-[11px] font-semibold text-white">
        {d.home.name} {h.formation}
      </span>

      {(["home", "away"] as Side[]).flatMap((side) => {
        const l = side === "home" ? h : a;
        return placed(l, side).map(({ p, x, y }) => (
          <div key={`${side}-${p.id}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <Token p={p} color={p.pos === "G" ? l.gkColor : l.color} numberColor={p.pos === "G" ? "#fff" : l.numberColor} />
          </div>
        ));
      })}
    </div>
  );
}

function PlayerList({ title, players }: { title: string; players: LineupPlayer[] }) {
  return (
    <div>
      <h4 className="mb-1.5 text-xs font-bold text-ink-2">{title}</h4>
      <ul className="divide-y divide-line-soft text-sm">
        {players.map((p) => (
          <li key={p.id} className="flex items-center gap-2 py-1.5">
            <span className="numeral w-6 text-right text-xs font-semibold text-ink-3">{p.number ?? ""}</span>
            <span className="min-w-0 flex-1 truncate">
              {p.name}
              {p.captain && <span className="ml-1 text-[10px] font-bold text-ink-3">(C)</span>}
            </span>
            {p.subIn !== undefined && <span className="numeral text-[11px] font-semibold text-[#12a150]">↑{p.subIn}&apos;</span>}
            {p.subOut !== undefined && <span className="numeral text-[11px] font-semibold text-[#e03a3a]">↓{p.subOut}&apos;</span>}
            {(p.goals ?? 0) > 0 && (
              <span className="flex">
                {Array.from({ length: p.goals ?? 0 }, (_, i) => (
                  <BallIcon key={i} size={12} className="text-ink" />
                ))}
              </span>
            )}
            {(p.red || p.yellow) && <CardIcon color={p.red ? "red" : "yellow"} size={12} />}
            {p.pos && <span className="w-6 text-[10px] font-semibold text-ink-3">{POS[p.pos] ?? p.pos}</span>}
            <Rating r={p.rating} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function TeamColumn({ d, side }: { d: MatchDetail; side: Side }) {
  const l = d.lineups[side]!;
  const t = d[side];
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2.5">
        <Crest src={t.logo} size={28} />
        <div>
          <div className="font-bold leading-tight">{t.name}</div>
          <div className="text-xs text-ink-2">
            {l.formation && <span className="numeral font-semibold">{l.formation}</span>}
            {l.coach && <span className="ml-2">감독 {l.coach}</span>}
          </div>
        </div>
      </div>
      <PlayerList title="선발" players={l.startXI} />
      {l.subs.length > 0 && <PlayerList title="교체 명단" players={l.subs} />}
    </div>
  );
}

export default function Lineups({ d }: { d: MatchDetail }) {
  const { home, away } = d.lineups;
  if (!home || !away) {
    return (
      <p className="py-12 text-center text-sm text-ink-3">
        라인업이 아직 발표되지 않았어요. 보통 킥오프 1시간쯤 전에 나와요.
      </p>
    );
  }
  const canDraw = [...home.startXI, ...away.startXI].every((p) => p.grid);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,460px)_minmax(0,1fr)]">
      <div className="order-2 lg:order-1">
        <TeamColumn d={d} side="home" />
      </div>
      <div className="order-1 lg:order-2">
        {canDraw ? <Pitch d={d} /> : <p className="py-6 text-center text-sm text-ink-3">이 경기는 포지션 배치 정보가 없어요.</p>}
      </div>
      <div className="order-3">
        <TeamColumn d={d} side="away" />
      </div>
    </div>
  );
}
