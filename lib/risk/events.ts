import { fetchJson } from "../http";

export type ScheduledEventKind = "earnings" | "fomc" | "weekend";

export type ScheduledEvent = {
  kind: ScheduledEventKind;
  label: string;
  date: string;
  source: string;
  detail?: string;
};

type NasdaqRow = {
  symbol?: string;
  name?: string;
  fiscalQuarterEnding?: string;
  time?: string;
};

type NasdaqResponse = {
  data?: { rows?: NasdaqRow[] | null } | null;
};

const CALENDAR_CACHE_TTL_MS = 6 * 60 * 60_000;
const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

let calendarCache: { expires: number; payload: CalendarPayload } | undefined;
let calendarInFlight: Promise<CalendarPayload> | null = null;

export type CalendarPayload = {
  events: ScheduledEvent[];
  sources: string[];
  caveats: string[];
  readAt: string;
};

export function isoDay(value: Date | string): string {
  return typeof value === "string" ? value.slice(0, 10) : value.toISOString().slice(0, 10);
}

export function sessionsBetween(fromIso: string, sessions: number): string[] {
  const out: string[] = [];
  const cursor = new Date(`${fromIso}T00:00:00Z`);
  for (let i = 0; i < sessions + 20 && out.length < sessions; i++) {
    const day = cursor.getUTCDay();
    if (day !== 0 && day !== 6) out.push(isoDay(cursor));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function holdWindow(fromIso: string, sessions: number): { from: string; to: string; dates: string[] } {
  const dates = sessionsBetween(fromIso, sessions);
  return { from: dates[0] ?? fromIso, to: dates[dates.length - 1] ?? fromIso, dates };
}

export function upcomingWeekends(fromIso: string, lookAheadDays: number): ScheduledEvent[] {
  const out: ScheduledEvent[] = [];
  const cursor = new Date(`${fromIso}T00:00:00Z`);
  for (let i = 0; i <= lookAheadDays; i++) {
    if (cursor.getUTCDay() === 5) {
      out.push({
        kind: "weekend",
        label: "Wall Street closed until Monday open",
        date: isoDay(cursor),
        source: "NYSE trading calendar",
        detail: "Friday close to Monday open gap.",
      });
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return out;
}

export function eventsWithinWindow(events: ScheduledEvent[], fromIso: string, toIso: string): ScheduledEvent[] {
  return events.filter((event) => event.date >= fromIso && event.date <= toIso);
}

export function eventsForAsset(events: ScheduledEvent[], asset: string): ScheduledEvent[] {
  const upper = asset.toUpperCase();
  const bare = upper.replace(/^R/, "");
  return events.filter(
    (event) => event.label.toUpperCase().includes(upper) || event.label.toUpperCase().includes(bare),
  );
}

async function fetchNasdaqEarnings(dateIso: string): Promise<ScheduledEvent[]> {
  const json = await fetchJson<NasdaqResponse>(
    `https://api.nasdaq.com/api/calendar/earnings?date=${dateIso}`,
    { headers: { "User-Agent": BROWSER_UA, Accept: "application/json" }, timeoutMs: 8_000 },
  );
  const rows = json.data?.rows ?? [];
  const events: ScheduledEvent[] = [];
  for (const row of rows) {
    const symbol = row.symbol?.trim().toUpperCase();
    if (!symbol) continue;
    events.push({
      kind: "earnings",
      label: `${symbol} reports earnings`,
      date: dateIso,
      source: "Nasdaq earnings calendar",
      detail: [row.name, row.fiscalQuarterEnding, row.time].filter(Boolean).join(" · "),
    });
  }
  return events;
}

const MONTHS = new Map<string, number>([
  ["January", 0], ["February", 1], ["March", 2], ["April", 3], ["May", 4], ["June", 5],
  ["July", 6], ["August", 7], ["September", 8], ["October", 9], ["November", 10], ["December", 11],
]);

export type FomcMeeting = {
  year: number;
  month: string;
  startDay: number;
  endDay: number;
  hasProjections: boolean;
  startIso: string;
  endIso: string;
};

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function isoFor(year: number, monthIndex: number, day: number): string | null {
  const iso = `${year}-${String(monthIndex + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  return Number.isFinite(Date.parse(`${iso}T00:00:00Z`)) ? iso : null;
}

export function fomcMeetingsInHtml(html: string): FomcMeeting[] {
  const sections = html.split(/(?=<a id="\d+">\s*\d{4}\s+FOMC Meetings)/g);
  const meetings: FomcMeeting[] = [];

  for (const section of sections) {
    const yearMatch = section.match(/<a id="\d+">\s*(\d{4})\s+FOMC Meetings/);
    if (!yearMatch) continue;
    const year = Number(yearMatch[1]);
    if (!Number.isFinite(year)) continue;

    const rows = [
      ...section.matchAll(
        /fomc-meeting__month[^>]*>([\s\S]*?)<\/div>[\s\S]*?fomc-meeting__date[^>]*>([\s\S]*?)<\/div>/g,
      ),
    ];

    for (const row of rows) {
      const monthName = stripTags(row[1]);
      const dateText = stripTags(row[2]);
      const monthIndex = MONTHS.get(monthName);
      if (monthIndex === undefined) continue;

      const hasProjections = dateText.includes("*");
      const digits = dateText.match(/\d+/g);
      if (!digits) continue;

      const startDay = Number(digits[0]);
      const endDay = digits.length > 1 ? Number(digits[digits.length - 1]) : startDay;
      if (!Number.isFinite(startDay) || !Number.isFinite(endDay)) continue;

      const startIso = isoFor(year, monthIndex, startDay);
      const endIso = isoFor(year, monthIndex, endDay);
      if (!startIso || !endIso) continue;

      meetings.push({ year, month: monthName, startDay, endDay, hasProjections, startIso, endIso });
    }
  }

  const seen = new Set<string>();
  return meetings.filter((meeting) => {
    if (seen.has(meeting.startIso)) return false;
    seen.add(meeting.startIso);
    return true;
  });
}

export function fomcEventDates(meetings: readonly FomcMeeting[]): string[] {
  const out = new Set<string>();
  for (const meeting of meetings) {
    out.add(meeting.startIso);
    out.add(meeting.endIso);
  }
  return [...out].sort();
}

let fomcCache: { expires: number; meetings: FomcMeeting[] } | undefined;

export async function historicalFomcDates(): Promise<{
  dates: string[];
  meetings: FomcMeeting[];
  source: string;
}> {
  const source = "federalreserve.gov FOMC calendar";
  if (fomcCache && fomcCache.expires > Date.now()) {
    return { dates: fomcEventDates(fomcCache.meetings), meetings: fomcCache.meetings, source };
  }

  const res = await fetch("https://www.federalreserve.gov/monetarypolicy/fomccalendars.htm", {
    headers: { "User-Agent": "PrecedentResearch/0.1 (research workbench)" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${res.status} federalreserve.gov`);
  const meetings = fomcMeetingsInHtml(await res.text());
  if (!meetings.length) throw new Error("FOMC calendar parsed to zero meetings");
  fomcCache = { expires: Date.now() + 24 * 60 * 60_000, meetings };
  return { dates: fomcEventDates(meetings), meetings, source };
}

async function loadCalendar(): Promise<CalendarPayload> {
  const today = isoDay(new Date());
  const horizon = 60;
  const caveats: string[] = [];

  const earningsDays: string[] = [];
  for (let i = 0; i < horizon; i += 1) {
    const cursor = new Date(`${today}T00:00:00Z`);
    cursor.setUTCDate(cursor.getUTCDate() + i);
    if (cursor.getUTCDay() === 0 || cursor.getUTCDay() === 6) continue;
    earningsDays.push(isoDay(cursor));
    if (earningsDays.length >= 12) break;
  }

  const settled = await Promise.allSettled([
    Promise.all(earningsDays.map((day) => fetchNasdaqEarnings(day))),
    historicalFomcDates(),
  ]);

  const events: ScheduledEvent[] = [];
  const sources = new Set<string>();

  const earningsResult = settled[0];
  if (earningsResult.status === "fulfilled") {
    for (const batch of earningsResult.value) {
      for (const event of batch) {
        events.push(event);
        sources.add(event.source);
      }
    }
  } else {
    caveats.push("Nasdaq earnings calendar unavailable; earnings events are not included in this hold.");
  }

  const fomcResult = settled[1];
  if (fomcResult.status === "fulfilled" && fomcResult.value.meetings.length) {
    const { meetings, source } = fomcResult.value;
    const start = Date.parse(`${today}T00:00:00Z`);
    const end = start + horizon * 86_400_000;
    for (const meeting of meetings) {
      const stamp = Date.parse(`${meeting.endIso}T00:00:00Z`);
      if (!Number.isFinite(stamp) || stamp < start || stamp > end) continue;
      const label = meeting.startDay === meeting.endDay
        ? `FOMC decision day (${meeting.month})`
        : `FOMC meeting ${meeting.startDay}-${meeting.endDay} ${meeting.month}`;
      events.push({
        kind: "fomc",
        label,
        date: meeting.endIso,
        source,
        detail: meeting.hasProjections ? "Includes projections or economic projections release." : "Policy statement day.",
      });
      sources.add(source);
    }
  } else {
    caveats.push("FOMC calendar unavailable; policy days are not included in this hold.");
  }

  for (const weekend of upcomingWeekends(today, horizon)) {
    events.push(weekend);
    sources.add(weekend.source);
  }

  const deduped = new Map<string, ScheduledEvent>();
  for (const event of events) {
    const key = `${event.kind}:${event.date}:${event.label}`;
    if (!deduped.has(key)) deduped.set(key, event);
  }

  return {
    events: [...deduped.values()].sort((a, b) => a.date.localeCompare(b.date)),
    sources: [...sources],
    caveats,
    readAt: new Date().toISOString(),
  };
}

export async function scheduledCalendar(): Promise<CalendarPayload> {
  if (calendarCache && calendarCache.expires > Date.now()) return calendarCache.payload;
  calendarInFlight ??= loadCalendar().finally(() => {
    calendarInFlight = null;
  });
  const payload = await calendarInFlight;
  calendarCache = { expires: Date.now() + CALENDAR_CACHE_TTL_MS, payload };
  return payload;
}