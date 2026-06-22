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

// ── Record a delivery / stock-in (manager). Captures € paid. ──
export async function addDelivery(input: {
  product: string; category: string; qty: number; unit: string; cost: number;
  supplier?: string; note?: string; date?: string;
}) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!input.product) return { ok: false, error: "Product is required." };
  const { error } = await supabase.from("inventory_purchases").insert({
    branch_id: branchId,
    category: input.category || null,
    product: input.product,
    qty: input.qty || 0,
    unit: input.unit || null,
    cost: input.cost || 0,
    supplier: input.supplier || null,
    note: input.note || null,
    purchase_date: input.date || todayStr(),
    created_by: profile?.full_name || "manager",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Recent deliveries (history list) ──
export async function getDeliveries(days = 30) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", deliveries: [] };
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("inventory_purchases")
    .select("*")
    .eq("branch_id", branchId)
    .gte("purchase_date", sinceStr)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, deliveries: [] };
  return { ok: true, deliveries: data || [] };
}

// ── Inventory analytics: spend + derived usage over time, top items, stock value ──
//   Usage = opening count + purchases in interval − closing count (clamped ≥ 0),
//   valued in € at each product's weighted-average purchase price.
export async function getInventoryAnalytics(days = 30) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const since = new Date(); since.setDate(since.getDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);

  const { data: purchases } = await supabase
    .from("inventory_purchases")
    .select("product, category, qty, cost, purchase_date")
    .eq("branch_id", branchId).gte("purchase_date", sinceStr);
  const { data: counts } = await supabase
    .from("inventory_counts")
    .select("product, ist, count_date, created_at")
    .eq("branch_id", branchId).gte("count_date", sinceStr)
    .order("count_date", { ascending: true }).order("created_at", { ascending: true });

  const P = purchases || [];
  const C = counts || [];

  // spend + unit cost (weighted avg) + purchases per product/date
  const spendByDate: Record<string, number> = {};
  const spendByProduct: Record<string, number> = {};
  const qtyByProduct: Record<string, number> = {};
  const costByProduct: Record<string, number> = {};
  const purchByProdDate: Record<string, Record<string, number>> = {};
  let totalSpend = 0;
  for (const p of P) {
    const d = p.purchase_date, c = Number(p.cost) || 0, q = Number(p.qty) || 0;
    spendByDate[d] = (spendByDate[d] || 0) + c;
    spendByProduct[p.product] = (spendByProduct[p.product] || 0) + c;
    qtyByProduct[p.product] = (qtyByProduct[p.product] || 0) + q;
    costByProduct[p.product] = (costByProduct[p.product] || 0) + c;
    (purchByProdDate[p.product] ||= {})[d] = (purchByProdDate[p.product]?.[d] || 0) + q;
    totalSpend += c;
  }
  const unitCost: Record<string, number> = {};
  for (const prod of Object.keys(qtyByProduct)) {
    unitCost[prod] = qtyByProduct[prod] > 0 ? costByProduct[prod] / qtyByProduct[prod] : 0;
  }

  // latest count per product per date
  const countsByProduct: Record<string, { date: string; ist: number }[]> = {};
  const byProdDate: Record<string, Record<string, number>> = {};
  for (const c of C) {
    (byProdDate[c.product] ||= {})[c.count_date] = Number(c.ist) || 0; // asc → last wins (latest)
  }
  for (const prod of Object.keys(byProdDate)) {
    countsByProduct[prod] = Object.keys(byProdDate[prod]).sort()
      .map((d) => ({ date: d, ist: byProdDate[prod][d] }));
  }

  const usageByDate: Record<string, number> = {};
  const usageEurByDate: Record<string, number> = {};
  const usageQtyByProduct: Record<string, number> = {};
  const usageEurByProduct: Record<string, number> = {};
  const purchasedBetween = (prod: string, after: string, through: string) => {
    const m = purchByProdDate[prod] || {}; let s = 0;
    for (const d of Object.keys(m)) if (d > after && d <= through) s += m[d];
    return s;
  };
  for (const prod of Object.keys(countsByProduct)) {
    const series = countsByProduct[prod];
    for (let i = 0; i + 1 < series.length; i++) {
      const a = series[i], b = series[i + 1];
      let used = a.ist + purchasedBetween(prod, a.date, b.date) - b.ist;
      if (used < 0) used = 0;
      const uc = unitCost[prod] || 0;
      usageByDate[b.date] = (usageByDate[b.date] || 0) + used;
      usageEurByDate[b.date] = (usageEurByDate[b.date] || 0) + used * uc;
      usageQtyByProduct[prod] = (usageQtyByProduct[prod] || 0) + used;
      usageEurByProduct[prod] = (usageEurByProduct[prod] || 0) + used * uc;
    }
  }

  // current stock value = latest count × unit cost
  let stockValue = 0;
  for (const prod of Object.keys(countsByProduct)) {
    const s = countsByProduct[prod];
    if (s.length) stockValue += s[s.length - 1].ist * (unitCost[prod] || 0);
  }

  const dates = [...new Set([...Object.keys(spendByDate), ...Object.keys(usageEurByDate)])].sort();
  const trend = dates.map((d) => ({
    date: d.slice(5),
    spend: Math.round((spendByDate[d] || 0) * 100) / 100,
    usageEur: Math.round((usageEurByDate[d] || 0) * 100) / 100,
  }));
  const topSpend = Object.entries(spendByProduct)
    .map(([product, eur]) => ({ product, eur: Math.round(eur) }))
    .sort((a, b) => b.eur - a.eur).slice(0, 8);
  const topUsage = Object.entries(usageEurByProduct)
    .map(([product, eur]) => ({ product, eur: Math.round(eur), qty: Math.round((usageQtyByProduct[product] || 0) * 10) / 10 }))
    .sort((a, b) => b.eur - a.eur).slice(0, 8);
  const totalUsageEur = Object.values(usageEurByDate).reduce((s, v) => s + v, 0);

  return {
    ok: true, days,
    totalSpend: Math.round(totalSpend),
    totalUsageEur: Math.round(totalUsageEur),
    stockValue: Math.round(stockValue),
    trend, topSpend, topUsage,
    hasCounts: C.length > 0, hasPurchases: P.length > 0,
  };
}