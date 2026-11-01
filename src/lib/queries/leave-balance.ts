"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { bwHolidays } from "@/lib/time/holidays";

// Vacation (Urlaub) balance: allowance − Werktage taken (from approved leave
// this year) = remaining. Per BUrlG §3, leave is counted in Werktage — every
// calendar day EXCEPT Sundays and public holidays. We exclude Sundays plus the
// Baden-Württemberg public holidays for the year(s) the request spans.


// Count Werktage between two dates (inclusive): skip Sundays + public holidays.
function werktageBetween(from: string, to: string, holidays: Set<string>) {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime()) || end < d) return 0;
  let count = 0;
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !holidays.has(iso)) count++; // 0 = Sunday
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}

async function computeBalance(supabase: any, userId: string, allowance: number | null) {
  const year = new Date().getFullYear();
  const holidays = new Set([...bwHolidays(year), ...bwHolidays(year + 1)]);
  const { data: reqs } = await supabase
    .from("leave_requests")
    .select("from_date, to_date, status")
    .eq("user_id", userId).eq("status", "approved")
    .gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`);
  let used = 0;
  for (const r of reqs || []) if (r.from_date && r.to_date) used += werktageBetween(r.from_date, r.to_date, holidays);
  const total = allowance ?? 0;
  return { allowance: total, used, remaining: Math.max(0, total - used), year };
}

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: await activeBranchFor(supabase, p), homeBranchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

export async function getMyLeaveBalance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: me } = await supabase.from("users").select("annual_leave_days").eq("id", user.id).single();
  const b = await computeBalance(supabase, user.id, me?.annual_leave_days ?? null);
  return { ok: true as const, ...b };
}

export async function getStaffLeaveBalance(userId: string) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in." };
  if (!isManager(role)) return { ok: false as const, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id, annual_leave_days").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false as const, error: "Not in your branch." };
  const b = await computeBalance(supabase, userId, tgt.annual_leave_days ?? null);
  return { ok: true as const, ...b };
}

export async function setLeaveAllowance(userId: string, days: number) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in." };
  if (!isManager(role)) return { ok: false as const, error: "Managers only." };
  if (userId === user.id) return { ok: false as const, error: "You can't change your own contract details." };
  if (typeof days !== "number" || !Number.isFinite(days) || days < 0 || days > 366) return { ok: false as const, error: "Enter a valid level." };
  const { data: tgt } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false as const, error: "Not in your branch." };
  const { error } = await supabase.from("users").update({ annual_leave_days: days }).eq("id", userId);
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}