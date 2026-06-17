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