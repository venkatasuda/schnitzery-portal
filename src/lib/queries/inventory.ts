"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";

// ============================================================
// INVENTORY
// inventory_master: id, branch_id, category, product, soll(target),
//   unit, is_active, created_at
// inventory_counts: id, branch_id, count_date, category, product,
//   ist(counted), soll, unit, counted_by, created_at
// (soll = target / should-have, ist = actual / counted)
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}
function todayStr() { return berlinToday(); }

// ── Get the product catalog (master list) for my branch ──
export async function getProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data, error } = await supabase
    .from("inventory_master")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("category").order("product");
  if (error) return { ok: false, error: error.message, products: [] };
  return { ok: true, products: data || [] };
}

// ── Add a product to the catalog (manager) ──
export async function addProduct(category: string, product: string, soll: number, unit: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!category || !product) return { ok: false, error: "Category and product are required." };
  const { error } = await supabase.from("inventory_master").insert({
    branch_id: branchId, category, product, soll: soll || 0, unit: unit || null, is_active: true,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Deactivate a product (soft delete) ──
export async function removeProduct(id: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("inventory_master").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Get the latest count for each product (for a given date, default today) ──
export async function getCounts(date?: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", counts: [] };
  const d = date || todayStr();
  const { data, error } = await supabase
    .from("inventory_counts")
    .select("*")
    .eq("branch_id", branchId)
    .eq("count_date", d)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, counts: [] };

  // keep only the latest count per product for that date
  const latest: Record<string, any> = {};
  for (const c of data || []) {
    if (!latest[c.product]) latest[c.product] = c;
  }
  return { ok: true, counts: Object.values(latest), date: d };
}

// ── Save a stock count for a product ──
export async function saveCount(product: string, category: string, ist: number, soll: number, unit: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("inventory_counts").insert({
    branch_id: branchId,
    count_date: todayStr(),
    category, product, ist: ist || 0, soll: soll || 0, unit: unit || null,
    counted_by: profile?.full_name || "manager",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Low-stock / order alert: products where today's count is below target ──
export async function getOrderAlert() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", lowStock: [] };

  const products = await getProducts();
  if (!products.ok) return { ok: false, error: products.error, lowStock: [] };

  const counts = await getCounts();
  const countMap: Record<string, any> = {};
  for (const c of (counts.counts || [])) countMap[c.product] = c;

  // a product is "low" if it has a count today and ist < soll
  const lowStock = [];
  for (const p of products.products) {
    const c = countMap[p.product];
    if (c && Number(c.ist) < Number(p.soll)) {
      lowStock.push({
        product: p.product, category: p.category, unit: p.unit,
        ist: Number(c.ist), soll: Number(p.soll), short: Number(p.soll) - Number(c.ist),
      });
    }
  }
  return { ok: true, lowStock };
}