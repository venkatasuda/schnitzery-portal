"use server";

import { createClient } from "@/lib/supabase/server";

// Vacation (Urlaub) balance: allowance − days taken (from approved leave this
// year) = remaining. Employees see their own; managers see + set their staff's.
// "Days taken" counts the calendar days in each approved request (inclusive).

function daysBetween(from: string, to: string) {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  return Math.max(1, Math.round((b - a) / 86400000) + 1);
}

async function computeBalance(supabase: any, userId: string, allowance: number | null) {
  const year = new Date().getFullYear();
  const { data: reqs } = await supabase
    .from("leave_requests")
    .select("from_date, to_date, status")
    .eq("user_id", userId).eq("status", "approved")
    .gte("from_date", `${year}-01-01`).lte("from_date", `${year}-12-31`);
  let used = 0;
  for (const r of reqs || []) if (r.from_date && r.to_date) used += daysBetween(r.from_date, r.to_date);
  const total = allowance ?? 0;
  return { allowance: total, used, remaining: Math.max(0, total - used), year };
}

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(r || "");
}

export async function getMyLeaveBalance() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: me } = await supabase.from("users").select("annual_leave_days").eq("id", user.id).single();
  const b = await computeBalance(supabase, user.id, me?.annual_leave_days ?? null);
  return { ok: true, ...b };
}

export async function getStaffLeaveBalance(userId: string) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id, annual_leave_days").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "Not in your branch." };
  const b = await computeBalance(supabase, userId, tgt.annual_leave_days ?? null);
  return { ok: true, ...b };
}

export async function setLeaveAllowance(userId: string, days: number) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "Not in your branch." };
  const { error } = await supabase.from("users").update({ annual_leave_days: days }).eq("id", userId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}