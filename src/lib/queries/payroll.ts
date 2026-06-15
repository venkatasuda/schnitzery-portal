"use server";

import { createClient } from "@/lib/supabase/server";

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
function berlinParts(d: Date) {
  const f = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  const p: any = {}; for (const part of f.formatToParts(d)) p[part.type] = part.value;
  return { y: +p.year, mo: +p.month, da: +p.day, h: +(p.hour === "24" ? "0" : p.hour), mi: +p.minute, s: +p.second };
}

function nightOverlap(a: number, b: number, nStart: number, nEnd: number) {
  const ov = (s: number, e: number) => Math.max(0, Math.min(b, e) - Math.max(a, s));
  if (nStart < nEnd) return ov(nStart, nEnd);          // non-wrapping (e.g. 00:00–06:00)
  return ov(0, nEnd) + ov(nStart, 1440);               // wraps midnight (e.g. 22:00–06:00)
}

// Split one shift into weekend / holiday / night minutes (on the worked interval).
function classifyShift(inISO: string, outISO: string, holidays: Set<string>, nStart: number, nEnd: number) {
  const empty = { totalMin: 0, weekendMin: 0, holidayMin: 0, nightMin: 0 };
  if (!inISO || !outISO) return empty;
  const inUTC = new Date(inISO), outUTC = new Date(outISO);
  if (isNaN(inUTC.getTime()) || isNaN(outUTC.getTime()) || outUTC <= inUTC) return empty;
  const p = berlinParts(inUTC);
  const localStart = Date.UTC(p.y, p.mo - 1, p.da, p.h, p.mi, p.s);  // pseudo-UTC = Berlin wall clock
  const elapsed = outUTC.getTime() - inUTC.getTime();
  const end = localStart + elapsed;
  let cur = localStart, weekend = 0, holiday = 0, night = 0;
  while (cur < end) {
    const dd = new Date(cur);
    const dayStart = Date.UTC(dd.getUTCFullYear(), dd.getUTCMonth(), dd.getUTCDate());
    const segEnd = Math.min(end, dayStart + 86400000);
    const segMin = Math.round((segEnd - cur) / 60000);
    const iso = new Date(dayStart).toISOString().slice(0, 10);
    const dow = new Date(dayStart).getUTCDay();
    if (dow === 0 || dow === 6) weekend += segMin;
    if (holidays.has(iso)) holiday += segMin;
    night += Math.round(nightOverlap((cur - dayStart) / 60000, (segEnd - dayStart) / 60000, nStart, nEnd));
    cur = segEnd;
  }
  return { totalMin: Math.round(elapsed / 60000), weekendMin: weekend, holidayMin: holiday, nightMin: night };
}

function breakMins(breaks: any): number {
  if (!Array.isArray(breaks)) return 0;
  let m = 0;
  for (const b of breaks) {
    if (b?.start && b?.end) {
      const s = new Date(b.start), e = new Date(b.end);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) m += Math.round((e.getTime() - s.getTime()) / 60000);
    }
  }
  return m;
}

const h1 = (min: number) => Math.round(min / 6) / 10;   // minutes → hours, 1 decimal
function hhmmToMin(t: string) { const [h, m] = (t || "00:00").split(":").map(Number); return (h || 0) * 60 + (m || 0); }

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as string | null, branchId: null as string | null, name: null as string | null };
  const { data: p } = await supabase.from("users").select("role, branch_id, full_name").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null, name: p?.full_name ?? null };
}
function thisMonth() { return new Date().toISOString().slice(0, 7); }
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  return { start: `${ym}-01`, next: new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10) };
}

// ── Settings ────────────────────────────────────────────────────────────────
export async function getPayrollSettings() {
  const { supabase, branchId } = await getMgr();
  if (!branchId) return { ok: false as const, error: "No branch.", otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" };
  const { data } = await supabase.from("payroll_settings").select("ot_daily_hours, night_start, night_end").eq("branch_id", branchId).single();
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
  const { error } = await supabase.from("payroll_settings").upsert({
    branch_id: branchId,
    ot_daily_hours: Math.max(0, Math.min(24, input.otDailyHours || 8)),
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
  const { data } = await supabase.from("payroll_runs").select("status, approved_by, approved_at").eq("branch_id", branchId).eq("month", month).single();
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

  const { start, next } = monthBounds(ym);
  const settings = await getPayrollSettings();
  const otThreshold = (settings.otDailyHours || 8) * 60;
  const nStart = hhmmToMin(settings.nightStart), nEnd = hhmmToMin(settings.nightEnd);
  const years = new Set([Number(ym.slice(0, 4)), Number(ym.slice(0, 4)) + 1]);
  const holidays = new Set<string>(); years.forEach((y) => bwHolidays(y).forEach((h) => holidays.add(h)));

  const { data: logs } = await supabase.from("attendance_logs")
    .select("user_id, work_date, clock_in, clock_out, duration_mins, breaks, status")
    .eq("branch_id", branchId).eq("status", "complete")
    .gte("work_date", start).lt("work_date", next);

  const { data: staff } = await supabase.from("users")
    .select("id, employee_code, full_name, team, hourly_wage").eq("branch_id", branchId).order("full_name");

  type Acc = { gross: number; brk: number; weekend: number; holiday: number; night: number; shifts: number; perDayPaid: Record<string, number> };
  const acc: Record<string, Acc> = {};
  for (const l of logs || []) {
    const gross = l.duration_mins || 0;
    if (gross <= 0) continue;
    const brk = breakMins(l.breaks);
    const paid = Math.max(0, gross - brk);
    const c = classifyShift(l.clock_in, l.clock_out, holidays, nStart, nEnd);
    if (!acc[l.user_id]) acc[l.user_id] = { gross: 0, brk: 0, weekend: 0, holiday: 0, night: 0, shifts: 0, perDayPaid: {} };
    const a = acc[l.user_id];
    a.gross += gross; a.brk += brk; a.weekend += c.weekendMin; a.holiday += c.holidayMin; a.night += c.nightMin; a.shifts += 1;
    a.perDayPaid[l.work_date] = (a.perDayPaid[l.work_date] || 0) + paid;
  }

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
    const wage = s.hourly_wage ?? null;
    const gross = wage != null ? Math.round(h1(paidMin) * wage * 100) / 100 : null;
    return {
      code: s.employee_code || "", name: s.full_name, team: s.team || "", shifts: a.shifts,
      regularH: h1(regular), overtimeH: h1(overtime),
      weekendH: h1(a.weekend), holidayH: h1(a.holiday), nightH: h1(a.night),
      breakH: h1(a.brk), paidH: h1(paidMin), unpaidH: h1(a.brk),
      wage, gross,
    };
  }).filter(Boolean) as any[];

  const totals = rows.reduce((t, r) => ({
    regularH: t.regularH + r.regularH, overtimeH: t.overtimeH + r.overtimeH,
    weekendH: t.weekendH + r.weekendH, holidayH: t.holidayH + r.holidayH, nightH: t.nightH + r.nightH,
    breakH: t.breakH + r.breakH, paidH: t.paidH + r.paidH, unpaidH: t.unpaidH + r.unpaidH,
    gross: t.gross + (r.gross || 0),
  }), emptyTotals());
  for (const k of Object.keys(totals) as (keyof typeof totals)[]) totals[k] = Math.round(totals[k] * 100) / 100;

  const run = await getPayrollRun(ym);
  return { ok: true as const, month: ym, rows, totals, settings: { otDailyHours: settings.otDailyHours, nightStart: settings.nightStart, nightEnd: settings.nightEnd }, run: { status: run.status, approvedBy: run.approvedBy, approvedAt: run.approvedAt } };
}

function emptyTotals() {
  return { regularH: 0, overtimeH: 0, weekendH: 0, holidayH: 0, nightH: 0, breakH: 0, paidH: 0, unpaidH: 0, gross: 0 };
}