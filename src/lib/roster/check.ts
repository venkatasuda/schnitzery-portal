// Working-time check on a whole week before it is published. Pure.
// Blocking (cannot publish): two shifts of one person overlap; less than 11 h rest between two shifts
// (ArbZG § 5), including after the previous week's Sunday.
// Warning (manager confirms): planned hours above the weekly contract (monthly contract × 12 ÷ 52);
// Minijob earnings above the monthly cap.
// Shifts without a known time cannot be judged and are skipped ("Mid" pending counts as 12:00–18:00, as in smart.ts).
import { slotTimes, WEEK_DAYS, type SmartEntry } from "./smart";
import { minijobOverCap, type Minijobber } from "@/lib/pay/legal";
import { zonedToUtc, type ShiftTime } from "@/lib/time/roster";

export type RosterIssue = { kind: "overlap" | "rest" | "hours" | "minijob"; user_id: string; name: string; day: string | null; value: number };
export const isBlocking = (i: RosterIssue) => i.kind === "overlap" || i.kind === "rest";

// Times are real instants (Europe/Berlin → UTC), in minutes, so a night with a clock change is measured as the
// hours that actually pass: 22:00 → 09:00 over the spring change is 10 h, not 11.
const REST_MIN = 11 * 60;
const dateOf = (weekStart: string, i: number) => { const x = new Date(`${weekStart}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().slice(0, 10); };

export function checkRoster(inp: {
  weekStart: string;
  roster: Record<string, SmartEntry[]>;
  prevSunday: SmartEntry[];                       // last week's published Sunday (rest across the week boundary)
  times: Map<string, ShiftTime>;
  contractHours: Record<string, number | null>;   // monthly contract hours per person
  minijobbers: Minijobber[];
}): RosterIssue[] {
  type Span = { d: number; s: number; e: number };
  const byPerson = new Map<string, { name: string; spans: Span[] }>();
  const add = (e: SmartEntry, d: number) => {
    if (!e?.user_id) return;
    const tm = slotTimes(e.team, e.shift, inp.times, dateOf(inp.weekStart, d));
    const p = byPerson.get(e.user_id) ?? { name: e.name, spans: [] };
    byPerson.set(e.user_id, p);
    if (!tm) return;
    const date = dateOf(inp.weekStart, d), s = zonedToUtc(date, tm.start).getTime() / 60000;
    let en = zonedToUtc(date, tm.end).getTime() / 60000;
    if (en <= s) en = zonedToUtc(dateOf(inp.weekStart, d + 1), tm.end).getTime() / 60000; // ends after midnight
    p.spans.push({ d, s, e: en });
  };
  for (const e of inp.prevSunday || []) add(e, -1);
  WEEK_DAYS.forEach((day, d) => { for (const e of inp.roster[day] || []) add(e, d); });

  const out: RosterIssue[] = [];
  const planned: { date: string; user_id: string; mins: number }[] = [];
  for (const [user_id, { name, spans }] of byPerson) {
    spans.sort((a, b) => a.s - b.s);
    for (let i = 1; i < spans.length; i++) {
      const prev = spans[i - 1], cur = spans[i];
      if (cur.d < 0) continue; // both in the previous week: not this roster's business
      const gap = cur.s - prev.e;
      if (gap < 0) out.push({ kind: "overlap", user_id, name, day: WEEK_DAYS[cur.d], value: 0 });
      else if (gap < REST_MIN) out.push({ kind: "rest", user_id, name, day: WEEK_DAYS[cur.d], value: Math.round(gap / 6) / 10 });
    }
    const week = spans.filter((x) => x.d >= 0), mins = week.reduce((n, x) => n + (x.e - x.s), 0);
    const contract = inp.contractHours[user_id];
    if (contract && mins > (contract * 12 / 52) * 60 + 1e-6) out.push({ kind: "hours", user_id, name, day: null, value: Math.round(mins / 6) / 10 });
    for (const x of week) planned.push({ date: dateOf(inp.weekStart, x.d), user_id, mins: x.e - x.s });
  }
  for (const m of minijobOverCap(inp.minijobbers, planned)) out.push({ kind: "minijob", user_id: m.id, name: m.name, day: null, value: m.earnings });
  return out;
}
