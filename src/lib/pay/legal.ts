// German statutory minimum wage (MiLoG) and the Minijob earnings cap derived from it.
// Pure; used by the labour page, the owner home alerts and the roster panel.
// Update this table when the Mindestlohnkommission sets a new rate.
export const MINIMUM_WAGE: { from: string; eur: number }[] = [
  { from: "2025-01-01", eur: 12.82 },
  { from: "2026-01-01", eur: 13.9 },
  { from: "2027-01-01", eur: 14.6 },
];

// Rate in force on a date (YYYY-MM-DD); null before the table starts.
export function minimumWageOn(date: string): number | null {
  let r: number | null = null;
  for (const m of MINIMUM_WAGE) if (m.from <= date) r = m.eur;
  return r;
}

// Next rate change after a date, if one is already decided.
export function nextMinimumWage(date: string): { from: string; eur: number } | null {
  return MINIMUM_WAGE.find((m) => m.from > date) ?? null;
}

// Minijob cap per month (§ 8 SGB IV): minimum wage × 130 ÷ 3, rounded up to whole euros.
export function minijobCapOn(date: string): number | null {
  const mw = minimumWageOn(date);
  return mw == null ? null : Math.ceil((mw * 130) / 3 - 1e-9);
}

export const isMinijob = (contractType: string | null | undefined) =>
  /mini/i.test(contractType || ""); // "Mini Job" / "Minijob"

// Minijobbers whose month (already worked outside this roster week + planned in it) would
// exceed the cap. workedMins is keyed by "YYYY-MM"; planned shifts carry their own date.
// A minijobber without a wage can't be checked and is skipped (the "no wage" note covers it).
export type Minijobber = { id: string; name: string; wage: number | null; workedMins: Record<string, number> };
export function minijobOverCap(people: Minijobber[], planned: { date: string; user_id: string; mins: number }[]) {
  const out: { id: string; name: string; month: string; earnings: number; cap: number }[] = [];
  for (const p of people) {
    if (p.wage == null) continue;
    const mins: Record<string, number> = { ...p.workedMins };
    const months = new Set<string>();
    for (const s of planned) if (s.user_id === p.id) { const m = s.date.slice(0, 7); months.add(m); mins[m] = (mins[m] || 0) + s.mins; }
    for (const m of months) {
      const cap = minijobCapOn(`${m}-01`), earnings = Math.round((mins[m] / 60) * p.wage * 100) / 100;
      if (cap != null && earnings > cap) out.push({ id: p.id, name: p.name, month: m, earnings, cap });
    }
  }
  return out;
}

// Trainees and interns are partly exempt from the minimum wage (§ 22 MiLoG): only warn
// for everyone else. A missing wage is not a minimum-wage problem (it is "no wage").
const exempt = (contractType: string | null | undefined) => /azubi|ausbild|trainee|apprent|prakti|intern/i.test(contractType || "");

export type WageIssue = { kind: "below_now"; min: number } | { kind: "below_soon"; min: number; from: string };

// Below today's minimum, or (within `warnDays`) below the next decided rate.
export function wageIssue(wage: number | null | undefined, contractType: string | null | undefined, today: string, warnDays = 61): WageIssue | null {
  if (wage == null || exempt(contractType)) return null;
  const now = minimumWageOn(today);
  if (now != null && wage < now - 1e-9) return { kind: "below_now", min: now };
  const next = nextMinimumWage(today);
  if (next && wage < next.eur - 1e-9) {
    const days = (Date.parse(`${next.from}T12:00:00Z`) - Date.parse(`${today}T12:00:00Z`)) / 86400000;
    if (days <= warnDays) return { kind: "below_soon", min: next.eur, from: next.from };
  }
  return null;
}
