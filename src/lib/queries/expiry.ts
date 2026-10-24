"use server";

import { validInventoryItem } from "@/lib/inventory/identity";
import { createClient } from "@/lib/supabase/server";
import { berlinToday, isCalendarDate } from "@/lib/time/berlinDate";
import { activeBranchFor } from "@/lib/activeBranch";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);

// products for the picker
export async function getBatchProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data, error } = await supabase
    .from("inventory_master").select("product, category, unit, is_active")
    .eq("branch_id", branchId).eq("is_active", true).order("product");
  if (error) return { ok: false, error: error.message, products: [] };
  return { ok: true, products: data || [] };
}

export async function addBatch(product: string, category: string, qty: number, unit: string, expiryDate: string, note: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId || !validInventoryItem({ product, category, unit })) return { ok: false, error: "Pick a product." };
  if (!Number.isFinite(qty) || !(qty > 0)) return { ok: false, error: "Enter a quantity." };
  if (!isCalendarDate(expiryDate)) return { ok: false, error: "Pick an expiry date." };
  const { error } = await supabase.from("stock_batches").insert({
    branch_id: branchId, product, category: category || null, qty, unit: unit || null,
    received_date: berlinToday(), expiry_date: expiryDate, note: note || null,
    status: "active", logged_by: user.id, logged_by_name: profile?.full_name || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// active batches, soonest expiry first (FIFO), with days-to-expiry + flag
export async function getBatches() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", batches: [] };
  const today = berlinToday();
  const { data, error } = await supabase
    .from("stock_batches").select("*")
    .eq("branch_id", branchId).eq("status", "active").order("expiry_date", { ascending: true });
  if (error) return { ok: false, error: error.message, batches: [] };
  const batches = (data || []).map((b: any) => {
    const d = daysBetween(today, b.expiry_date);
    const flag = d < 0 ? "expired" : d <= 3 ? "soon" : "ok";
    return { ...b, daysToExpiry: d, flag };
  });
  return { ok: true, batches };
}

export async function getExpirySummary() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const today = berlinToday();
  const { data, error } = await supabase
    .from("stock_batches").select("expiry_date")
    .eq("branch_id", branchId).eq("status", "active");
  if (error) return { ok: false, error: error.message, expired: 0, soon: 0, active: 0 };
  let expired = 0, soon = 0;
  for (const b of data || []) {
    const d = daysBetween(today, b.expiry_date);
    if (d < 0) expired++; else if (d <= 3) soon++;
  }
  return { ok: true, expired, soon, active: (data || []).length };
}

export async function markBatchUsed(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.from("stock_batches").update({ status: "used" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// discard a batch → mark discarded AND record it in the waste log (reason = expired)
export async function discardBatch(id: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.rpc("discard_batch_atomic", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
