"use server";
import { readAll } from "@/lib/supabase/readAll";


import { createClient } from "@/lib/supabase/server";
import { berlinToday, berlinMonth, isCalendarDate } from "@/lib/time/berlinDate";
import { sendPushToUser } from "@/lib/push/delivery";
import { inventoryKey, validInventoryItem } from "@/lib/inventory/identity";
import { countDepletion } from "@/lib/inventory/reconciliation";
import { valueStock, valueUsage } from "@/lib/inventory/valuation";
import { figure, missingSalesDays, pctOf, spendFigure } from "@/lib/analytics/coverage";
import { getReconciliation } from "@/lib/queries/reconciliation";

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

// Status timestamps cannot reconstruct when each transfer leg moved stock.
// Withhold affected estimates until movement timing can be reconciled.
async function movedStock(db: Awaited<ReturnType<typeof createClient>>, branchId: string | null, from: string) {
  return readAll(db.from("stock_transfers").select("product,category,unit")
    .or(`from_branch_id.eq.${branchId},to_branch_id.eq.${branchId}`)
    .in("status", ["sent", "received"]).gte("updated_at", from).order("id"));
}

// ── Get the product catalog (master list) for my branch ──
export async function getProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data, error } = await readAll(supabase
    .from("inventory_master")
    .select("*")
    .eq("branch_id", branchId)
    .eq("is_active", true)
    .order("category").order("product").order("id"));
  if (error) return { ok: false, error: error.message, products: [] };
  return { ok: true, products: data || [] };
}

// ── Add a product to the catalog (manager) ──
export async function addProduct(category: string, product: string, soll: number, unit: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!category || !validInventoryItem({ category, product, unit })) return { ok: false, error: "Category and product are required." };
  if (!branchId || !Number.isFinite(soll) || soll < 0) return { ok: false, error: "Enter a valid target." };
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
  if (!isCalendarDate(d)) return { ok: false, error: "Invalid count date.", counts: [] };
  const { data, error } = await readAll(supabase
    .from("inventory_counts")
    .select("*")
    .eq("branch_id", branchId)
    .eq("count_date", d)
    .order("created_at", { ascending: false }).order("id", { ascending: false }).order("id"));
  if (error) return { ok: false, error: error.message, counts: [] };

  // keep only the latest count per product for that date
  const latest: Record<string, any> = {};
  for (const c of data || []) {
    if (!latest[inventoryKey(c)]) latest[inventoryKey(c)] = c;
  }
  return { ok: true, counts: Object.values(latest), date: d };
}

// ── Save a stock count for a product ──
export async function saveCount(product: string, category: string, ist: number, soll: number, unit: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!branchId || !category || !validInventoryItem({ product, category, unit }) || ![ist, soll].every(n => Number.isFinite(n) && n >= 0)) return { ok: false, error: "Enter valid stock quantities." };
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
  if (!counts.ok) return { ok: false, error: counts.error, lowStock: [] };
  const countMap: Record<string, any> = {};
  for (const c of (counts.counts || [])) countMap[inventoryKey(c)] = c;

  // a product is "low" if it has a count today and ist < soll
  const lowStock = [];
  for (const p of products.products) {
    const c = countMap[inventoryKey(p)];
    if (c && Number(c.ist) < Number(p.soll)) {
      lowStock.push({
        product: p.product, category: p.category, unit: p.unit,
        ist: Number(c.ist), soll: Number(p.soll), short: Number(p.soll) - Number(c.ist),
      });
    }
  }
  return { ok: true, lowStock };
}

// ── CUSTOM ALERT LEVEL: set the per-item reorder point (manager) ─────────────
// `soll` on inventory_master is the level below which the item counts as "low".
// It is per-product and manager-editable, so each item gets its own threshold —
// a lot of one thing, a little of another. Editing it here is the "customise".
export async function setAlertLevel(id: string, level: number) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!Number.isFinite(level) || !(level >= 0)) return { ok: false, error: "Enter a valid level." };
  const { error } = await supabase
    .from("inventory_master").update({ soll: level })
    .eq("id", id).eq("branch_id", branchId); // scope to own branch
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STOCK ALERTS view: every product with its current level vs alert level ───
export async function getStockAlerts() {
  const { user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", items: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", items: [] };

  const [products, counts] = await Promise.all([getProducts(), getCounts()]);
  if (!products.ok) return { ok: false, error: products.error, items: [] };
  if (!counts.ok) return { ok: false, error: counts.error, items: [] };
  const countMap: Record<string, any> = {};
  for (const c of (counts.counts || [])) countMap[inventoryKey(c)] = c;

  const items = products.products.map((p: any) => {
    const c = countMap[inventoryKey(p)];
    const ist = c ? Number(c.ist) : null;
    const level = Number(p.soll) || 0;
    return {
      id: p.id, product: p.product, category: p.category, unit: p.unit,
      level, ist, counted: ist != null,
      low: ist != null && ist < level,
    };
  });
  // Low ones first, then the rest by category/name.
  items.sort((a, b) => (b.low ? 1 : 0) - (a.low ? 1 : 0) || a.category.localeCompare(b.category) || a.product.localeCompare(b.product));
  const lowCount = items.filter((i) => i.low).length;
  return { ok: true, items, lowCount };
}

// ── Push the current low-stock list to the requesting manager's device ───────
// On-demand (tap "Alert me"): finds items below their alert level and sends one
// summary notification. Best-effort — silently does nothing if push isn't set up.
export async function notifyLowStock() {
  const { user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const alert = await getOrderAlert();
  if (!alert.ok) return { ok: false, error: alert.error };
  const low = alert.ok ? alert.lowStock : [];
  if (low.length === 0) return { ok: true, count: 0 };

  const names = low.slice(0, 5).map((l: any) => l.product).join(", ");
  const body = low.length <= 5 ? `Low: ${names}` : `Low: ${names} +${low.length - 5} more`;
  try { await sendPushToUser(user.id, { title: `${low.length} item(s) low on stock`, body, url: "/stock-alerts" }); } catch { /* best effort */ }
  return { ok: true, count: low.length };
}

// ── Record a delivery / stock-in (manager). Captures € paid. ──
export async function addDelivery(input: {
  product: string; category: string; qty: number; unit: string; cost: number;
  supplier?: string; note?: string; date?: string;
}) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!input || !validInventoryItem(input)) return { ok: false, error: "Product is required." };
  if (input.date !== undefined && (!isCalendarDate(input.date) || input.date > berlinToday())) return { ok: false, error: "Invalid delivery date." };
  if (!branchId || !Number.isFinite(input.qty) || input.qty <= 0 || !Number.isFinite(input.cost) || input.cost < 0) return { ok: false, error: "Enter a positive quantity and a valid cost." };
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
  const since = new Date(berlinToday() + "T12:00:00Z"); since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const { data, error } = await readAll(supabase
    .from("inventory_purchases")
    .select("*")
    .eq("branch_id", branchId)
    .gte("purchase_date", sinceStr)
    .order("purchase_date", { ascending: false })
    .order("created_at", { ascending: false }).order("id"));
  if (error) return { ok: false, error: error.message, deliveries: [] };
  return { ok: true, deliveries: data || [] };
}

// ── Inventory analytics: spend + derived usage over time, top items, stock value ──
// Depletion = opening count + purchases − closing count, including waste/errors.
// Unreconciled intervals and missing price coverage withhold derived estimates.
export async function getInventoryAnalytics(days = 30) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const today = berlinToday();
  const since = new Date(today + "T12:00:00Z"); since.setUTCDate(since.getUTCDate() - days);
  const sinceStr = since.toISOString().slice(0, 10);
  const prevSince = new Date(today + "T12:00:00Z"); prevSince.setUTCDate(prevSince.getUTCDate() - days * 2);
  const prevSinceStr = prevSince.toISOString().slice(0, 10);

  // Release D (docs/ANALYTICS-RELIABILITY.md): usage comes from Release C reconciliation
  // intervals, valued at the latest delivery price on or before each count; missing
  // data is reported, never counted as zero.
  // ponytail: full purchase history for latest prices; bounded by readAll's 100k rows.
  const [purchRes, histRes, countsRes, salesRes, workRes, prevRes, rec, catalogRes] = await Promise.all([
    readAll(supabase.from("inventory_purchases").select("product, category, qty, cost, purchase_date, unit")
      .eq("branch_id", branchId).gte("purchase_date", sinceStr).lte("purchase_date", today).order("id")),
    readAll(supabase.from("inventory_purchases").select("product, category, qty, cost, purchase_date, unit")
      .eq("branch_id", branchId).lte("purchase_date", today).order("id")),
    // All count history: stock value needs the latest count per product, not only this window.
    readAll(supabase.from("inventory_counts").select("product, ist, count_date, created_at, category, unit")
      .eq("branch_id", branchId).lte("count_date", today)
      .order("count_date").order("created_at").order("id")),
    readAll(supabase.from("daily_sales").select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", sinceStr).lte("sale_date", today).order("id")),
    readAll(supabase.from("attendance_logs").select("work_date, duration_mins").eq("branch_id", branchId).eq("status", "complete")
      .gte("work_date", sinceStr).lte("work_date", today).order("id")),
    readAll(supabase.from("inventory_purchases").select("cost").eq("branch_id", branchId).gte("purchase_date", prevSinceStr).lt("purchase_date", sinceStr).order("id")),
    getReconciliation(Math.min(180, Math.max(7, days))),
    readAll(supabase.from("inventory_master").select("product, category, unit").eq("branch_id", branchId).eq("is_active", true).order("id")),
  ]);
  const failed = purchRes.error || histRes.error || countsRes.error || salesRes.error || workRes.error || prevRes.error || catalogRes.error;
  if (failed) return { ok: false, error: failed.message };
  if (!rec.ok && !/Manager/.test(rec.error)) return { ok: false, error: rec.error };
  const P = purchRes.data || [], S = salesRes.data || [];
  const allCounts = countsRes.data || [], C = allCounts.filter(c => c.count_date >= sinceStr);
  // Every stock identity the branch carries must be covered (review findings 1–2).
  const required = [...(catalogRes.data || []), ...C];

  // Spend: deliveries without a usable cost are missing, not €0.
  const spend = spendFigure(P);
  const prevSpend = spendFigure(prevRes.data || []);
  const spendByDate: Record<string, number> = {}, spendByProduct: Record<string, number> = {}, spendByCategory: Record<string, number> = {};
  for (const p of P) {
    const c = Number(p.cost); if (p.cost == null || !Number.isFinite(c) || c < 0) continue;
    spendByDate[p.purchase_date] = (spendByDate[p.purchase_date] || 0) + c;
    spendByProduct[inventoryKey(p)] = (spendByProduct[inventoryKey(p)] || 0) + c;
    spendByCategory[p.category || "—"] = (spendByCategory[p.category || "—"] || 0) + c;
  }

  // Sales: an open day (anyone worked) without a sales entry is missing.
  const worked = (workRes.data || []).filter(w => Number(w.duration_mins) > 0).map(w => ({ branch_id: "b", work_date: w.work_date }));
  const salesIn = (after: string, through: string) => {
    const rows = S.filter(s => s.sale_date > after && s.sale_date <= through);
    return figure(rows.reduce((n, s) => n + (Number(s.amount) || 0), 0), {
      salesDays: missingSalesDays(worked.filter(w => w.work_date > after && w.work_date <= through), rows.map(s => ({ branch_id: "b", sale_date: s.sale_date })), today),
    });
  };
  const dayBefore = new Date(Date.parse(sinceStr + "T12:00:00Z") - 86400000).toISOString().slice(0, 10);
  const sales = salesIn(dayBefore, today); // whole window, sinceStr inclusive

  // Usage (cost of goods used) from reconciliation; null when nothing could be valued.
  const valued = rec.ok ? valueUsage(rec.rows, histRes.data || [], required) : null;
  const usage = valued && valued.products.length > 0 ? valued.usage : null;
  const cogsPct = usage && valued?.span ? pctOf(usage, salesIn(valued.span.from, valued.span.to)) : null;

  // Stock value: latest count per product × latest price.
  const latest: Record<string, { product: string; category: string; unit: string; ist: number }> = {};
  for (const c of allCounts) latest[inventoryKey(c)] = { product: c.product, category: c.category, unit: c.unit, ist: c.ist == null ? NaN : Number(c.ist) };
  const stock = valueStock(Object.values(latest), histRes.data || [], today, required);
  const stockKnown = stock.priced > 0 || (stock.complete && Object.keys(latest).length > 0);

  const byCategory = Object.entries(spendByCategory).map(([category, eur]) => ({ category, eur: Math.round(eur) })).sort((a, b) => b.eur - a.eur);
  const dates = [...new Set([...Object.keys(spendByDate), ...Object.keys(valued?.byDate || {})])].sort();
  return {
    ok: true, days,
    totalSpend: Math.round(spend.value), spendComplete: spend.complete, missingCosts: spend.missing.costs || 0,
    totalUsageEur: usage ? Math.round(usage.value) : null, usageComplete: !!usage?.complete, usageMissing: usage?.missing || {},
    stockValue: stockKnown ? Math.round(stock.value) : null, stockComplete: stock.complete,
    needsReview: !usage?.complete,
    totalSales: Math.round(sales.value), missingSalesDays: sales.missing.salesDays || 0,
    foodCostPct: pctOf(spend, sales), // purchases ÷ sales — labelled "Purchase spend / sales"
    cogsPct,                          // cost of goods used ÷ sales over the commonly counted span
    prevSpend: Math.round(prevSpend.value),
    spendPctChange: spend.complete && prevSpend.complete && prevSpend.value > 0 ? Math.round(((spend.value - prevSpend.value) / prevSpend.value) * 100) : null,
    byCategory, topCategory: byCategory[0] || null,
    trend: dates.map(d => ({ date: d.slice(5), spend: Math.round((spendByDate[d] || 0) * 100) / 100, usageEur: usage ? Math.round((valued!.byDate[d] || 0) * 100) / 100 : null })),
    topSpend: Object.entries(spendByProduct).map(([k, eur]) => ({ product: JSON.parse(k)[1], category: JSON.parse(k)[0], eur: Math.round(eur) })).sort((a, b) => b.eur - a.eur).slice(0, 8),
    topUsage: (valued?.products || []).slice(0, 8).map(p => ({ product: p.product, category: p.category, eur: Math.round(p.eur), qty: Math.round(p.qty * 10) / 10 })),
    hasCounts: C.length > 0, hasPurchases: P.length > 0,
  };
}

// ── Month-over-month trend: spend + food cost % for the last N months ──
export async function getInventoryTrend(months = 6) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", trend: [] };
  const now = new Date(berlinMonth() + "-01T12:00:00Z");
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (months - 1), 1, 12));
  const startStr = start.toISOString().slice(0, 10);

  const [purchRes, salesRes] = await Promise.all([
    readAll(supabase.from("inventory_purchases").select("cost, purchase_date").eq("branch_id", branchId).gte("purchase_date", startStr).lte("purchase_date", berlinToday()).order("id")),
    readAll(supabase.from("daily_sales").select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", startStr).lte("sale_date", berlinToday()).order("id")),
  ]);

  if (purchRes.error || salesRes.error) return { ok: false, error: purchRes.error?.message || salesRes.error?.message, trend: [] };
  const spend: Record<string, number> = {};
  const sale: Record<string, number> = {};
  if (!purchRes.error) for (const p of purchRes.data || []) { const ym = (p.purchase_date || "").slice(0, 7); spend[ym] = (spend[ym] || 0) + (Number(p.cost) || 0); }
  for (const s of salesRes.data || []) { const ym = (s.sale_date || "").slice(0, 7); sale[ym] = (sale[ym] || 0) + (Number(s.amount) || 0); }

  const ABBR = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const trend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1, 12));
    const ym = d.toISOString().slice(0, 7);
    const sp = Math.round(spend[ym] || 0);
    const sl = sale[ym] || 0;
    trend.push({ month: ABBR[d.getUTCMonth()], ym, spend: sp, foodCostPct: sl > 0 ? Math.round((sp / sl) * 1000) / 10 : null });
  }
  return { ok: true, trend };
}

// ── Usage variance / waste signal ──
// Compares derived usage € per product in the current window vs the previous one,
// normalised by sales (usage € per €100 of sales) so a busy period doesn't read as
// waste. A sustained jump flags possible over-portioning, spoilage or shrinkage.
// This is a SIGNAL, not proof — it points to products worth investigating.
export async function getInventoryVariance(days = 30) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", items: [] };

  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const dayMs = 86400000;
  const at = (off: number) => new Date(anchor - off * dayMs).toISOString().slice(0, 10);
  const curStart = at(days);
  const prevStart = at(2 * days);
  const fetchFrom = at(3 * days); // lead-in so the first count pair in each window is complete

  const [countsRes, purchRes, salesRes, transferRes] = await Promise.all([
    readAll(supabase.from("inventory_counts").select("product, count_date, ist, category, unit").eq("branch_id", branchId).gte("count_date", fetchFrom).lte("count_date", berlinToday()).order("count_date").order("created_at").order("id").order("id")),
    readAll(supabase.from("inventory_purchases").select("product, purchase_date, qty, cost, category, unit").eq("branch_id", branchId).gte("purchase_date", fetchFrom).lte("purchase_date", berlinToday()).order("id")),
    readAll(supabase.from("daily_sales").select("amount, sale_date").eq("branch_id", branchId).gte("sale_date", prevStart).lte("sale_date", berlinToday()).order("id")),
    movedStock(supabase, branchId, fetchFrom),
  ]);
  if (purchRes.error || countsRes.error || salesRes.error || transferRes.error) return { ok: false, error: purchRes.error?.message || countsRes.error?.message || salesRes.error?.message || transferRes.error?.message, items: [], hasData: false };
  let needsReview = (transferRes.data || []).length > 0;

  const C = countsRes.data || [];
  const P = purchRes.data || [];
  if (P.some(p => p.qty == null || !Number.isFinite(Number(p.qty)) || Number(p.qty) <= 0 || p.cost == null || !Number.isFinite(Number(p.cost)) || Number(p.cost) < 0)) needsReview = true;

  const qtyByProduct: Record<string, number> = {};
  const costByProduct: Record<string, number> = {};
  const purchByProdDate: Record<string, Record<string, number>> = {};
  for (const p of P) {
    const q = Number(p.qty) || 0, c = Number(p.cost) || 0;
    qtyByProduct[inventoryKey(p)] = (qtyByProduct[inventoryKey(p)] || 0) + q;
    costByProduct[inventoryKey(p)] = (costByProduct[inventoryKey(p)] || 0) + c;
    (purchByProdDate[inventoryKey(p)] ||= {})[p.purchase_date] = (purchByProdDate[inventoryKey(p)]?.[p.purchase_date] || 0) + q;
  }
  const unitCost: Record<string, number> = {};
  for (const prod of Object.keys(qtyByProduct)) unitCost[prod] = qtyByProduct[prod] > 0 ? costByProduct[prod] / qtyByProduct[prod] : 0;

  const byProdDate: Record<string, Record<string, number>> = {};
  for (const c of C) (byProdDate[inventoryKey(c)] ||= {})[c.count_date] = c.ist == null ? NaN : Number(c.ist);
  const series: Record<string, { date: string; ist: number }[]> = {};
  for (const prod of Object.keys(byProdDate)) series[prod] = Object.keys(byProdDate[prod]).sort().map((d) => ({ date: d, ist: byProdDate[prod][d] }));

  const purchasedBetween = (prod: string, after: string, through: string) => {
    const m = purchByProdDate[prod] || {}; let s = 0;
    for (const d of Object.keys(m)) if (d > after && d <= through) s += m[d];
    return s;
  };

  const cur: Record<string, number> = {};
  const prev: Record<string, number> = {};
  for (const prod of Object.keys(series)) {
    const s = series[prod];
    const uc = unitCost[prod];
    for (let i = 0; i + 1 < s.length; i++) {
      const a = s[i], b = s[i + 1];
      const used = countDepletion(a.ist, purchasedBetween(prod, a.date, b.date), b.ist);
      if (used === null || !Number.isFinite(uc) || uc < 0) { needsReview = true; continue; }
      const eur = used * uc;
      if (b.date > curStart) cur[prod] = (cur[prod] || 0) + eur;
      else if (b.date > prevStart) prev[prod] = (prev[prod] || 0) + eur;
    }
  }

  let curSales = 0, prevSales = 0;
  for (const sl of salesRes.data || []) {
    const amt = Number(sl.amount) || 0;
    if (sl.sale_date > curStart) curSales += amt;
    else if (sl.sale_date > prevStart) prevSales += amt;
  }
  const normalised = curSales > 0 && prevSales > 0;

  const items = Object.keys({ ...cur, ...prev }).map((prod) => {
    const c = Math.round(cur[prod] || 0);
    const p = Math.round(prev[prod] || 0);
    const cr = normalised ? (cur[prod] || 0) / curSales * 100 : (cur[prod] || 0);
    const pr = normalised ? (prev[prod] || 0) / prevSales * 100 : (prev[prod] || 0);
    const changePct = pr > 0 ? Math.round(((cr - pr) / pr) * 100) : null;
    let flag: "up" | "down" | "new" | "ok" = "ok";
    if (changePct === null) flag = c > 0 ? "new" : "ok";
    else if (changePct >= 25 && c >= 20) flag = "up";
    else if (changePct <= -25) flag = "down";
    return { product: JSON.parse(prod)[1], curEur: c, prevEur: p, changePct, flag };
  })
    .filter((x) => x.curEur > 0 || x.prevEur > 0)
    .sort((a, b) => (b.changePct ?? -999) - (a.changePct ?? -999));

  return { ok: true, items: needsReview ? [] : items, normalised, hasData: !needsReview && items.length > 0, needsReview, days };
}


// ── Depletion forecast: runway (days of stock left) + suggested order per product ──
// Usage rate is derived (opening count + purchases − closing count) over a window,
// divided by the window length. Days left = current stock ÷ daily usage.
// Suggested order covers `coverDays` of usage above what's on hand (falls back to
// reaching the target/par when there's no recent usage to learn from).
export async function getDepletionForecast(windowDays = 30, coverDays = 7) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", items: [], hasData: false };

  if (!Number.isInteger(windowDays) || windowDays < 1 || windowDays > 365 || !Number.isInteger(coverDays) || coverDays < 1 || coverDays > 90) return { ok: false, error: "Invalid forecast period.", items: [], hasData: false };
  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const dayMs = 86400000;
  const at = (off: number) => new Date(anchor - off * dayMs).toISOString().slice(0, 10);
  const from = at(windowDays);
  const fetchFrom = at(windowDays * 2); // lead-in so the first pair in the window is complete

  const [countsRes, purchRes, prodRes, transferRes] = await Promise.all([
    readAll(supabase.from("inventory_counts").select("product, category, count_date, ist, soll, unit")
      .eq("branch_id", branchId).gte("count_date", fetchFrom).lte("count_date", berlinToday()).order("count_date").order("created_at").order("id").order("id")),
    readAll(supabase.from("inventory_purchases").select("product, purchase_date, qty, category, unit")
      .eq("branch_id", branchId).gte("purchase_date", fetchFrom).lte("purchase_date", berlinToday()).order("id")),
    readAll(supabase.from("inventory_master").select("product, category, soll, unit, is_active")
      .eq("branch_id", branchId).eq("is_active", true).order("id")),
    movedStock(supabase, branchId, fetchFrom),
  ]);

  if (countsRes.error || purchRes.error || prodRes.error || transferRes.error) return { ok: false, error: countsRes.error?.message || purchRes.error?.message || prodRes.error?.message || transferRes.error?.message, items: [], hasData: false };
  const transferred = new Set((transferRes.data || []).map(inventoryKey));
  for (const p of purchRes.data || []) if (p.qty == null || !Number.isFinite(Number(p.qty)) || Number(p.qty) <= 0) transferred.add(inventoryKey(p));
  const C = countsRes.data || [];
  const purchByProdDate: Record<string, Record<string, number>> = {};
  if (!purchRes.error) for (const p of purchRes.data || []) {
    (purchByProdDate[inventoryKey(p)] ||= {})[p.purchase_date] = (purchByProdDate[inventoryKey(p)]?.[p.purchase_date] || 0) + (Number(p.qty) || 0);
  }

  const byProdDate: Record<string, Record<string, number>> = {};
  const meta: Record<string, any> = {};
  for (const c of C) {
    (byProdDate[inventoryKey(c)] ||= {})[c.count_date] = c.ist == null ? NaN : Number(c.ist);
    meta[inventoryKey(c)] = { category: c.category, soll: Number(c.soll) || 0, unit: c.unit };
  }
  for (const m of prodRes.data || []) {
    meta[inventoryKey(m)] = { category: m.category, soll: Number(m.soll) || 0, unit: m.unit };
  }

  const purchasedBetween = (prod: string, after: string, through: string) => {
    const mm = purchByProdDate[prod] || {}; let s = 0;
    for (const d of Object.keys(mm)) if (d > after && d <= through) s += mm[d];
    return s;
  };

  const activeKeys = new Set((prodRes.data || []).map(inventoryKey));
  const items: any[] = [];
  for (const prod of Object.keys(byProdDate).filter(key => activeKeys.has(key))) {
    const series = Object.keys(byProdDate[prod]).sort().map((d) => ({ date: d, ist: byProdDate[prod][d] }));
    if (series.length === 0) continue;
    const current = series[series.length - 1].ist;

    let usage = 0, observedDays = 0;
    let needsReview = transferred.has(prod) || !Number.isFinite(current) || current < 0;
    for (let i = 0; i + 1 < series.length; i++) {
      const a = series[i], b = series[i + 1];
      if (a.date < from || b.date > berlinToday()) continue; // pair closes outside the window
      const used = countDepletion(a.ist, purchasedBetween(prod, a.date, b.date), b.ist);
      if (used === null) { needsReview = true; continue; }
      usage += used;
      observedDays += (Date.parse(b.date) - Date.parse(a.date)) / dayMs;
    }
    const usageRate = observedDays > 0 ? usage / observedDays : 0; // per day
    const soll = meta[prod]?.soll || 0;
    const countDate = series[series.length - 1].date;
    const stale = (anchor - Date.parse(countDate + "T12:00:00Z")) / dayMs > 1;
    const daysLeft = !needsReview && !stale && usageRate > 0 ? Math.round((current / usageRate) * 10) / 10 : null;
    const suggested = needsReview || stale ? 0 : usageRate > 0
      ? Math.max(0, Math.ceil(usageRate * coverDays - current))
      : Math.max(0, Math.round((soll - current) * 10) / 10);

    items.push({
      product: JSON.parse(prod)[1], category: meta[prod]?.category || "", unit: meta[prod]?.unit || "",
      countDate, stale, observedDays, needsReview,
      current: Number.isFinite(current) ? Math.round(current * 10) / 10 : null, soll,
      usageRate: needsReview ? null : Math.round(usageRate * 100) / 100, daysLeft, suggested,
    });
  }
  items.sort((a, b) => (a.daysLeft ?? 1e9) - (b.daysLeft ?? 1e9));
  return { ok: true, items, coverDays, hasData: C.length > 0 };
}


// ── Purchase-order draft: forecast suggestions enriched with last price + supplier ──
// Takes the depletion forecast's suggested quantities and, for each product, pulls
// the most recent delivery to estimate a unit price and the usual supplier, then
// groups everything by supplier so you can send one order per supplier.
export async function getPurchaseOrderDraft(coverDays = 7) {
  const fc = await getDepletionForecast(30, coverDays);
  if (!fc.ok) return { ok: false, error: (fc as any).error || "No forecast.", groups: [], total: 0, hasPrices: false };
  const suggested = fc.items.filter((x: any) => x.suggested > 0);

  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", groups: [], total: 0, hasPrices: false };

  const { data: purch, error: priceError } = await readAll(supabase
    .from("inventory_purchases").select("product, qty, cost, supplier, purchase_date, category, unit")
    .eq("branch_id", branchId).order("purchase_date", { ascending: false }).order("created_at", { ascending: false }).order("id", { ascending: false }).order("id"));

  if (priceError) return { ok: false, error: priceError.message, groups: [], total: 0, hasPrices: false };
  const priceInfo: Record<string, { unitPrice: number; supplier: string }> = {};
  for (const p of purch || []) {
    if (!priceInfo[inventoryKey(p)] && Number(p.qty) > 0) {
      priceInfo[inventoryKey(p)] = { unitPrice: Number(p.cost) / Number(p.qty), supplier: p.supplier || "" };
    }
  }

  const items = suggested.map((x: any) => {
    const pi = priceInfo[inventoryKey(x)];
    const unitPrice = pi ? Math.round(pi.unitPrice * 100) / 100 : null;
    return {
      product: x.product, category: x.category, qty: x.suggested, unit: x.unit || "",
      unitPrice, lineCost: unitPrice != null ? Math.round(unitPrice * x.suggested * 100) / 100 : null,
      supplier: pi?.supplier || "",
    };
  });

  const bySupplier: Record<string, any[]> = {};
  for (const it of items) { const key = it.supplier || "__none"; (bySupplier[key] ||= []).push(it); }
  const groups = Object.keys(bySupplier).map((sup) => {
    const list = bySupplier[sup];
    const subtotal = Math.round(list.reduce((s, it) => s + (it.lineCost || 0), 0) * 100) / 100;
    return { supplier: sup === "__none" ? "" : sup, items: list, subtotal };
  }).sort((a, b) => b.subtotal - a.subtotal);

  const total = Math.round(groups.reduce((s, g) => s + g.subtotal, 0) * 100) / 100;
  return { ok: true, groups, total, hasPrices: items.some((i: any) => i.unitPrice != null) };
}
