"use server";
import { readAll } from "@/lib/supabase/readAll";
import { figure, missingSalesDays, pctOf, spendFigure } from "@/lib/analytics/coverage";


import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { monthRange, isCalendarDate, berlinToday } from "@/lib/time/berlinDate";
import { shiftMinutes, payForMinutes } from "@/lib/pay/calculations";
import { wageMapForBranches, setWage } from "@/lib/pay/wages";

// Labor cost = Σ(hours worked × hourly wage). Labor cost % = labor ÷ sales.
// Managers enter daily sales + each person's wage. All branch-scoped, manager-only.

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

export async function getLaborSummary() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { from: first, next } = monthRange();

  // wages — from user_pay, not users. See src/lib/pay/wages.ts (item 18).
  const wages = await wageMapForBranches(supabase, [branchId]);
  const wageOf: Record<string, number> = {};
  let withWage = 0;
  for (const [id, w] of Object.entries(wages)) { wageOf[id] = w ?? 0; if (w != null) withWage++; }

  // Headcount still comes from users — only the wage column moved.
  const { count: staffCount } = await supabase
    .from("users").select("id", { count: "exact", head: true }).eq("branch_id", branchId);

  // labor cost from completed attendance this month
  const { data: logs, error: logsError } = await readAll(supabase
    .from("attendance_logs").select("user_id, work_date, duration_mins, breaks, clock_in, clock_out, status")
    .eq("branch_id", branchId).gte("work_date", first).lt("work_date", next).eq("status", "complete").order("id"));
  if (logsError) return { ok: false, error: logsError.message };
  const paidByUser: Record<string, number> = {};
  for (const l of logs || []) paidByUser[l.user_id] = (paidByUser[l.user_id] || 0) + shiftMinutes(l).paidMin;
  const laborCost = Object.entries(paidByUser).reduce((sum, [id, minutes]) => sum + payForMinutes(minutes, wageOf[id] || 0), 0);
  const missingWageStaff = Object.keys(paidByUser).filter(id => wages[id] == null).length;

  // sales this month
  const { data: sales, error: salesError } = await readAll(supabase
    .from("daily_sales").select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", first).lt("sale_date", next).lte("sale_date", berlinToday()).order("id"));
  if (salesError) return { ok: false, error: salesError.message };
  let monthSales = 0;
  for (const s of sales || []) monthSales += Number(s.amount) || 0;


  // inventory spend this month → food cost % (safe if the deliveries table doesn't exist yet)
  const { data: purch, error: purchErr } = await readAll(supabase
    .from("inventory_purchases").select("cost").eq("branch_id", branchId).gte("purchase_date", first).lt("purchase_date", next).lte("purchase_date", berlinToday()).order("id"));
  if (purchErr) return { ok: false, error: purchErr.message };
  // Release D: missing sales days, wages or delivery costs are never zero; ratios need complete inputs.
  const worked = (logs || []).filter(l => shiftMinutes(l).paidMin > 0).map(l => ({ branch_id: branchId, work_date: l.work_date }));
  const coverage = {
    sales: figure(monthSales, { salesDays: missingSalesDays(worked, (sales || []).map(s => ({ branch_id: branchId, sale_date: s.sale_date })), berlinToday()) }),
    labor: figure(laborCost, { wages: missingWageStaff }),
    spend: spendFigure(purch || []),
  };
  const monthInvSpend = coverage.spend.value;
  const laborPct = pctOf(coverage.labor, coverage.sales);
  const foodCostPct = pctOf(coverage.spend, coverage.sales); // purchases ÷ sales, labelled as such

  return {
    ok: true,
    laborCost: Math.round(laborCost),
    monthSales: Math.round(monthSales),
    recordedSalesDays: sales?.length || 0,
    laborPct,
    invSpend: Math.round(monthInvSpend),
    foodCostPct,
    staffCount: staffCount || 0,
    withWage,
    missingWageStaff,
    coverage,
  };
}

export async function setDailySales(saleDate: string, amount: number) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  if (!isCalendarDate(saleDate) || saleDate > berlinToday() || !Number.isFinite(amount) || amount < 0) return { ok: false, error: "Invalid sales date or amount." };
  const { error } = await supabase
    .from("daily_sales")
    .upsert({ branch_id: branchId, sale_date: saleDate, amount }, { onConflict: "branch_id,sale_date" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getRecentSales() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in.", sales: [] };
  if (!isManager(role)) return { ok: false, error: "Managers only.", sales: [] };
  const { data, error } = await supabase
    .from("daily_sales").select("id, sale_date, amount")
    .eq("branch_id", branchId).order("sale_date", { ascending: false }).limit(10);
  if (error) return { ok: false, error: error.message, sales: [] };
  return { ok: true, sales: data || [] };
}

export async function getStaffWages() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in.", staff: [] };
  if (!isManager(role)) return { ok: false, error: "Managers only.", staff: [] };
  const { data, error } = await readAll(supabase
    .from("users").select("id, full_name, team").eq("branch_id", branchId).order("full_name").order("id"));
  if (error) return { ok: false, error: error.message, staff: [] };

  // Wages come from user_pay (item 18) and are stitched on here, so the shape
  // the page receives is unchanged.
  const wages = await wageMapForBranches(supabase, [branchId]);
  const { data: history, error: historyError } = await readAll(supabase.from("wage_history")
    .select("id,user_id,hourly_wage,effective_from,recorded_at").eq("branch_id", branchId)
    .order("effective_from", { ascending: false, nullsFirst: false }).order("id", { ascending: false }));
  if (historyError) return { ok: false, error: historyError.message, staff: [] };
  const staff = (data || []).map((s) => ({ ...s, hourly_wage: wages[s.id] ?? null,
    history: (history || []).filter(h => h.user_id === s.id) }));
  return { ok: true, staff };
}

export async function setStaffWage(userId: string, wage: number, effectiveFrom: string) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  if (!isCalendarDate(effectiveFrom) || effectiveFrom < "2000-01-01" || effectiveFrom > berlinToday() || !Number.isFinite(wage) || wage < 0) return { ok: false, error: "Enter a valid wage and its actual effective date." };
  const { data: tgt } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "Not in your branch." };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { ok: false, error: "Wage history is not configured." };
  const admin = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const res = await setWage(admin, userId, tgt.branch_id, wage, user.id, effectiveFrom);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

// ── Monthly ops summary: one rollup of the month's key numbers + per-staff rows ──
export async function getMonthlySummary(month?: string) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { ym, from, to } = monthRange(month);

  const { data: staff, error: staffError } = await readAll(supabase.from("users")
    .select("id, full_name, team, contract_hours")
    .eq("branch_id", branchId).order("id"));
  if (staffError) return { ok: false, error: staffError.message };
  const monthWages = await wageMapForBranches(supabase, [branchId]);
  const info: Record<string, any> = {};
  for (const s of staff || []) info[s.id] = { ...s, hourly_wage: monthWages[s.id] ?? null };

  const { data: logs, error: logsError } = await readAll(supabase.from("attendance_logs")
    .select("user_id, work_date, duration_mins, breaks, clock_in, clock_out, late_mins, status")
    .eq("branch_id", branchId).gte("work_date", from).lte("work_date", to).eq("status", "complete").order("id"));
  if (logsError) return { ok: false, error: logsError.message };

  const per: Record<string, { mins: number; shifts: number; late: number }> = {};
  let totalMins = 0, shifts = 0, lateShifts = 0;
  for (const l of logs || []) {
    const u = l.user_id;
    per[u] = per[u] || { mins: 0, shifts: 0, late: 0 };
    per[u].mins += shiftMinutes(l).paidMin;
    per[u].shifts += 1;
    if ((l.late_mins || 0) > 0) { per[u].late += 1; lateShifts++; }
    totalMins += shiftMinutes(l).paidMin;
    shifts += 1;
  }

  const { data: sales, error: salesError } = await readAll(supabase.from("daily_sales")
    .select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", from).lte("sale_date", to).order("id"));
  if (salesError) return { ok: false, error: salesError.message };
  let monthSales = 0;
  for (const s of sales || []) monthSales += Number(s.amount) || 0;

  const { data: purch, error: purchErr } = await readAll(supabase.from("inventory_purchases")
    .select("cost").eq("branch_id", branchId).gte("purchase_date", from).lte("purchase_date", to).order("id"));
  if (purchErr) return { ok: false, error: purchErr.message };
  const spend = spendFigure(purch || []); // deliveries without a cost are missing, not €0
  const foodSpend = spend.value;

  let laborCost = 0, overtimeHrs = 0, missingWage = 0;
  const rows = Object.keys(per).map((uid) => {
    const s = info[uid] || {};
    const hrs = Math.round((per[uid].mins / 60) * 10) / 10;
    const known = s.hourly_wage != null;
    const wage = s.hourly_wage || 0;
    if (!known && per[uid].mins > 0) missingWage++;
    laborCost += payForMinutes(per[uid].mins, wage);
    const contract = s.contract_hours || 0;
    const ot = contract > 0 ? Math.max(0, Math.round((hrs - contract) * 10) / 10) : 0;
    overtimeHrs += ot;
    return {
      name: s.full_name || "—", team: s.team || "—",
      hours: hrs, shifts: per[uid].shifts, late: per[uid].late,
      overtime: ot, laborCost: known ? payForMinutes(per[uid].mins, wage) : null,
    };
  }).sort((a, b) => b.hours - a.hours);

  const totalHours = Math.round((totalMins / 60) * 10) / 10;
  // Release D: ratios only on complete inputs (wages, delivery costs, sales on every open day).
  const worked = (logs || []).filter(l => shiftMinutes(l).paidMin > 0).map(l => ({ branch_id: branchId, work_date: l.work_date }));
  const coverage = {
    sales: figure(monthSales, { salesDays: missingSalesDays(worked, (sales || []).map(s => ({ branch_id: branchId, sale_date: s.sale_date })), berlinToday()) }),
    labor: figure(laborCost, { wages: missingWage }),
    spend,
  };
  const laborPct = pctOf(coverage.labor, coverage.sales);
  const foodPct = pctOf(coverage.spend, coverage.sales);
  const primePct = (laborPct != null && foodPct != null) ? Math.round((laborPct + foodPct) * 10) / 10 : null;
  const lateRate = shifts > 0 ? Math.round((lateShifts / shifts) * 1000) / 10 : null;

  return {
    ok: true, month: ym,
    sales: Math.round(monthSales),
    laborCost: Math.round(laborCost), laborPct,
    foodSpend: Math.round(foodSpend), foodPct, primePct,
    totalHours, shifts, lateShifts, lateRate,
    overtimeHrs: Math.round(overtimeHrs * 10) / 10,
    rows,
    hasSales: monthSales > 0, hasFood: spend.complete,
    coverage, complete: coverage.sales.complete && coverage.labor.complete && coverage.spend.complete,
  };
}
