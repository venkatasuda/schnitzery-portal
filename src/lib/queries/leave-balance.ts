"use server";

import { getMe } from "@/lib/queries/me";
import { createClient } from "@/lib/supabase/server";
import { bwHolidays } from "@/lib/time/holidays";

// Vacation (Urlaub) balance: allowance − Werktage taken (from approved leave
// this year) = remaining. Per BUrlG §3, leave is counted in Werktage — every
// calendar day EXCEPT Sundays and public holidays. We exclude Sundays plus the
// Baden-Württemberg public holidays for the year(s) the request spans.


// Werktage between two dates (inclusive): every day except Sundays + public holidays.
function werktage(from: string, to: string, holidays: Set<string>): string[] {
  const d = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (isNaN(d.getTime()) || isNaN(end.getTime()) || end < d) return [];
  const out: string[] = [];
  while (d <= end) {
    const iso = d.toISOString().slice(0, 10);
    if (d.getUTCDay() !== 0 && !holidays.has(iso)) out.push(iso); // 0 = Sunday
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

async function computeBalance(supabase: any, userId: string, allowance: number | null) {
  const year = new Date().getFullYear();
  const holidays = new Set([...bwHolidays(year), ...bwHolidays(year + 1)]);
  const { data: reqs, error } = await supabase
    .from("leave_requests")
    .select("from_date, to_date, leave_type, sick_note_url, eau_confirmed")
    .eq("user_id", userId).eq("status", "approved").in("leave_type", ["vacation", "sick"]) // unpaid / special leave never reduce holidays
    .lte("from_date", `${year}-12-31`).gte("to_date", `${year - 1}-12-01`);
  if (error) throw new Error(error.message);
  // § 9 BUrlG: sick days during holiday with a doctor's note (uploaded or eAU ticked) do not count as holiday.
  const sick = new Set<string>();
  for (const r of reqs || []) if (r.leave_type === "sick" && (r.sick_note_url || r.eau_confirmed) && r.from_date && r.to_date) for (const d of werktage(r.from_date, r.to_date, holidays)) sick.add(d);
  let used = 0;
  for (const r of reqs || []) if (r.leave_type === "vacation" && r.from_date && r.to_date && r.from_date >= `${year}-01-01`)
    used += werktage(r.from_date, r.to_date, holidays).filter((d) => !sick.has(d)).length;
  const total = allowance ?? 0;
  return { allowance: total, used, remaining: Math.max(0, total - used), year };
}

function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

export async function getMyLeaveBalance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: me } = await supabase.from("users").select("annual_leave_days").eq("id", user.id).single();
  try { return { ok: true as const, ...(await computeBalance(supabase, user.id, me?.annual_leave_days ?? null)) }; }
  catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Load failed." }; }
}

export async function getStaffLeaveBalance(userId: string) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in." };
  if (!isManager(role)) return { ok: false as const, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id, annual_leave_days").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false as const, error: "Not in your branch." };
  try { return { ok: true as const, ...(await computeBalance(supabase, userId, tgt.annual_leave_days ?? null)) }; }
  catch (e) { return { ok: false as const, error: e instanceof Error ? e.message : "Load failed." }; }
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