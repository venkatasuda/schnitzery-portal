const berlin = new Intl.DateTimeFormat("en-GB", {
  timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
});

export function shiftMinutes(log: { duration_mins?: number | null; clock_in?: string | null; clock_out?: string | null; breaks?: unknown }) {
  const start = Date.parse(log.clock_in || ""), end = Date.parse(log.clock_out || "");
  const hasInterval = Number.isFinite(start) && Number.isFinite(end) && end > start;
  const grossMin = Math.max(0, hasInterval ? Math.round((end - start) / 60000) : Number(log.duration_mins) || 0);
  if (!Number.isFinite(grossMin)) throw new Error("Invalid shift duration.");
  const intervals: [number, number][] = [];
  if (Array.isArray(log.breaks)) for (const b of log.breaks) {
    if (!b || typeof b !== "object") continue;
    let s = Date.parse(b.start), e = Date.parse(b.end);
    if (hasInterval) { s = Math.max(s, start); e = Math.min(e, end); }
    if (Number.isFinite(s) && Number.isFinite(e) && e > s) intervals.push([s, e]);
  }
  intervals.sort((a, b) => a[0] - b[0]);
  let breakMs = 0, through = -Infinity;
  for (const [s, e] of intervals) { breakMs += Math.max(0, e - Math.max(s, through)); through = Math.max(through, e); }
  const breakMin = Math.min(grossMin, Math.round(breakMs / 60000));
  return { grossMin, breakMin, paidMin: grossMin - breakMin };
}

// A closed shift longer than this was almost certainly a forgotten clock-out (legal max is
// 10h/day plus breaks). Such shifts must be corrected before approval, never paid as-is.
export const IMPLAUSIBLE_SHIFT_MIN = 16 * 60;
export function isImplausibleShift(log: Parameters<typeof shiftMinutes>[0]): boolean {
  return shiftMinutes(log).grossMin > IMPLAUSIBLE_SHIFT_MIN;
}

export function payForMinutes(minutes: number, wage: number): number {
  if (!Number.isFinite(minutes) || minutes < 0 || !Number.isFinite(wage) || wage < 0) throw new Error("Invalid pay inputs.");
  return Math.round(minutes * wage / 60 * 100) / 100;
}

export function classifyShift(inISO: string, outISO: string, holidays: Set<string>, nStart: number, nEnd: number) {
  if (![nStart, nEnd].every(n => Number.isFinite(n) && n >= 0 && n < 1440)) throw new Error("Invalid night hours.");
  const start = Date.parse(inISO), end = Date.parse(outISO);
  const result = { totalMin: 0, weekendMin: 0, holidayMin: 0, nightMin: 0 };
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return result;
  if (end - start > 7 * 86400000) throw new Error("Shift exceeds seven days; correct attendance before calculating payroll.");
  for (let cur = start; cur < end;) {
    const parts: Record<string, string> = {};
    for (const p of berlin.formatToParts(new Date(cur))) parts[p.type] = p.value;
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const localMin = Number(parts.hour) * 60 + Number(parts.minute) + Number(parts.second) / 60;
    const nextBoundary = [nStart, nEnd, 1440].filter(x => x > localMin).sort((a, b) => a - b)[0];
    // Berlin offset changes occur on UTC hour boundaries. Re-read wall time at
    // each boundary so skipped/repeated local hours retain their elapsed time.
    const next = Math.min(end, (Math.floor(cur / 3600000) + 1) * 3600000, cur + (nextBoundary - localMin) * 60000);
    const mins = (next - cur) / 60000;
    const weekday = new Date(date + "T12:00:00Z").getUTCDay();
    if (weekday === 0 || weekday === 6) result.weekendMin += mins;
    if (holidays.has(date)) result.holidayMin += mins;
    const night = nStart < nEnd ? localMin >= nStart && localMin < nEnd : localMin >= nStart || localMin < nEnd;
    if (night) result.nightMin += mins;
    cur = next;
  }
  result.totalMin = Math.round((end - start) / 60000);
  result.weekendMin = Math.round(result.weekendMin);
  result.holidayMin = Math.round(result.holidayMin);
  result.nightMin = Math.round(result.nightMin);
  return result;
}
