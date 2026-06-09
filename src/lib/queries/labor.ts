"use server";

import { createClient } from "@/lib/supabase/server";

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
  return ["manager", "franchise_owner", "brand_owner"].includes(r || "");
}

export async function getLaborSummary() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);

  // wages
  const { data: staff } = await supabase.from("users").select("id, hourly_wage").eq("branch_id", branchId);
  const wageOf: Record<string, number> = {};
  let withWage = 0;
  for (const s of staff || []) { wageOf[s.id] = s.hourly_wage || 0; if (s.hourly_wage) withWage++; }

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
  return {
    ok: true,
    laborCost: Math.round(laborCost),
    monthSales: Math.round(monthSales),
    laborPct,
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
    .from("users").select("id, full_name, team, hourly_wage").eq("branch_id", branchId).order("full_name");
  if (error) return { ok: false, error: error.message, staff: [] };
  return { ok: true, staff: data || [] };
}

export async function setStaffWage(userId: string, wage: number) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "Not in your branch." };
  const { error } = await supabase.from("users").update({ hourly_wage: wage }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}