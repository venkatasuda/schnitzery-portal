import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { sendPushToUser } from "@/lib/push/delivery";
import { readAll } from "@/lib/supabase/readAll";
import { mondayOfDate, berlinToday } from "@/lib/time/berlinDate";
import { summarise, pushText, type BranchWeek } from "@/lib/owner/weeklySummary";

// Monday summary for owners (docs/OWNER-COCKPIT.md). Called by Vercel Cron
// (vercel.json) with "Authorization: Bearer $CRON_SECRET"; nothing else can run it.
// For every active branch owner / brand owner: last week's sales (vs. the week
// before), hours worked, purchases and open items across their branches →
// one bell notification + a push (German or English chosen on the device).
// Idempotent: a second run for the same week does nothing for that owner.
export const dynamic = "force-dynamic";
const OWNERS = ["branch_owner", "brand_owner", "super_admin"];

function authorised(req: Request) {
  const secret = process.env.CRON_SECRET, got = req.headers.get("authorization") || "";
  if (!secret || secret.length < 16) return false;
  const want = Buffer.from(`Bearer ${secret}`), have = Buffer.from(got);
  return want.length === have.length && timingSafeEqual(want, have);
}

const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

export async function GET(req: Request) {
  if (!authorised(req)) return NextResponse.json({ ok: false }, { status: 401 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ ok: false, error: "Not configured." }, { status: 500 });
  const db = createAdminClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const week = mondayOfDate(berlinToday(), -1), weekEnd = shift(week, 6), prev = shift(week, -7);
  const [owners, links, branches] = await Promise.all([
    db.from("users").select("id, role, branch_id").in("role", OWNERS).eq("status", "active"),
    db.from("user_branches").select("user_id, branch_id"),
    db.from("branches").select("id").eq("is_active", true),
  ]);
  if (owners.error || links.error || branches.error) return NextResponse.json({ ok: false, error: "Read failed." }, { status: 500 });
  const allIds = (branches.data || []).map((b) => b.id as string);
  if (!allIds.length) return NextResponse.json({ ok: true, sent: 0 });

  const [sales, logs, purch, pending, corr] = await Promise.all([
    // readAll: Supabase returns at most 1,000 rows per request; page through all of them.
    readAll(db.from("daily_sales").select("branch_id, sale_date, amount").in("branch_id", allIds).gte("sale_date", prev).lte("sale_date", weekEnd).order("id")),
    readAll(db.from("attendance_logs").select("branch_id, duration_mins").in("branch_id", allIds).eq("status", "complete").gte("work_date", week).lte("work_date", weekEnd).order("id")),
    readAll(db.from("inventory_purchases").select("branch_id, cost").in("branch_id", allIds).gte("purchase_date", week).lte("purchase_date", weekEnd).order("id")),
    readAll(db.from("attendance_logs").select("branch_id").in("branch_id", allIds).eq("status", "complete").or("approval_status.is.null,approval_status.eq.pending").order("id")),
    readAll(db.from("attendance_corrections").select("branch_id").in("branch_id", allIds).eq("status", "pending").order("id")),
  ]);
  if (sales.error || logs.error || purch.error || pending.error || corr.error) return NextResponse.json({ ok: false, error: "Read failed." }, { status: 500 });
  // ponytail: one read per table for all branches (fine for tens of branches); move to a SQL rollup if it grows.

  const perBranch = new Map<string, BranchWeek>();
  for (const id of allIds) {
    const s = (sales.data || []).filter((r) => r.branch_id === id);
    const sumSales = (from: string, to: string) => { const xs = s.filter((r) => r.sale_date >= from && r.sale_date <= to); return xs.length ? xs.reduce((a, r) => a + Number(r.amount || 0), 0) : null; };
    perBranch.set(id, {
      sales: sumSales(week, weekEnd), salesPrev: sumSales(prev, shift(week, -1)),
      hours: (logs.data || []).filter((r) => r.branch_id === id).reduce((a, r) => a + (Number(r.duration_mins) || 0), 0) / 60,
      purchases: (purch.data || []).filter((r) => r.branch_id === id).reduce((a, r) => a + (Number(r.cost) || 0), 0),
      open: (pending.data || []).filter((r) => r.branch_id === id).length + (corr.data || []).filter((r) => r.branch_id === id).length,
    });
  }

  let sent = 0;
  for (const o of owners.data || []) {
    const ids = o.role === "branch_owner"
      ? [...new Set([o.branch_id, ...(links.data || []).filter((l) => l.user_id === o.id).map((l) => l.branch_id)])].filter((b): b is string => !!b && perBranch.has(b))
      : allIds;
    if (!ids.length) continue;
    const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", o.id).eq("type", "weekly_summary").eq("title", week);
    if (count) continue; // already sent for this week
    const payload = summarise(week, ids.map((b) => perBranch.get(b)!));
    const { error } = await db.from("notifications").insert({ branch_id: o.branch_id, user_id: o.id, type: "weekly_summary", title: week, message: JSON.stringify(payload) });
    if (error) continue;
    try { await sendPushToUser(o.id, { ...pushText(payload, "en"), url: "/", de: pushText(payload, "de") }); } catch { /* best effort */ }
    sent++;
  }
  return NextResponse.json({ ok: true, week, sent });
}
