/**
 * iCalendar(.ics) 만들기 — 아이폰·구글 캘린더 '구독'용 (RFC 5545)
 */
export interface IcsEvent {
  id: string;
  title: string;
  /** YYYY-MM-DD */
  start: string;
  end: string;
  /** HH:MM (없으면 종일) */
  time?: string | null;
  memo?: string | null;
  updatedAt: number;
}

/** 쉼표·세미콜론·역슬래시·줄바꿈 이스케이프 */
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");

/** 한 줄 75바이트 넘으면 접기 (한글이 깨지지 않게 글자 단위로) */
function fold(line: string) {
  const out: string[] = [];
  let cur = "";
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join("\r\n ");
}

const ymd = (d: string) => d.replaceAll("-", "");
const addDay = (d: string, n: number) => {
  const t = new Date(`${d}T00:00:00Z`);
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
};
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

/** 마크다운 메모를 캘린더 메모용 평문으로 */
function plain(md: string) {
  return md
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^\s*-\s\[[ xX]\]\s*/gm, "• ")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .trim();
}

export function buildIcs(events: IcsEvent[], opts: { name: string; url?: string; alarmMinutes?: number }) {
  const L: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//gyupage//calendar//KO",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(opts.name)}`,
    "X-WR-TIMEZONE:Asia/Seoul",
    // 아이폰이 이 주기로 다시 읽도록 권장 (실제 주기는 iOS 가 정함)
    "REFRESH-INTERVAL;VALUE=DURATION:PT15M",
    "X-PUBLISHED-TTL:PT15M",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Seoul",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0900",
    "TZOFFSETTO:+0900",
    "TZNAME:KST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const e of events) {
    L.push("BEGIN:VEVENT", `UID:${e.id}@gyupage`, `DTSTAMP:${utcStamp(e.updatedAt)}`, `LAST-MODIFIED:${utcStamp(e.updatedAt)}`, `SUMMARY:${esc(e.title)}`);
    const end = e.end < e.start ? e.start : e.end;
    if (e.time && /^\d{2}:\d{2}$/.test(e.time)) {
      // 시간 있는 약속: 끝나는 시간이 없어서 1시간짜리로
      const [h, m] = e.time.split(":").map(Number);
      const hh = String(Math.min(23, h + 1)).padStart(2, "0");
      const t0 = `${e.time.replace(":", "")}00`;
      const t1 = h >= 23 ? "235900" : `${hh}${String(m).padStart(2, "0")}00`;
      L.push(`DTSTART;TZID=Asia/Seoul:${ymd(e.start)}T${t0}`, `DTEND;TZID=Asia/Seoul:${ymd(end)}T${t1}`);
      if (opts.alarmMinutes) {
        L.push("BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(e.title)}`, `TRIGGER:-PT${opts.alarmMinutes}M`, "END:VALARM");
      }
    } else {
      // 종일: 끝 날짜는 '다음 날'로 적는 게 규칙
      L.push(`DTSTART;VALUE=DATE:${ymd(e.start)}`, `DTEND;VALUE=DATE:${ymd(addDay(end, 1))}`, "TRANSP:TRANSPARENT");
    }
    if (e.memo?.trim()) L.push(`DESCRIPTION:${esc(plain(e.memo))}`);
    if (opts.url) L.push(`URL:${opts.url}`);
    L.push("END:VEVENT");
  }
  L.push("END:VCALENDAR");
  return L.map(fold).join("\r\n") + "\r\n";
}
