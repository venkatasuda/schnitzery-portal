// Pure roster-time helpers shared by approvals and the planned-vs-actual report.

// friSatStart/friSatEnd: optional Friday + Saturday times. Empty start/end = "time pending" (not decided yet).
export type ShiftTime = { team: string; shift: string; start: string; end: string; friSatStart?: string | null; friSatEnd?: string | null };

// The times that apply on a date (YYYY-MM-DD): Fri/Sat override when set, else the normal times;
// null when the time is still pending. Without a date the normal times are used.
export function timesOn(t: Pick<ShiftTime, "start" | "end" | "friSatStart" | "friSatEnd"> | null | undefined, date?: string): { start: string; end: string } | null {
  if (!t) return null;
  const wd = date ? new Date(`${date.slice(0, 10)}T12:00:00Z`).getUTCDay() : -1; // 5 = Fri, 6 = Sat
  const weekend = (wd === 5 || wd === 6) && !!t.friSatStart && !!t.friSatEnd;
  const start = weekend ? t.friSatStart! : t.start, end = weekend ? t.friSatEnd! : t.end;
  return start && end ? { start, end } : null;
}
export type RosterEntry = { user_id: string; team?: string; shift?: string };

// Berlin wall-clock time on a date → UTC instant (DST-safe).
export function zonedToUtc(dateStr: string, hhmm: string, tz = "Europe/Berlin"): Date {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h || 0, mi || 0);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, parts.hour === "24" ? 0 : +parts.hour, +parts.minute);
  return new Date(guess - (wall - guess));
}

const HM = /^(\d{1,2}):(\d{2})$/;
// A roster entry's start/end: a preset shift from the catalogue, or a custom "HH:MM–HH:MM".
export function rosterEntryTimes(e: { team?: string; shift?: string }, times: Map<string, ShiftTime>, date?: string): { start: string; end: string } | null {
  const preset = timesOn(times.get(`${e.team}|${e.shift}`), date);
  if (preset) return preset;
  const parts = (e.shift || "").split(/[–\-—]/).map((s) => s.trim());
  return parts.length === 2 && HM.test(parts[0]) && HM.test(parts[1]) ? { start: parts[0], end: parts[1] } : null;
}

export const EARLY_FLAG_MIN = 15;

// Flag for the approver (never blocks): clocked in more than 15 min before the planned
// start, or worked a day they were not rostered. `entries` = that person's entries on
// that day. Entries with unknown times can't be judged → no flag.
// ponytail: an after-midnight shift clocked in before midnight reads as "not rostered";
// look at the next day's entries too if that turns up in practice.
export function clockInFlag(clockIn: string | null, date: string, entries: RosterEntry[], times: Map<string, ShiftTime>):
  { kind: "early"; mins: number } | { kind: "unrostered" } | null {
  if (!clockIn) return null;
  if (!entries.length) return { kind: "unrostered" };
  const at = Date.parse(clockIn);
  let best: number | null = null; // minutes before the nearest planned start (negative = after)
  for (const e of entries) {
    const t = rosterEntryTimes(e, times, date);
    if (!t) return null;
    const diff = Math.round((zonedToUtc(date, t.start).getTime() - at) / 60000);
    if (best == null || Math.abs(diff) < Math.abs(best)) best = diff;
  }
  return best != null && best > EARLY_FLAG_MIN ? { kind: "early", mins: best } : null;
}
