"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

// unit price per product from recent purchases (for valuing waste), weighted average
async function unitPrices(supabase: any, branchId: string | null) {
  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const from = new Date(anchor - 90 * 86400000).toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("inventory_purchases").select("product, qty, cost")
    .eq("branch_id", branchId).gte("purchase_date", from);
  const qty: Record<string, number> = {};
  const cost: Record<string, number> = {};
  if (!error) for (const p of data || []) {
    qty[p.product] = (qty[p.product] || 0) + (Number(p.qty) || 0);
    cost[p.product] = (cost[p.product] || 0) + (Number(p.cost) || 0);
  }
  const price: Record<string, number> = {};
  for (const prod of Object.keys(qty)) if (qty[prod] > 0) price[prod] = cost[prod] / qty[prod];
  return price;
}

// products for the picker (active catalog) — open to any branch member
export async function getWasteProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data } = await supabase
    .from("inventory_master").select("product, category, unit, is_active")
    .eq("branch_id", branchId).eq("is_active", true).order("product");
  return { ok: true, products: data || [] };
}

export async function logWaste(product: string, category: string, qty: number, unit: string, reason: string, note: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!product) return { ok: false, error: "Pick a product." };
  if (!(qty > 0)) return { ok: false, error: "Enter a quantity." };
  const { error } = await supabase.from("waste_log").insert({
    branch_id: branchId, product, category: category || null, qty, unit: unit || null,
    reason: reason || "other", note: note || null,
    logged_by: user.id, logged_by_name: profile?.full_name || null, work_date: berlinToday(),
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function deleteWaste(id: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  // logger can delete own; managers can delete any in their branch (RLS allows own; managers use service path not needed here)
  const { error } = await supabase.from("waste_log").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getWasteLog(days = 14) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", entries: [] };
  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const from = new Date(anchor - days * 86400000).toISOString().slice(0, 10);
  const [{ data }, price] = await Promise.all([
    supabase.from("waste_log").select("*").eq("branch_id", branchId).gte("work_date", from).order("created_at", { ascending: false }).limit(200),
    unitPrices(supabase, branchId),
  ]);
  const entries = (data || []).map((e: any) => ({
    ...e, value: price[e.product] != null ? Math.round(price[e.product] * Number(e.qty) * 100) / 100 : null,
  }));
  return { ok: true, entries };
}

// ── TRENDS: weekly waste value over the last N weeks, plus waste as % of sales.
// Read-only. Complements getWasteSummary (which is a single-window snapshot) by
// showing whether waste is rising or falling, and how big it is relative to
// takings. Managers only — this is a cost-analysis view.
export async function getWasteTrends(weeks = 6) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  // Anchor to the Monday of the current Berlin week, then walk back.
  const today = new Date(berlinToday() + "T12:00:00Z");
  const dow = (today.getUTCDay() + 6) % 7; // 0 = Monday
  const thisMonday = new Date(today.getTime() - dow * 86400000);
  const firstMonday = new Date(thisMonday.getTime() - (weeks - 1) * 7 * 86400000);
  const fromStr = firstMonday.toISOString().slice(0, 10);
  const iso = (d: Date) => d.toISOString().slice(0, 10);

  const [{ data: waste }, { data: sales }, price] = await Promise.all([
    supabase.from("waste_log").select("product, qty, work_date").eq("branch_id", branchId).gte("work_date", fromStr),
    supabase.from("daily_sales").select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", fromStr),
    unitPrices(supabase, branchId),
  ]);

  // Bucket index by which week a date falls in.
  const weekIndex = (dateStr: string) => {
    const t = new Date(dateStr + "T12:00:00Z").getTime();
    return Math.floor((t - firstMonday.getTime()) / (7 * 86400000));
  };

  const buckets = Array.from({ length: weeks }, (_, i) => ({
    weekStart: iso(new Date(firstMonday.getTime() + i * 7 * 86400000)),
    wasteValue: 0, sales: 0, pct: null as number | null,
  }));

  for (const w of waste || []) {
    const i = weekIndex(w.work_date);
    if (i >= 0 && i < weeks) buckets[i].wasteValue += (price[w.product] || 0) * Number(w.qty || 0);
  }
  for (const s of sales || []) {
    const i = weekIndex(s.sale_date);
    if (i >= 0 && i < weeks) buckets[i].sales += Number(s.amount) || 0;
  }
  for (const b of buckets) {
    b.wasteValue = Math.round(b.wasteValue * 100) / 100;
    b.sales = Math.round(b.sales);
    b.pct = b.sales > 0 ? Math.round((b.wasteValue / b.sales) * 1000) / 10 : null;
  }

  const totalWaste = Math.round(buckets.reduce((s, b) => s + b.wasteValue, 0) * 100) / 100;
  const totalSales = buckets.reduce((s, b) => s + b.sales, 0);
  const overallPct = totalSales > 0 ? Math.round((totalWaste / totalSales) * 1000) / 10 : null;

  return { ok: true, weeks: buckets, totalWaste, overallPct, hasPrices: Object.keys(price).length > 0 };
}

export async function getWasteSummary(days = 7) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const from = new Date(anchor - days * 86400000).toISOString().slice(0, 10);
  const [{ data }, price] = await Promise.all([
    supabase.from("waste_log").select("product, qty, reason").eq("branch_id", branchId).gte("work_date", from),
    unitPrices(supabase, branchId),
  ]);
  const rows = data || [];
  let totalValue = 0;
  const byReason: Record<string, { value: number; count: number }> = {};
  const byProduct: Record<string, number> = {};
  for (const r of rows) {
    const v = price[r.product] != null ? price[r.product] * Number(r.qty) : 0;
    totalValue += v;
    byReason[r.reason] = byReason[r.reason] || { value: 0, count: 0 };
    byReason[r.reason].value += v; byReason[r.reason].count += 1;
    byProduct[r.product] = (byProduct[r.product] || 0) + v;
  }
  const reasons = Object.keys(byReason).map((k) => ({ reason: k, value: Math.round(byReason[k].value * 100) / 100, count: byReason[k].count })).sort((a, b) => b.value - a.value);
  const top = Object.keys(byProduct).map((p) => ({ product: p, value: Math.round(byProduct[p] * 100) / 100 })).sort((a, b) => b.value - a.value).slice(0, 5);
  return { ok: true, totalValue: Math.round(totalValue * 100) / 100, count: rows.length, reasons, top, days, hasPrices: Object.keys(price).length > 0 };
}