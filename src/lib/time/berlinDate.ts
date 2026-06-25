// ============================================================
// Business-day helpers — all Schnitzery branches run on Europe/Berlin time.
//
// Timestamps (clock_in, clock_out, captured_at, ...) stay in UTC everywhere —
// they're absolute instants and must not shift. Only calendar DATES use the
// branch timezone, so a shift that starts just after midnight in Berlin is
// attributed to the correct business day instead of the previous UTC day.
// ============================================================

const BERLIN = "Europe/Berlin";

// Today's business date in Europe/Berlin, as YYYY-MM-DD.
// (en-CA formats dates as YYYY-MM-DD.)
export function berlinToday(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: BERLIN,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Current business month in Europe/Berlin, as YYYY-MM.
export function berlinMonth(): string {
  return berlinToday().slice(0, 7);
}

// Monday (YYYY-MM-DD) of the week containing a specific date string, TZ-stable.
// Anchored at noon UTC so it never lands on the wrong week near midnight or DST.
// Optionally shift by whole weeks (e.g. offsetWeeks = 1 → next week).
export function mondayOfDate(dateStr: string, offsetWeeks = 0): string {
  const d = new Date(dateStr.slice(0, 10) + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offsetWeeks * 7);
  const day = d.getUTCDay(); // 0=Sun..6=Sat
  d.setUTCDate(d.getUTCDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}

// Monday of the current Berlin business week (YYYY-MM-DD), optionally offset N weeks.
export function berlinMonday(offsetWeeks = 0): string {
  return mondayOfDate(berlinToday(), offsetWeeks);
}

// Weekday index for a date string in a Monday-first scheme (0=Mon..6=Sun), TZ-stable.
export function berlinWeekdayIndex(dateStr: string): number {
  const wd = new Date(dateStr.slice(0, 10) + "T12:00:00Z").getUTCDay();
  return wd === 0 ? 6 : wd - 1;
}