"use server";

import { createClient } from "@/lib/supabase/server";
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

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // wages — from user_pay, not users. See src/lib/pay/wages.ts (item 18).
  const wages = await wageMapForBranches(supabase, [branchId]);
  const wageOf: Record<string, number> = {};
  let withWage = 0;
  for (const [id, w] of Object.entries(wages)) { wageOf[id] = w || 0; if (w) withWage++; }

  // labor cost from completed attendance this month
  const { data: logs } = await supabase
    .from("attendance_logs").select("user_id, duration_mins, status")
    .eq("branch_id", branchId).gte("work_date", first).eq("status", "complete");
  let laborCost = 0;
  for (const l of logs || []) laborCost += ((l.duration_mins || 0) / 60) * (wageOf[l.user_id] || 0);

  // sales this month
  const { data: sales } = await supabase
    .from("daily_sales").select("amount").eq("branch_id", branchId).gte("sale_date", first);
  let monthSales = 0;
  for (const s of sales || []) monthSales += Number(s.amount) || 0;

  const laborPct = monthSales > 0 ? Math.round((laborCost / monthSales) * 1000) / 10 : null;

  // inventory spend this month → food cost % (safe if the deliveries table doesn't exist yet)
  const { data: purch, error: purchErr } = await supabase
    .from("inventory_purchases").select("cost").eq("branch_id", branchId).gte("purchase_date", first);
  let monthInvSpend = 0;
  for (const p of purch || []) monthInvSpend += Number(p.cost) || 0;
  const foodCostPct = (!purchErr && monthSales > 0) ? Math.round((monthInvSpend / monthSales) * 1000) / 10 : null;

  return {
    ok: true,
    laborCost: Math.round(laborCost),
    monthSales: Math.round(monthSales),
    laborPct,
    invSpend: Math.round(monthInvSpend),
    foodCostPct,
    staffCount: (staff || []).length,
    withWage,
  };
}

export async function setDailySales(saleDate: string, amount: number) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
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
  const { data, error } = await supabase
    .from("users").select("id, full_name, team").eq("branch_id", branchId).order("full_name");
  if (error) return { ok: false, error: error.message, staff: [] };

  // Wages come from user_pay (item 18) and are stitched on here, so the shape
  // the page receives is unchanged.
  const wages = await wageMapForBranches(supabase, [branchId]);
  const staff = (data || []).map((s) => ({ ...s, hourly_wage: wages[s.id] ?? null }));
  return { ok: true, staff };
}

export async function setStaffWage(userId: string, wage: number) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "Not in your branch." };

  const res = await setWage(supabase, userId, tgt.branch_id, wage, user.id);
  if (!res.ok) return { ok: false, error: res.error };
  return { ok: true };
}

// ── Monthly ops summary: one rollup of the month's key numbers + per-staff rows ──
export async function getMonthlySummary(month?: string) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const now = new Date();
  const ym = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [Y, M] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const to = new Date(Date.UTC(Y, M, 0)).toISOString().slice(0, 10); // last day of the month

  const { data: staff } = await supabase.from("users")
    .select("id, full_name, team, contract_hours")
    .eq("branch_id", branchId);
  const monthWages = await wageMapForBranches(supabase, [branchId]);
  const info: Record<string, any> = {};
  for (const s of staff || []) info[s.id] = { ...s, hourly_wage: monthWages[s.id] ?? null };

  const { data: logs } = await supabase.from("attendance_logs")
    .select("user_id, duration_mins, late_mins, status")
    .eq("branch_id", branchId).gte("work_date", from).lte("work_date", to).eq("status", "complete");

  const per: Record<string, { mins: number; shifts: number; late: number }> = {};
  let totalMins = 0, shifts = 0, lateShifts = 0;
  for (const l of logs || []) {
    const u = l.user_id;
    per[u] = per[u] || { mins: 0, shifts: 0, late: 0 };
    per[u].mins += l.duration_mins || 0;
    per[u].shifts += 1;
    if ((l.late_mins || 0) > 0) { per[u].late += 1; lateShifts++; }
    totalMins += l.duration_mins || 0;
    shifts += 1;
  }

  const { data: sales } = await supabase.from("daily_sales")
    .select("amount").eq("branch_id", branchId).gte("sale_date", from).lte("sale_date", to);
  let monthSales = 0;
  for (const s of sales || []) monthSales += Number(s.amount) || 0;

  const { data: purch, error: purchErr } = await supabase.from("inventory_purchases")
    .select("cost").eq("branch_id", branchId).gte("purchase_date", from).lte("purchase_date", to);
  let foodSpend = 0;
  if (!purchErr) for (const p of purch || []) foodSpend += Number(p.cost) || 0;

  let laborCost = 0, overtimeHrs = 0;
  const rows = Object.keys(per).map((uid) => {
    const s = info[uid] || {};
    const hrs = Math.round((per[uid].mins / 60) * 10) / 10;
    const wage = s.hourly_wage || 0;
    laborCost += hrs * wage;
    const contract = s.contract_hours || 0;
    const ot = contract > 0 ? Math.max(0, Math.round((hrs - contract) * 10) / 10) : 0;
    overtimeHrs += ot;
    return {
      name: s.full_name || "—", team: s.team || "—",
      hours: hrs, shifts: per[uid].shifts, late: per[uid].late,
      overtime: ot, laborCost: Math.round(hrs * wage),
    };
  }).sort((a, b) => b.hours - a.hours);

  const totalHours = Math.round((totalMins / 60) * 10) / 10;
  const laborPct = monthSales > 0 ? Math.round((laborCost / monthSales) * 1000) / 10 : null;
  const foodPct = (!purchErr && monthSales > 0) ? Math.round((foodSpend / monthSales) * 1000) / 10 : null;
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
    hasSales: monthSales > 0, hasFood: !purchErr,
  };
}