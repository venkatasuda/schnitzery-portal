// Owner insights (docs/OWNER-COCKPIT.md): 8-week trend, week-ahead labour forecast and
// branch health score. Pure — queries/owner-insights.ts gathers rows, this does the maths.
// Honest gaps: a figure that is missing an input is null ("—"), never 0.
import { mondayOfDate, berlinWeekdayIndex } from "@/lib/time/berlinDate";

type Sale = { sale_date: string; amount: number | string | null };
type Worked = { user_id: string; work_date: string; paidMin: number };
type Wages = Record<string, number | null | undefined>;

const r1 = (n: number) => Math.round(n * 10) / 10;
const sumSales = (rows: Sale[]) => rows.reduce((a, s) => a + (Number(s.amount) || 0), 0);

export type WeekRow = { weekStart: string; sales: number | null; salesComplete: boolean; hours: number; labourCost: number | null; labourPct: number | null; splh: number | null };

// One row per week (oldest first). Sales are incomplete when a day someone worked has no
// sales entry; labour cost is null when anyone who worked has no wage on file.
export function weeklyTrend(weeks: string[], sales: Sale[], worked: Worked[], wages: Wages): WeekRow[] {
  return weeks.map((weekStart) => {
    const s = sales.filter((x) => mondayOfDate(x.sale_date) === weekStart);
    const w = worked.filter((x) => mondayOfDate(x.work_date) === weekStart && x.paidMin > 0);
    const salesDays = new Set(s.map((x) => x.sale_date));
    const salesComplete = s.length > 0 && w.every((x) => salesDays.has(x.work_date));
    const mins = w.reduce((a, x) => a + x.paidMin, 0);
    const wageKnown = w.every((x) => wages[x.user_id] != null);
    const cost = wageKnown ? w.reduce((a, x) => a + (x.paidMin / 60) * Number(wages[x.user_id]), 0) : null;
    const salesV = s.length ? Math.round(sumSales(s)) : null;
    const hours = r1(mins / 60);
    return {
      weekStart, sales: salesV, salesComplete, hours,
      labourCost: cost == null ? null : Math.round(cost),
      // Sales but no recorded hours means attendance is missing, not free labour → "—".
      labourPct: cost != null && hours > 0 && salesComplete && salesV ? r1((cost / salesV) * 100) : null,
      splh: salesComplete && salesV && hours > 0 ? Math.round(salesV / hours) : null,
    };
  });
}

export type PlannedShift = { date: string; user_id: string; mins: number };
export type ForecastDay = { date: string; forecast: number | null; hours: number; cost: number | null };
export type WeekForecast = { days: ForecastDay[]; sales: number | null; hours: number; cost: number | null; labourPct: number | null; missingWages: number };

// Week ahead: forecast each day's sales as the average of the same weekday in the history
// (only days that have an entry), cost the planned roster at current wages.
export function forecastWeek(dates: string[], history: Sale[], planned: PlannedShift[], wages: Wages): WeekForecast {
  const missing = new Set<string>();
  const days = dates.map((date) => {
    const wd = berlinWeekdayIndex(date);
    const same = history.filter((h) => berlinWeekdayIndex(h.sale_date) === wd);
    const p = planned.filter((x) => x.date === date);
    let cost: number | null = 0;
    for (const x of p) {
      const w = wages[x.user_id];
      if (w == null) { missing.add(x.user_id); cost = null; } else if (cost != null) cost += (x.mins / 60) * w;
    }
    return { date, forecast: same.length ? Math.round(sumSales(same) / same.length) : null, hours: r1(p.reduce((a, x) => a + x.mins, 0) / 60), cost: cost == null ? null : Math.round(cost) };
  });
  // Sales forecast is complete when every day with planned hours has a forecast. With
  // nothing planned yet, show the whole week's expectation (helps plan the first shifts).
  const open = days.filter((d) => d.hours > 0);
  const basis = open.length ? open : days;
  const salesKnown = basis.every((d) => d.forecast != null);
  const sales = salesKnown ? days.reduce((a, d) => a + (d.forecast ?? 0), 0) : null;
  const cost = days.every((d) => d.cost != null) ? days.reduce((a, d) => a + (d.cost ?? 0), 0) : null;
  return {
    days, sales, cost, missingWages: missing.size,
    hours: r1(days.reduce((a, d) => a + d.hours, 0)),
    labourPct: sales && cost != null ? r1((cost / sales) * 100) : null,
  };
}

// Health score: share of routine work done on time, last 7 days. A part with nothing to
// measure is null and left out; the score is the mean of the parts that exist.
export type HealthPart = { key: "temps" | "checklists" | "sales" | "approvals"; done: number; total: number; score: number | null };
export function healthPart(key: HealthPart["key"], done: number, total: number): HealthPart {
  return { key, done, total, score: total > 0 ? Math.round((Math.min(done, total) / total) * 100) : null };
}
export function healthScore(parts: HealthPart[]): number | null {
  const s = parts.map((p) => p.score).filter((x): x is number => x != null);
  return s.length ? Math.round(s.reduce((a, b) => a + b, 0) / s.length) : null;
}
export const healthTone = (n: number | null) => (n == null ? "" : n >= 90 ? "good" : n >= 75 ? "warn" : "bad");

// Branch setup checklist (owner home): the routine data the owner figures depend on.
// The card disappears once every step is done.
export type SetupInput = { staff: number; staffWithoutWage: number; hasTargets: boolean; fridges: number; checklistTasks: number; salesDays: number; hasRoster: boolean };
export type SetupStep = { key: "wages" | "targets" | "fridges" | "checklists" | "sales" | "roster"; done: boolean; href: string; missing?: number };
export function setupSteps(x: SetupInput): SetupStep[] {
  return [
    { key: "wages", done: x.staff > 0 && x.staffWithoutWage === 0, href: "/labor", missing: x.staffWithoutWage || undefined },
    { key: "targets", done: x.hasTargets, href: "/targets" },
    { key: "fridges", done: x.fridges > 0, href: "/temp" },
    { key: "checklists", done: x.checklistTasks > 0, href: "/checklist" },
    { key: "sales", done: x.salesDays > 0, href: "/labor" },
    { key: "roster", done: x.hasRoster, href: "/schedule-hub" },
  ];
}

// Paid minutes of one roster entry: a preset shift (team|shift → times from the branch's
// shift catalogue, minus its break) or a custom "HH:MM–HH:MM" range. Unknown → null.
export type ShiftTimeDef = { team: string; shift: string; start: string; end: string; breakMins: number };
const hm = (s: string) => { const m = /^(\d{1,2}):(\d{2})$/.exec(s.trim()); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };
export function rosterEntryMinutes(e: { team?: string; shift?: string }, times: Map<string, ShiftTimeDef>): number | null {
  const preset = times.get(`${e.team}|${e.shift}`);
  const custom = !preset && e.shift ? e.shift.split(/[–\-—]/) : null;
  const start = preset ? hm(preset.start) : custom?.length === 2 ? hm(custom[0]) : null;
  const end = preset ? hm(preset.end) : custom?.length === 2 ? hm(custom[1]) : null;
  if (start == null || end == null) return null;
  let mins = end - start;
  if (mins <= 0) mins += 1440; // overnight
  return Math.max(0, mins - (preset?.breakMins ?? 0));
}
