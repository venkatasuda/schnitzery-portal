"use server";

import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/readAll";
import { activeBranchFor } from "@/lib/activeBranch";
import { isCalendarDate, mondayOfDate } from "@/lib/time/berlinDate";
import { shiftMinutes } from "@/lib/pay/calculations";
import { splitTips } from "@/lib/pay/tips";

// Weekly tip pool (Trinkgeld): manager enters cash + card tips for a Mon–Sun week;
// the split by worked hours is recomputed from completed attendance every time.
const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const MAX = 100000;

async function ctx() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db.from("users").select("role, branch_id").eq("id", user.id).single();
  return { db, user, role: p?.role ?? "", branchId: await activeBranchFor(db, p) };
}
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
const validWeek = (w: unknown): w is string => isCalendarDate(w) && mondayOfDate(w) === w;

export async function getTipWeek(weekStart: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  if (!c.branchId) return { ok: false as const, error: "No branch." };
  if (!validWeek(weekStart)) return { ok: false as const, error: "Invalid period." };
  const [pool, logs, staff] = await Promise.all([
    c.db.from("tip_pools").select("cash, card").eq("branch_id", c.branchId).eq("week_start", weekStart).maybeSingle(),
    readAll(c.db.from("attendance_logs").select("id, user_id, work_date, duration_mins, breaks, clock_in, clock_out, status, approval_status")
      .eq("branch_id", c.branchId).eq("status", "complete").gte("work_date", weekStart).lte("work_date", addDays(weekStart, 6)).order("id")),
    readAll(c.db.from("users").select("id, full_name").eq("branch_id", c.branchId).order("id")),
  ]);
  if (pool.error || logs.error || staff.error) return { ok: false as const, error: (pool.error || logs.error || staff.error)!.message };
  const mins: Record<string, number> = {};
  for (const l of logs.data || []) mins[l.user_id] = (mins[l.user_id] || 0) + shiftMinutes(l).paidMin;
  const cash = Number(pool.data?.cash ?? 0), card = Number(pool.data?.card ?? 0);
  const name = new Map((staff.data || []).map((u) => [u.id, u.full_name as string]));
  const shares = splitTips(cash + card, mins)
    .map((s) => ({ userId: s.user_id, name: name.get(s.user_id) || "—", hours: Math.round(s.mins / 6) / 10, eur: s.cents / 100 }))
    .sort((a, b) => b.hours - a.hours || a.name.localeCompare(b.name));
  return { ok: true as const, weekStart, entered: !!pool.data, cash, card, shares,
    unapproved: (logs.data || []).filter((l) => l.approval_status !== "approved").length };
}

export async function setTipWeek(weekStart: string, cash: number, card: number) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  if (!c.branchId) return { ok: false as const, error: "No branch." };
  if (!validWeek(weekStart)) return { ok: false as const, error: "Invalid period." };
  const ok = (v: unknown) => typeof v === "number" && Number.isFinite(v) && v >= 0 && v < MAX;
  if (!ok(cash) || !ok(card)) return { ok: false as const, error: "Enter valid tip amounts." };
  const { error } = await c.db.from("tip_pools").upsert({
    branch_id: c.branchId, week_start: weekStart, cash: Math.round(cash * 100) / 100, card: Math.round(card * 100) / 100,
    updated_by: c.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "branch_id,week_start" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
