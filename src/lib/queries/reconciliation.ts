"use server";
import { readAll } from "@/lib/supabase/readAll";
import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";
import { reconcileIntervals, transferMoves, type StockMove, type TransferEvent, type TransferRow } from "@/lib/inventory/reconciliation";

// Release C: per product, every pair of consecutive counts in the period, explained
// by deliveries, transfers and waste. Runs entirely under the caller's RLS.
// Grouped by category+product (not unit) so a unit mismatch is flagged, not hidden.
const MANAGERS = ["manager", "branch_owner", "brand_owner", "super_admin"];
const productKey = (r: { category?: string | null; product: string }) => JSON.stringify([r.category || "", r.product]);
const num = (v: unknown) => (v == null ? NaN : Number(v));

const OWNERS = ["brand_owner", "super_admin"];

// branchId: HQ (brand owner / super admin) may pick any branch it can read; everyone
// else always gets their own branch. RLS still decides what rows come back.
export async function getReconciliation(days = 90, branchId?: string | null) {
  if (!Number.isInteger(days) || days < 7 || days > 180) return { ok: false as const, error: "Invalid period." };
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: profile } = await db.from("users").select("role,branch_id").eq("id", user.id).single();
  if (!MANAGERS.includes(profile?.role)) return { ok: false as const, error: "Manager access with a branch is required." };
  let branch = profile?.branch_id as string | undefined;
  if (branchId && branchId !== branch) {
    if (!OWNERS.includes(profile?.role)) return { ok: false as const, error: "Manager access with a branch is required." };
    const { data: picked } = await db.from("branches").select("id").eq("id", branchId).maybeSingle();
    if (!picked) return { ok: false as const, error: "Branch access denied." };
    branch = branchId;
  }
  if (!branch) return { ok: false as const, error: "Manager access with a branch is required." };

  const today = berlinToday();
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - days * 86400000).toISOString().slice(0, 10);
  const [counts, purchases, waste, transfers, reviews] = await Promise.all([
    readAll(db.from("inventory_counts").select("id,product,category,unit,count_date,ist").eq("branch_id", branch).gte("count_date", from).order("count_date").order("created_at").order("id")),
    readAll(db.from("inventory_purchases").select("product,category,unit,qty,purchase_date").eq("branch_id", branch).gte("purchase_date", from).order("id")),
    readAll(db.from("waste_log").select("product,category,unit,qty,work_date").eq("branch_id", branch).gte("work_date", from).order("id")),
    // Anything that moved in the period, plus older transfers still in transit.
    readAll(db.from("stock_transfers").select("id,product,category,unit,qty,status,from_branch_id,to_branch_id,created_at")
      .or(`from_branch_id.eq.${branch},to_branch_id.eq.${branch}`).in("status", ["sent", "received"])
      .or(`updated_at.gte.${from},status.eq.sent`).order("id")),
    readAll(db.from("stock_reconciliation_reviews").select("from_count_id,to_count_id,note,figures,reviewed_by,created_at").eq("branch_id", branch).order("id")),
  ]);
  const failed = counts.error || purchases.error || waste.error || transfers.error || reviews.error;
  if (failed) return { ok: false as const, error: "Reconciliation could not be loaded. Try again." };

  const ids = (transfers.data || []).map(t => t.id as string);
  const events: TransferEvent[] = [];
  for (let i = 0; i < ids.length; i += 100) { // keep the id list well inside URL limits
    const res = await readAll(db.from("stock_events").select("source_id,operation,before_status:before_row->>status,after_status:after_row->>status,recorded_at")
      .eq("source_table", "stock_transfers").in("source_id", ids.slice(i, i + 100)).order("id"));
    if (res.error) return { ok: false as const, error: "Reconciliation could not be loaded. Try again." };
    events.push(...(res.data as TransferEvent[]));
  }

  const moves: Record<string, StockMove[]> = {};
  const add = (r: { category?: string | null; product: string }, m: StockMove) => (moves[productKey(r)] ||= []).push(m);
  for (const p of purchases.data || []) add(p, { kind: "delivered", date: p.purchase_date, qty: num(p.qty), unit: p.unit });
  for (const w of waste.data || []) add(w, { kind: "wasted", date: w.work_date, qty: num(w.qty), unit: w.unit });
  for (const t of transfers.data || []) for (const m of transferMoves(branch, t as TransferRow, events, today)) add(t, m);

  const byProduct: Record<string, { id: string; date: string; ist: number; unit: string | null; product: string; category: string }[]> = {};
  for (const c of counts.data || []) (byProduct[productKey(c)] ||= []).push({ id: c.id, date: c.count_date, ist: num(c.ist), unit: c.unit, product: c.product, category: c.category || "" });

  const reviewed = new Map((reviews.data || []).map(r => [`${r.from_count_id}|${r.to_count_id}`, r]));
  const rows = Object.entries(byProduct).flatMap(([key, list]) =>
    reconcileIntervals(list, moves[key] || []).map(iv => ({
      ...iv, product: list[0].product, category: list[0].category, unit: list.find(c => c.id === iv.toId)?.unit ?? null,
      review: reviewed.get(`${iv.fromId}|${iv.toId}`) ?? null,
    })))
    .sort((a, b) => b.to.localeCompare(a.to) || a.product.localeCompare(b.product));
  return { ok: true as const, rows, from, days, branch };
}

// The snapshot is recomputed here, never taken from the browser.
export async function addReconciliationReview(fromId: string, toId: string, note: string, days = 90, branchId?: string | null) {
  const text = String(note || "").trim();
  if (text.length < 3 || text.length > 500) return { ok: false as const, code: "noteLength" };
  const current = await getReconciliation(days, branchId);
  if (!current.ok) return { ok: false as const, error: current.error };
  const row = current.rows.find(r => r.fromId === fromId && r.toId === toId);
  if (!row) return { ok: false as const, code: "changed" };
  const { opening, delivered, received, sent, wasted, closing, expected, used, status, reasons } = row;
  const db = await createClient();
  const { error } = await db.from("stock_reconciliation_reviews").insert({
    branch_id: current.branch, from_count_id: fromId, to_count_id: toId, note: text,
    figures: { opening, delivered, received, sent, wasted, closing, expected, used, status, reasons },
  });
  if (error) return { ok: false as const, code: error.code === "23505" ? "already" : "saveFailed" };
  return { ok: true as const };
}
