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

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);

// products for the picker
export async function getBatchProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data } = await supabase
    .from("inventory_master").select("product, category, unit, is_active")
    .eq("branch_id", branchId).eq("is_active", true).order("product");
  return { ok: true, products: data || [] };
}

export async function addBatch(product: string, category: string, qty: number, unit: string, expiryDate: string, note: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!product) return { ok: false, error: "Pick a product." };
  if (!(qty > 0)) return { ok: false, error: "Enter a quantity." };
  if (!expiryDate) return { ok: false, error: "Pick an expiry date." };
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
  const { data } = await supabase
    .from("stock_batches").select("*")
    .eq("branch_id", branchId).eq("status", "active").order("expiry_date", { ascending: true });
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
  const { data } = await supabase
    .from("stock_batches").select("expiry_date")
    .eq("branch_id", branchId).eq("status", "active");
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
  const { data: b } = await supabase.from("stock_batches").select("*").eq("id", id).maybeSingle();
  if (!b) return { ok: false, error: "Batch not found." };

  const { error } = await supabase.from("stock_batches").update({ status: "discarded" }).eq("id", id);
  if (error) return { ok: false, error: error.message };

  // best-effort waste record (won't block the discard if the waste table is absent)
  await supabase.from("waste_log").insert({
    branch_id: branchId, product: b.product, category: b.category, qty: b.qty, unit: b.unit,
    reason: "expired", note: "Auto from expiry", logged_by: user.id,
    logged_by_name: profile?.full_name || null, work_date: berlinToday(),
  });

  return { ok: true };
}