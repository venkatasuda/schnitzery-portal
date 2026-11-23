// Sick pay (Entgeltfortzahlung im Krankheitsfall), German law without a collective agreement:
//   § 3 Abs. 1 EFZG  up to 6 weeks (42 calendar days) per illness, paid by the employer; afterwards the health insurer.
//   § 3 Abs. 3 EFZG  no claim in the first 4 weeks of employment; the 6 weeks then start on day 29 (BAG 5 AZR 476/98).
//   § 4 Abs. 1 EFZG  pay the hours the person would have worked (Lohnausfallprinzip): the published roster for that day,
//                    including shifts handed to a colleague because of the sickness. No roster for that week → the average
//                    of the last 12 months (BAG 5 AZR 296/00), spread over calendar days.
//   § 4 Abs. 1a      overtime is not continued: each day is capped at the daily overtime threshold, the average uses
//                    regular hours only.
// The same illness again within 6 months can continue the old 6 weeks (§ 3 Abs. 1 Satz 2); the portal cannot know the
// diagnosis, so it only flags it. More than 3 calendar days need a doctor's note (§ 5): flagged until the manager ticks eAU.
// Pure: no I/O. Input = get_payroll_inputs().source.sick (migration 20261123090000_sick_pay.sql).
import { addDays, daysBetween, mondayOfDate, berlinWeekdayIndex } from "@/lib/time/berlinDate";
import { rosterEntryTimes, zonedToUtc, type ShiftTime } from "@/lib/time/roster";
import { classifyShift, shiftMinutes, payForMinutes } from "@/lib/pay/calculations";

export const SICK_PAY_DAYS = 42;
export const WAITING_DAYS = 28;
export const REPEAT_WINDOW_DAYS = 183;
const DAY_KEYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export type SickLeave = { id: string; user_id: string; from: string; to: string; eau: boolean; note: boolean };
export type SickInputs = {
  leave: SickLeave[];
  start: { user_id: string; start_date: string | null; first_work: string | null; full_name?: string | null; employee_code?: string | null; team?: string | null }[];
  roster: { week_start: string; data: Record<string, { user_id?: string; team?: string; shift?: string }[]> | null }[];
  times: { branch: string | null; team: string; shift: string; start: string | null; end: string | null; friSatStart: string | null; friSatEnd: string | null; breakMins: number | null }[];
  covers: { user_id: string; date: string; team: string; shift: string }[];
  history: { user_id: string; work_date: string; clock_in: string | null; clock_out: string | null; duration_mins: number | null; breaks: unknown }[];
  wages: { user_id: string; work_date: string; hourly_wage: number | null }[];
};
export type SickFlag =
  | { kind: "waiting"; until: string }            // sick inside the first 4 weeks: unpaid days
  | { kind: "ended"; on: string }                 // 6 weeks used up: health insurer pays from the next day
  | { kind: "repeat"; from: string; lastEnd: string } // new sickness within 6 months: same illness? 6 weeks may continue
  | { kind: "eau"; leaveId: string; from: string; to: string } // > 3 days without note or ticked eAU
  | { kind: "noStart" }                           // no start date and no clock-in: waiting period not checked
  | { kind: "noHistory" }                         // no roster and no past shifts: 0 hours, enter manually
  | { kind: "missingWage" };
export type SickRow = {
  userId: string; days: number; paidMin: number; nightMin: number; sundayMin: number; holidayMin: number;
  rosterDays: number; averageDays: number; pay: number | null; flags: SickFlag[];
  leave: { id: string; from: string; to: string; eau: boolean; note: boolean }[];
};

// Statutory minimum break (§ 4 ArbZG) for custom roster times without a catalogue break.
const legalBreak = (min: number) => (min > 9 * 60 ? 45 : min > 6 * 60 ? 30 : 0);

export function sickPay(month: string, sick: SickInputs, settings: { otDailyHours: number; nightStart: string; nightEnd: string }, holidays: Set<string>): SickRow[] {
  const first = `${month}-01`, last = addDays(addDays(first, 32).slice(0, 8) + "01", -1);
  const hm = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5));
  const nStart = hm(settings.nightStart), nEnd = hm(settings.nightEnd), cap = Math.round(settings.otDailyHours * 60);

  // Shift catalogue: branch times override the global ones.
  const times = new Map<string, ShiftTime & { breakMins: number | null }>();
  for (const t of [...sick.times].sort((a, b) => Number(a.branch != null) - Number(b.branch != null)))
    times.set(`${t.team}|${t.shift}`, { team: t.team, shift: t.shift, start: t.start ?? "", end: t.end ?? "", friSatStart: t.friSatStart, friSatEnd: t.friSatEnd, breakMins: t.breakMins });
  const roster = new Map(sick.roster.map((r) => [r.week_start, r.data || {}]));
  const wage = new Map(sick.wages.map((w) => [`${w.user_id}|${w.work_date}`, w.hourly_wage == null ? null : Number(w.hourly_wage)]));

  const users = [...new Set(sick.leave.map((l) => l.user_id))].sort();
  return users.map((userId) => {
    const flags: SickFlag[] = [];
    const st = sick.start.find((s) => s.user_id === userId);
    const startDate = st?.start_date || st?.first_work || null;
    if (!startDate) flags.push({ kind: "noStart" });
    const claimFrom = startDate ? addDays(startDate, WAITING_DAYS) : null;

    // Cases: leave that follows on directly (next day or overlapping) is one illness period.
    const leave = sick.leave.filter((l) => l.user_id === userId).sort((a, b) => a.from.localeCompare(b.from));
    const cases: { from: string; to: string; items: SickLeave[] }[] = [];
    for (const l of leave) {
      const c = cases[cases.length - 1];
      if (c && l.from <= addDays(c.to, 1)) { if (l.to > c.to) c.to = l.to; c.items.push(l); }
      else cases.push({ from: l.from, to: l.to, items: [l] });
    }

    const logs = sick.history.filter((h) => h.user_id === userId);
    const row: SickRow = { userId, days: 0, paidMin: 0, nightMin: 0, sundayMin: 0, holidayMin: 0, rosterDays: 0, averageDays: 0, pay: 0, flags,
      leave: leave.filter((l) => l.to >= first && l.from <= last).map(({ id, from, to, eau, note }) => ({ id, from, to, eau, note })) };
    let payMissing = false, avgMissing = false;

    cases.forEach((c, i) => {
      if (c.to < first || c.from > last) return; // only cases touching this month are paid here
      if (i > 0 && daysBetween(cases[i - 1].to, c.from) <= REPEAT_WINDOW_DAYS) flags.push({ kind: "repeat", from: c.from, lastEnd: cases[i - 1].to });
      if (daysBetween(c.from, c.to) + 1 > 3 && !c.items.some((l) => l.eau || l.note)) flags.push({ kind: "eau", leaveId: c.items[0].id, from: c.from, to: c.to });
      const payFrom = claimFrom && claimFrom > c.from ? claimFrom : c.from;
      const payUntil = addDays(payFrom, SICK_PAY_DAYS - 1);
      if (claimFrom && claimFrom > c.from && c.from <= last) flags.push({ kind: "waiting", until: addDays(claimFrom, -1) });
      if (payUntil < c.to && payUntil <= last) flags.push({ kind: "ended", on: payUntil });

      // 12-month regular-hours average per calendar day, before this illness started.
      const winFrom = [addDays(c.from, -365), startDate].filter(Boolean).sort().pop() as string;
      const winDays = daysBetween(winFrom, c.from);
      const perDay = new Map<string, number>();
      for (const h of logs) if (h.work_date >= winFrom && h.work_date < c.from) perDay.set(h.work_date, (perDay.get(h.work_date) || 0) + shiftMinutes(h).paidMin);
      const avg = winDays > 0 ? [...perDay.values()].reduce((s, m) => s + Math.min(m, cap), 0) / winDays : 0;

      for (let d = c.from > first ? c.from : first; d <= c.to && d <= last; d = addDays(d, 1)) {
        if (d < payFrom || d > payUntil) continue;
        const mon = mondayOfDate(d), week = roster.get(mon);
        const inWeek = !!week && (Object.values(week).some((es) => (es || []).some((e) => e?.user_id === userId)) || sick.covers.some((cv) => cv.user_id === userId && mondayOfDate(cv.date) === mon));
        let mins = 0, night = 0, sunday = 0, holiday = 0, known = inWeek;
        if (inWeek) {
          const seen = new Set<string>();
          const entries = [...(week![DAY_KEYS[berlinWeekdayIndex(d)]] || []).filter((e) => e?.user_id === userId), ...sick.covers.filter((cv) => cv.user_id === userId && cv.date === d)]
            .filter((e) => { const k = `${e.team}|${e.shift}`; if (seen.has(k)) return false; seen.add(k); return true; });
          for (const e of entries) {
            const t = rosterEntryTimes(e, times, d);
            if (!t) { known = false; break; } // shift time still pending → use the average for this day
            const from = zonedToUtc(d, t.start), to = zonedToUtc(t.end <= t.start ? addDays(d, 1) : d, t.end);
            const gross = Math.round((to.getTime() - from.getTime()) / 60000);
            const preset = times.get(`${e.team}|${e.shift}`);
            const brk = preset && preset.start ? Number(preset.breakMins) || 0 : legalBreak(gross);
            const c2 = classifyShift(from.toISOString(), to.toISOString(), holidays, nStart, nEnd);
            const share = gross > 0 ? Math.max(0, gross - brk) / gross : 0; // breaks spread evenly over the shift
            mins += Math.max(0, gross - brk); night += c2.nightMin * share; sunday += c2.sundayMin * share; holiday += c2.holidayMin * share;
          }
        }
        if (!known) {
          mins = avg; night = 0; sunday = 0; holiday = holidays.has(d) ? avg : 0;
          if (winDays <= 0 || perDay.size === 0) avgMissing = true;
        }
        const capped = Math.min(mins, cap), k = mins > 0 ? capped / mins : 0;
        row.days += 1; row.paidMin += capped; row.nightMin += night * k; row.sundayMin += sunday * k; row.holidayMin += holiday * k;
        if (known) row.rosterDays += 1; else row.averageDays += 1;
        const w = wage.get(`${userId}|${d}`);
        if (capped > 0 && (w == null || !Number.isFinite(w) || w < 0)) payMissing = true;
        else if (capped > 0 && row.pay != null) row.pay += payForMinutes(Math.round(capped), w!);
      }
    });
    if (avgMissing) flags.push({ kind: "noHistory" });
    if (payMissing) { flags.push({ kind: "missingWage" }); row.pay = null; }
    else row.pay = Math.round((row.pay || 0) * 100) / 100;
    for (const k of ["paidMin", "nightMin", "sundayMin", "holidayMin"] as const) row[k] = Math.round(row[k]);
    return row;
  });
}
