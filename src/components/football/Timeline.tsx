import type { DetailEvent, MatchDetail } from "@/lib/football/detail";
import { minuteText } from "@/lib/football/format";
import { BallIcon, CardIcon, SubIcon, VarIcon } from "./icons";

function Icon({ e }: { e: DetailEvent }) {
  switch (e.kind) {
    case "goal":
    case "penalty":
      return <BallIcon className="text-ink" />;
    case "owngoal":
      return <BallIcon className="text-[#e03a3a]" />;
    case "missedpen":
      return <BallIcon className="text-ink-3" />;
    case "yellow":
      return <CardIcon color="yellow" />;
    case "red":
      return <CardIcon color="red" />;
    case "secondyellow":
      return <CardIcon color="red" double />;
    case "sub":
      return <SubIcon />;
    case "var":
      return <VarIcon />;
  }
}

function describe(e: DetailEvent): { main: string; sub?: string } {
  switch (e.kind) {
    case "goal":
      return { main: e.player, sub: e.second ? `도움 ${e.second}` : undefined };
    case "penalty":
      return { main: e.player, sub: "페널티킥 골" };
    case "owngoal":
      return { main: e.player, sub: "자책골" };
    case "missedpen":
      return { main: e.player, sub: "페널티킥 실축" };
    case "yellow":
      return { main: e.player, sub: "경고" };
    case "red":
      return { main: e.player, sub: "퇴장" };
    case "secondyellow":
      return { main: e.player, sub: "경고 누적 퇴장" };
    case "sub":
      return { main: e.player, sub: e.second ? `${e.second} 아웃` : undefined };
    case "var":
      return { main: e.player || "VAR", sub: varText(e.note) };
  }
}

function varText(note?: string) {
  if (!note) return "VAR 판독";
  if (/goal cancel|goal disallow/i.test(note)) return "VAR: 골 취소";
  if (/penalty confirm/i.test(note)) return "VAR: 페널티킥 확정";
  if (/penalty cancel/i.test(note)) return "VAR: 페널티킥 취소";
  if (/card upgrade|red card/i.test(note)) return "VAR: 퇴장";
  if (/goal confirm/i.test(note)) return "VAR: 골 인정";
  return `VAR: ${note}`;
}

const isGoal = (e: DetailEvent) => e.kind === "goal" || e.kind === "penalty" || e.kind === "owngoal";

function Divider({ label }: { label: string }) {
  return (
    <li className="relative flex justify-center py-3">
      <span className="relative z-10 rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-2">{label}</span>
    </li>
  );
}

export default function Timeline({ d }: { d: MatchDetail }) {
  const ev = d.events;
  if (ev.length === 0) {
    return <p className="py-12 text-center text-sm text-ink-3">아직 기록된 이벤트가 없어요.</p>;
  }

  const items: React.ReactNode[] = [];
  let shownHT = false;
  let shownET = false;
  ev.forEach((e, i) => {
    if (!shownHT && e.minute > 45) {
      shownHT = true;
      items.push(<Divider key="ht" label={d.halftime ? `전반 종료  ${d.halftime[0]} : ${d.halftime[1]}` : "전반 종료"} />);
    }
    if (!shownET && e.minute > 90) {
      shownET = true;
      items.push(<Divider key="et" label="연장전" />);
    }
    const { main, sub } = describe(e);
    const goal = isGoal(e);
    const content = (
      <div className={`flex min-w-0 items-center gap-2.5 ${e.side === "home" ? "flex-row-reverse text-right" : ""}`}>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-sunken">
          <Icon e={e} />
        </span>
        <div className="min-w-0">
          <div className={`truncate ${goal ? "font-bold" : "font-medium"}`}>{main}</div>
          {sub && <div className="truncate text-xs text-ink-2">{sub}</div>}
        </div>
        {goal && e.scoreAfter && (
          <span className="numeral shrink-0 rounded-md bg-ink px-1.5 py-0.5 text-xs font-bold text-paper">
            {e.scoreAfter[0]}-{e.scoreAfter[1]}
          </span>
        )}
      </div>
    );
    items.push(
      <li key={i} className="grid grid-cols-[minmax(0,1fr)_56px_minmax(0,1fr)] items-center py-2 text-sm">
        <div>{e.side === "home" && content}</div>
        <div className="relative z-10 flex justify-center">
          <span className={`numeral rounded-full px-2 py-0.5 text-xs font-semibold ${goal ? "bg-ink text-paper" : "bg-paper text-ink-2"}`}>
            {minuteText(e.minute, e.extra)}
          </span>
        </div>
        <div>{e.side === "away" && content}</div>
      </li>,
    );
  });
  if (!shownHT && d.status === "finished") items.push(<Divider key="ht" label="전반 종료" />);
  if (d.status === "finished") {
    items.push(<Divider key="ft" label={`경기 종료  ${d.home.score ?? 0} : ${d.away.score ?? 0}`} />);
  }

  return (
    <div className="relative">
      <div className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-line" aria-hidden />
      <ol className="relative">{items}</ol>
    </div>
  );
}
