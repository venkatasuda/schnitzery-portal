"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// LEAVE REQUESTS + MANAGER APPROVALS (leave + swaps)
// leave_requests: id, branch_id, user_id, from_date, to_date,
//   reason, status, sick_note_url, decided_by, decided_at, created_at
// swap_requests: id, branch_id, requester_id, other_person_id,
//   my_day, their_day, status, created_at
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, role, branch_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}

function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}

// ── STAFF: submit a leave request ──
export async function submitLeave(fromDate: string, toDate: string, reason: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!fromDate || !toDate) return { ok: false, error: "Pick both dates." };
  if (toDate < fromDate) return { ok: false, error: "End date can't be before start date." };

  const { error } = await supabase.from("leave_requests").insert({
    branch_id: branchId,
    user_id: user.id,
    from_date: fromDate,
    to_date: toDate,
    reason: reason || null,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STAFF: my leave requests ──
export async function getMyLeave() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", requests: [] };
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, requests: [] };
  return { ok: true, requests: data || [] };
}

// ── MANAGER: all pending items (leave + swaps) for the branch ──
export async function getPendingApprovals() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", leave: [], swaps: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", leave: [], swaps: [] };

  // pending leave with the requester's name
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*, users:user_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // pending swaps with both names
  const { data: swaps } = await supabase
    .from("swap_requests")
    .select("*, requester:requester_id (full_name), other:other_person_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return { ok: true, leave: leave || [], swaps: swaps || [] };
}

// ── MANAGER: decide a leave request ──
export async function decideLeave(id: string, decision: "approved" | "denied") {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const { error } = await supabase
    .from("leave_requests")
    .update({ status: decision, decided_by: profile?.full_name || "manager", decided_at: new Date().toISOString() })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── MANAGER: decide a swap request ──
export async function decideSwap(id: string, decision: "approved" | "denied") {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const { error } = await supabase
    .from("swap_requests")
    .update({ status: decision })
    .eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Everyone's approved upcoming leave (for the team calendar) ──
export async function getTeamLeave() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", leave: [] };

  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*, users:user_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "approved")
    .gte("to_date", today)
    .order("from_date", { ascending: true });

  if (error) return { ok: false, error: error.message, leave: [] };
  return { ok: true, leave: data || [] };
}