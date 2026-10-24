"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { berlinToday } from "@/lib/time/berlinDate";

// Owner cockpit: targets for the active branch + yesterday's flash numbers.
const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const OWNER = ["branch_owner", "brand_owner", "super_admin"];
export type Targets = { labourPct: number | null; purchasePct: number | null; primePct: number | null };

async function ctx() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? "", branchId: await activeBranchFor(supabase, p) };
}

export async function getTargets() {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  if (!c.branchId) return { ok: false as const, error: "No branch." };
  const { data, error } = await c.supabase.from("branch_targets").select("labour_pct, purchase_pct, prime_pct").eq("branch_id", c.branchId).maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  const n = (v: unknown) => (v == null ? null : Number(v));
  return { ok: true as const, canEdit: OWNER.includes(c.role), targets: { labourPct: n(data?.labour_pct), purchasePct: n(data?.purchase_pct), primePct: n(data?.prime_pct) } as Targets };
}

export async function setTargets(t: Targets) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!OWNER.includes(c.role)) return { ok: false as const, error: "Owners only." };
  if (!c.branchId) return { ok: false as const, error: "No branch." };
  const ok = (v: unknown, max: number) => v === null || (typeof v === "number" && Number.isFinite(v) && v > 0 && v <= max);
  if (!t || !ok(t.labourPct, 100) || !ok(t.purchasePct, 100) || !ok(t.primePct, 200)) return { ok: false as const, error: "Enter a valid target." };
  const { error } = await c.supabase.from("branch_targets").upsert({
    branch_id: c.branchId, labour_pct: t.labourPct, purchase_pct: t.purchasePct, prime_pct: t.primePct,
    updated_by: c.user.id, updated_at: new Date().toISOString(),
  }, { onConflict: "branch_id" });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}

// Daily flash: yesterday vs the same weekday a week earlier (sales + worked hours).
// Sales are null when not entered — never shown as zero.
export async function getDailyFlash() {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  if (!c.branchId) return { ok: false as const, error: "No branch." };
  const shift = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const yesterday = shift(berlinToday(), -1), lastWeek = shift(yesterday, -7);
  const [sales, logs] = await Promise.all([
    c.supabase.from("daily_sales").select("sale_date, amount").eq("branch_id", c.branchId).in("sale_date", [yesterday, lastWeek]),
    c.supabase.from("attendance_logs").select("work_date, duration_mins").eq("branch_id", c.branchId).eq("status", "complete").in("work_date", [yesterday, lastWeek]),
  ]);
  if (sales.error || logs.error) return { ok: false as const, error: (sales.error || logs.error)!.message };
  const day = (d: string) => {
    const s = (sales.data || []).filter((r) => r.sale_date === d);
    const mins = (logs.data || []).filter((r) => r.work_date === d).reduce((sum, r) => sum + (Number(r.duration_mins) || 0), 0);
    return { date: d, sales: s.length ? s.reduce((sum, r) => sum + Number(r.amount || 0), 0) : null, hours: Math.round(mins / 6) / 10 };
  };
  return { ok: true as const, yesterday: day(yesterday), lastWeek: day(lastWeek) };
}
