"use server";
import { readAll } from "@/lib/supabase/readAll";


import { createClient } from "@/lib/supabase/server";
import { berlinMonth, monthRange } from "@/lib/time/berlinDate";
import { wageMapForBranches } from "@/lib/pay/wages";
import { classifyShift, shiftMinutes, payForMinutes } from "@/lib/pay/calculations";

// ============================================================================
// PAYROLL ENGINE — per-employee monthly hour breakdown for a branch.
// For each completed shift we split worked minutes into: weekend (Sat/Sun),
// holiday (Baden-Württemberg public holidays), and night (configurable window).
// These three are OVERLAPPING "of which" markers. Separately we split PAID time
// into regular vs overtime (paid hours/day beyond the branch threshold), and
// deduct unpaid breaks. Gross pay = paid hours × hourly wage (premiums for
// night/weekend/holiday are reported as hours; add pay rates later if needed).
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

// ── Baden-Württemberg public holidays (Meeus/Jones/Butcher Easter) ──────────
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}
function bwHolidays(year: number): string[] {
  const e = easter(year);
  const off = (n: number) => { const d = new Date(e); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  return [`${year}-01-01`, `${year}-01-06`, off(-2), off(1), `${year}-05-01`, off(39), off(50), off(60),
          `${year}-10-03`, `${year}-11-01`, `${year}-12-25`, `${year}-12-26`];
}

// ── Berlin wall-clock components for a UTC instant ──────────────────────────
const h1 = (min: number) => Math.round(min / 6) / 10;   // minutes → hours, 1 decimal
function hhmmToMin(t: string) { if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) throw new Error("Invalid payroll time."); const [h, m] = t.split(":").map(Number); return h * 60 + m; }

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as string | null, branchId: null as string | null, name: null as string | null };
  const { data: p } = await supabase.from("users").select("role, branch_id, full_name").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null, name: p?.full_name ?? null };
}
function thisMonth() { return berlinMonth(); }
export async function getPayrollSettings() {
  const { supabase, branchId } = await getMgr();
  if (!branchId) return { ok: false as const, error: "No branch.", otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" };
  const { data, error } = await supabase.from("payroll_settings").select("ot_daily_hours, night_start, night_end").eq("branch_id", branchId).maybeSingle();
  if (error) return { ok: false as const, error: error.message, otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" };
  return {
    ok: true as const,
    otDailyHours: Number(data?.ot_daily_hours ?? 8),
    nightStart: (data?.night_start ?? "22:00").slice(0, 5),
    nightEnd: (data?.night_end ?? "06:00").slice(0, 5),
  };
}

export async function setPayrollSettings(input: { otDailyHours: number; nightStart: string; nightEnd: string }) {
  const { supabase, role, branchId, name } = await getMgr();
  if (!branchId || !MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only." };
  if (!input || !Number.isFinite(input.otDailyHours) || input.otDailyHours < 0 || input.otDailyHours > 24 || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.nightStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.nightEnd)) return { ok: false as const, error: "Invalid payroll settings." };
  const { error } = await supabase.from("payroll_settings").upsert({
    branch_id: branchId,
    ot_daily_hours: input.otDailyHours,
    night_start: input.nightStart || "22:00",
    night_end: input.nightEnd || "06:00",
    updated_by: name ?? "manager", updated_at: new Date().toISOString(),
  }, { onConflict: "branch_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// ── Monthly approval ─────────────────────────────────────────────────────────
export async function getPayrollRun(month: string) {
  const { supabase, branchId } = await getMgr();
  if (!branchId) return { ok: false as const, status: "draft" as const };
  const { data, error } = await supabase.from("payroll_runs").select("status, approved_by, approved_at").eq("branch_id", branchId).eq("month", month).maybeSingle();
  if (error) return { ok: false as const, status: "draft" as const, error: error.message };
  return { ok: true as const, status: (data?.status ?? "draft") as "draft" | "approved", approvedBy: data?.approved_by ?? null, approvedAt: data?.approved_at ?? null };
}

export async function setPayrollApproval(month: string, approve: boolean, note?: string) {
  const { supabase, role, branchId, name } = await getMgr();
  if (!branchId || !MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only." };
  const { error } = await supabase.from("payroll_runs").upsert({
    branch_id: branchId, month,
    status: approve ? "approved" : "draft",
    approved_by: approve ? (name ?? "manager") : null,
    approved_at: approve ? new Date().toISOString() : null,
    note: note ?? null,
  }, { onConflict: "branch_id,month" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// ── The summary ──────────────────────────────────────────────────────────────
export async function getPayrollSummary(month?: string) {
  const ym = month || thisMonth();
  const blank = { ok: false as const, month: ym, rows: [] as any[], totals: emptyTotals(), settings: { otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" }, run: { status: "draft" as const, approvedBy: null, approvedAt: null } };
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ...blank, error: "Not logged in." };
  if (!MGR.includes(role ?? "")) return { ...blank, error: "Managers only." };

  const { from: start, next } = monthRange(ym);
  const settings = await getPayrollSettings();
  if (!settings.ok) return { ...blank, error: settings.error || "Payroll settings unavailable." };
  const otThreshold = settings.otDailyHours * 60;
  const nStart = hhmmToMin(settings.nightStart), nEnd = hhmmToMin(settings.nightEnd);
  const years = new Set([Number(ym.slice(0, 4)), Number(ym.slice(0, 4)) + 1]);
  const holidays = new Set<string>(); years.forEach((y) => bwHolidays(y).forEach((h) => holidays.add(h)));

  const { data: logs, error: logsError } = await readAll(supabase.from("attendance_logs")
    .select("user_id, work_date, clock_in, clock_out, duration_mins, breaks, status")
    .eq("branch_id", branchId).eq("status", "complete")
    .gte("work_date", start).lt("work_date", next).order("id"));

  const { data: staffRows, error: staffError } = await readAll(supabase.from("users")
    .select("id, employee_code, full_name, team").eq("branch_id", branchId).order("full_name").order("id"));
  if (logsError || staffError) return { ...blank, error: (logsError || staffError)!.message };
  // Wages live in user_pay, not users — see src/lib/pay/wages.ts (item 18).
  const payWages = await wageMapForBranches(supabase, [branchId]);
  const staff = (staffRows || []).map((s) => ({ ...s, hourly_wage: payWages[s.id] ?? null }));

  type Acc = { gross: number; brk: number; weekend: number; holiday: number; night: number; shifts: number; perDayPaid: Record<string, number> };
  const acc: Record<string, Acc> = {};
  for (const l of logs || []) {
    const { grossMin: gross, breakMin: brk, paidMin: paid } = shiftMinutes(l);
    if (gross <= 0) continue;
    const c = classifyShift(l.clock_in, l.clock_out, holidays, nStart, nEnd);
    if (!acc[l.user_id]) acc[l.user_id] = { gross: 0, brk: 0, weekend: 0, holiday: 0, night: 0, shifts: 0, perDayPaid: {} };
    const a = acc[l.user_id];
    a.gross += gross; a.brk += brk; a.weekend += c.weekendMin; a.holiday += c.holidayMin; a.night += c.nightMin; a.shifts += 1;
    a.perDayPaid[l.work_date] = (a.perDayPaid[l.work_date] || 0) + paid;
  }

  const minuteTotals = emptyTotals();
  const rows = (staff || []).map((s) => {
    const a = acc[s.id];
    if (!a || a.shifts === 0) return null;
    let regular = 0, overtime = 0;
    for (const day in a.perDayPaid) {
      const p = a.perDayPaid[day];
      const ot = Math.max(0, p - otThreshold);
      overtime += ot; regular += p - ot;
    }
    const paidMin = regular + overtime;
    minuteTotals.regularH += regular; minuteTotals.overtimeH += overtime;
    minuteTotals.weekendH += a.weekend; minuteTotals.holidayH += a.holiday; minuteTotals.nightH += a.night;
    minuteTotals.breakH += a.brk; minuteTotals.paidH += paidMin; minuteTotals.unpaidH += a.brk;
    const wage = s.hourly_wage ?? null;
    const gross = wage != null ? payForMinutes(paidMin, wage) : null;
    return {
      code: s.employee_code || "", name: s.full_name, team: s.team || "", shifts: a.shifts,
      regularH: h1(regular), overtimeH: h1(overtime),
      weekendH: h1(a.weekend), holidayH: h1(a.holiday), nightH: h1(a.night),
      breakH: h1(a.brk), paidH: h1(paidMin), unpaidH: h1(a.brk),
      wage, gross,
    };
  }).filter(Boolean) as any[];

  const totals = { ...minuteTotals, gross: Math.round(rows.reduce((sum, row) => sum + (row.gross || 0), 0) * 100) / 100 };
  for (const key of Object.keys(minuteTotals) as (keyof typeof totals)[]) if (key !== "gross") totals[key] = h1(minuteTotals[key]);

  const run = await getPayrollRun(ym);
  if (!run.ok) return { ...blank, error: run.error || "Payroll approval unavailable." };
  return { ok: true as const, month: ym, rows, totals, settings: { otDailyHours: settings.otDailyHours, nightStart: settings.nightStart, nightEnd: settings.nightEnd }, run: { status: run.status, approvedBy: run.approvedBy, approvedAt: run.approvedAt } };
}

function emptyTotals() {
  return { regularH: 0, overtimeH: 0, weekendH: 0, holidayH: 0, nightH: 0, breakH: 0, paidH: 0, unpaidH: 0, gross: 0 };
}