"use server";


import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { berlinMonth, monthRange } from "@/lib/time/berlinDate";
import { classifyShift, shiftMinutes, payForMinutes } from "@/lib/pay/calculations";
import { activeBranchFor } from "@/lib/activeBranch";

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
  return { supabase, user, role: p?.role ?? null, branchId: await activeBranchFor(supabase, p), homeBranchId: p?.branch_id ?? null, name: p?.full_name ?? null };
}
function thisMonth() { return berlinMonth(); }
export async function getPayrollSettings() {
  const { supabase, branchId, role } = await getMgr();
  if (!MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only.", otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" };
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
  const { supabase, branchId, role } = await getMgr();
  if (!MGR.includes(role ?? "")) return { ok: false as const, status: "draft" as const, error: "Managers only." };
  try { monthRange(month); } catch { return { ok: false as const, status: "draft" as const, error: "Invalid month." }; }
  if (!branchId) return { ok: false as const, status: "draft" as const };
  const { data, error } = await supabase.from("payroll_runs").select("status, approved_by, approved_at, approval_id").eq("branch_id", branchId).eq("month", month).maybeSingle();
  if (error) return { ok: false as const, status: "draft" as const, error: error.message };
  return { ok: true as const, status: (data?.status ?? "draft") as "draft" | "approved", approvedBy: data?.approved_by ?? null, approvedAt: data?.approved_at ?? null, approvalId: data?.approval_id ?? null };
}

export async function setPayrollApproval(month: string, approve: boolean, note?: string, expectedRevision?: string) {
  const { user, role, branchId } = await getMgr();
  if (!branchId || !MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only." };
  try { monthRange(month); } catch { return { ok: false as const, error: "Invalid month." }; }
  if (typeof approve !== "boolean" || (note !== undefined && (typeof note !== "string" || note.length > 2000))) return { ok: false as const, error: "Invalid approval request." };
  let snapshot = null;
  if (approve) {
    if (typeof expectedRevision !== "string" || !/^[a-f0-9]{32}$/.test(expectedRevision)) return { ok: false as const, error: "Reload and review payroll before approval." };
    const summary = await getPayrollSummary(month);
    if (!summary.ok) return { ok: false as const, error: summary.error };
    if (!summary.readiness.canApprove) return { ok: false as const, error: "Approval requires a closed month, approved shifts, valid attendance and wages." };
    if (summary.revision !== expectedRevision) return { ok: false as const, error: "Payroll changed; reload and review before approval." };
    snapshot = { month, wageBasis: "effective-dated", revision: summary.revision, rows: summary.rows, totals: summary.totals, settings: summary.settings };
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!user || !url || !key) return { ok: false as const, error: "Payroll approval is not configured." };
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.rpc("set_payroll_approval_atomic", {
    p_actor: user.id, p_branch: branchId, p_month: month, p_approve: approve, p_revision: expectedRevision ?? null, p_snapshot: snapshot, p_note: note ?? null,
  });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// ── The summary ──────────────────────────────────────────────────────────────
export async function getPayrollSummary(month?: string, approvalId?: string) {
  const ym = month || thisMonth();
  const blank = { ok: false as const, month: ym, rows: [] as any[], totals: emptyTotals(), settings: { otDailyHours: 8, nightStart: "22:00", nightEnd: "06:00" }, run: { status: "draft" as "draft" | "approved", approvedBy: null as string | null, approvedAt: null as string | null, frozen: false, archived: false }, revision: "", history: [] as { id: string; approved_name: string; approved_at: string }[], readiness: { canApprove: false, unapprovedShifts: 0, missingWages: 0, invalidShifts: 0, monthClosed: false } };
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ...blank, error: "Not logged in." };
  if (!MGR.includes(role ?? "")) return { ...blank, error: "Managers only." };
  if (!branchId) return { ...blank, error: "No branch." };

  try { monthRange(ym); } catch { return { ...blank, error: "Invalid month." }; }
  if (approvalId !== undefined && (typeof approvalId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(approvalId))) return { ...blank, error: "Invalid approval." };
  const { data: history, error: historyError } = await supabase.from("payroll_approvals").select("id, approved_name, approved_at").eq("branch_id", branchId).eq("month", ym).order("approved_at", { ascending: false }).limit(50);
  if (historyError) return { ...blank, error: historyError.message };
  const run = await getPayrollRun(ym);
  if (!run.ok) return { ...blank, error: run.error || "Payroll approval unavailable." };
  const savedId = approvalId || (run.status === "approved" ? run.approvalId : null);
  if (savedId) {
    const { data, error } = await supabase.from("payroll_approvals").select("snapshot, approved_name, approved_at").eq("id", savedId).eq("branch_id", branchId).eq("month", ym).single();
    if (error || !data?.snapshot) return { ...blank, error: error?.message || "Approved snapshot unavailable." };
    const saved = data.snapshot;
    return { ...blank, ok: true as const, history: history || [], rows: saved.rows as any[], totals: saved.totals as ReturnType<typeof emptyTotals>, settings: saved.settings as typeof blank.settings, revision: saved.revision as string,
      run: { status: "approved" as const, approvedBy: data.approved_name, approvedAt: data.approved_at, frozen: true, archived: !!approvalId } };
  }
  const { data: inputs, error: inputError } = await supabase.rpc("get_payroll_inputs", { p_branch: branchId, p_month: ym });
  if (inputError || !inputs?.source) return { ...blank, error: inputError?.message || "Payroll inputs unavailable." };
  if (inputs.source.wageBasis !== "effective-dated") return { ...blank, error: "Effective-dated wage history is not configured." };
  const { logs, staff: staffRows, wages, settings } = inputs.source as { logs: any[]; staff: any[]; wages: any[]; settings: typeof blank.settings };
  const otThreshold = settings.otDailyHours * 60;
  const nStart = hhmmToMin(settings.nightStart), nEnd = hhmmToMin(settings.nightEnd);
  const years = new Set([Number(ym.slice(0, 4)), Number(ym.slice(0, 4)) + 1]);
  const holidays = new Set<string>(); years.forEach((y) => bwHolidays(y).forEach((h) => holidays.add(h)));

  const payWages: Record<string, number | null> = {};
  for (const w of wages) payWages[`${w.user_id}|${w.work_date}`] = w.hourly_wage == null ? null : Number(w.hourly_wage);
  const staff = (staffRows || []).map((s) => ({ ...s }));
  const unapprovedShifts = logs.filter(l => l.approval_status !== "approved").length;
  const workedIds = new Set(logs.map(l => l.user_id));
  const missingWages = [...workedIds].filter(id => !staff.some(s => s.id === id) || logs.some(l => l.user_id === id &&
    (payWages[`${id}|${l.work_date}`] == null || !Number.isFinite(payWages[`${id}|${l.work_date}`]) || payWages[`${id}|${l.work_date}`]! < 0))).length;
  for (const id of workedIds) if (!staff.some(s => s.id === id)) staff.push({ id, full_name: "Unassigned employee", employee_code: "", team: "", hourly_wage: null });
  staff.sort((a, b) => String(a.full_name || "").localeCompare(String(b.full_name || ""), "en"));
  const invalidLogs = logs.filter(l => !l.clock_in || !l.clock_out || !(Date.parse(l.clock_out) > Date.parse(l.clock_in)) || shiftMinutes(l).grossMin <= 0);
  const invalidShifts = invalidLogs.length;
  const monthClosed = ym < berlinMonth();
  const readiness = { canApprove: run.status === "draft" && logs.length > 0 && monthClosed && !unapprovedShifts && !missingWages && !invalidShifts, unapprovedShifts, missingWages, invalidShifts, monthClosed };

  type Acc = { gross: number; brk: number; weekend: number; holiday: number; night: number; shifts: number; perDayPaid: Record<string, number>; rates: Record<string, { wage: number; paidMin: number }> };
  const acc: Record<string, Acc> = {};
  for (const l of logs || []) {
    if (!acc[l.user_id]) acc[l.user_id] = { gross: 0, brk: 0, weekend: 0, holiday: 0, night: 0, shifts: 0, perDayPaid: {}, rates: {} };
    acc[l.user_id].shifts += 1;
    const { grossMin: gross, breakMin: brk, paidMin: paid } = shiftMinutes(l);
    if (gross <= 0) continue;
    const c = classifyShift(l.clock_in, l.clock_out, holidays, nStart, nEnd);
    const a = acc[l.user_id];
    a.gross += gross; a.brk += brk; a.weekend += c.weekendMin; a.holiday += c.holidayMin; a.night += c.nightMin;
    a.perDayPaid[l.work_date] = (a.perDayPaid[l.work_date] || 0) + paid;
    const wage = payWages[`${l.user_id}|${l.work_date}`];
    if (wage != null && Number.isFinite(wage) && wage >= 0) {
      const key = String(wage);
      if (!a.rates[key]) a.rates[key] = { wage, paidMin: 0 };
      a.rates[key].paidMin += paid;
    }
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
    const rates = Object.values(a.rates);
    const wage = rates.length === 1 ? rates[0].wage : null;
    const invalidForEmployee = invalidLogs.filter(l => l.user_id === s.id).length;
    const missingForEmployee = logs.some(l => l.user_id === s.id && (payWages[`${s.id}|${l.work_date}`] == null || !Number.isFinite(payWages[`${s.id}|${l.work_date}`]) || payWages[`${s.id}|${l.work_date}`]! < 0));
    const gross = rates.length && !missingForEmployee && !invalidForEmployee ? Math.round(rates.reduce((sum, r) => sum + payForMinutes(r.paidMin, r.wage), 0) * 100) / 100 : null;
    return {
      userId: s.id, code: s.employee_code || "", name: s.full_name, team: s.team || "", shifts: a.shifts,
      regularH: h1(regular), overtimeH: h1(overtime),
      weekendH: h1(a.weekend), holidayH: h1(a.holiday), nightH: h1(a.night),
      breakH: h1(a.brk), paidH: h1(paidMin), unpaidH: h1(a.brk),
      wage, rates, gross, invalidShifts: invalidForEmployee,
    };
  }).filter(Boolean) as any[];

  const totals = { ...minuteTotals, gross: missingWages || invalidShifts ? null : Math.round(rows.reduce((sum, row) => sum + (row.gross || 0), 0) * 100) / 100 };
  for (const key of Object.keys(minuteTotals) as (keyof typeof totals)[]) if (key !== "gross") totals[key] = h1(minuteTotals[key]);

  return { ok: true as const, month: ym, history: history || [], rows, totals, settings, revision: inputs.revision as string, readiness, run: { status: run.status, approvedBy: run.approvedBy, approvedAt: run.approvedAt, frozen: false, archived: false } };
}

function emptyTotals() {
  return { regularH: 0, overtimeH: 0, weekendH: 0, holidayH: 0, nightH: 0, breakH: 0, paidH: 0, unpaidH: 0, gross: 0 };
}
