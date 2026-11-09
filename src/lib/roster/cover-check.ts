// Checks for a person taking over a shift (cover or swap): overlap with their other shifts and
// rest time between shifts (11 h, § 5 ArbZG — same rule as the Compliance page). Pure.
import { zonedToUtc } from "@/lib/time/roster";

export type Slot = { date: string; start: string; end: string };
export const REST_HOURS = 11;

export function interval(s: Slot): [number, number] {
  const a = zonedToUtc(s.date, s.start).getTime();
  let b = zonedToUtc(s.date, s.end).getTime();
  if (b <= a) b += 864e5; // ends after midnight
  return [a, b];
}

// overlap: true if the new shift collides with another; restH: shortest gap (hours) if under 11 h, else null.
export function restIssues(next: Slot, others: Slot[]): { overlap: boolean; restH: number | null } {
  const [a, b] = interval(next);
  let overlap = false, rest: number | null = null;
  for (const o of others) {
    const [c, d] = interval(o);
    if (a < d && c < b) { overlap = true; continue; }
    const gap = (c >= b ? c - b : a - d) / 36e5;
    if (gap < REST_HOURS && (rest == null || gap < rest)) rest = gap;
  }
  return { overlap, restH: rest == null ? null : Math.round(rest * 10) / 10 };
}
