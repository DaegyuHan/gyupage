import type { WeekSchedule as Week } from "@/lib/football/leagueExtras";
import { kstDate } from "@/lib/football/kst";
import MatchRow from "./MatchRow";

const WD = ["일", "월", "화", "수", "목", "금", "토"];

function dayLabel(date: string, today: string) {
  const d = new Date(`${date}T00:00:00Z`);
  const base = `${d.getUTCMonth() + 1}.${d.getUTCDate()} (${WD[d.getUTCDay()]})`;
  const diff = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86400_000);
  const rel = diff === 0 ? "오늘" : diff === -1 ? "어제" : diff === 1 ? "내일" : "";
  return rel ? `${rel} · ${base}` : base;
}

function Column({ title, days, today, empty }: { title: string; days: Week["days"]; today: string; empty: string }) {
  return (
    <div className="min-w-0">
      <h3 className="mb-2 text-sm font-bold text-ink-2">{title}</h3>
      {days.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-3">{empty}</p>
      ) : (
        <div className="space-y-4">
          {days.map((d) => (
            <div key={d.date}>
              <div className={`mb-0.5 text-xs font-semibold ${d.date === today ? "text-accent" : "text-ink-3"}`}>{dayLabel(d.date, today)}</div>
              <ul className="divide-y divide-line-soft">
                {d.matches.map((m) => (
                  <MatchRow key={m.id} m={m} />
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** 이번 주 일정·결과: 왼쪽 지난 7일(최근이 위) · 오른쪽 다음 7일 */
export default function WeekSchedule({ week }: { week: Week }) {
  const today = kstDate(new Date());
  const past = week.days.filter((d) => d.date < today).reverse();
  // 오늘은 일정 쪽에 (진행 중·예정·끝난 경기 같이)
  const next = week.days.filter((d) => d.date >= today);
  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Column title="다음 7일 일정" days={next} today={today} empty="다음 7일 안에는 경기가 없어요." />
      <Column title="지난 7일 결과" days={past} today={today} empty="지난 7일 동안 경기가 없었어요." />
    </div>
  );
}
