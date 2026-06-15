"use server";

import { createClient } from "@/lib/supabase/server";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}

export async function submitCorrection(input: {
  type: string; targetDate: string; attendanceLogId?: string | null;
  requestedClockIn?: string | null; requestedClockOut?: string | null;
  reason: string; evidenceUrl?: string | null;
}) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!input.reason || !input.reason.trim()) return { ok: false, error: "A reason is required." };

  const { error } = await supabase.from("attendance_corrections").insert({
    user_id: user.id,
    branch_id: branchId ?? null,
    type: input.type,
    target_date: input.targetDate,
    attendance_log_id: input.attendanceLogId ?? null,
    requested_clock_in: input.requestedClockIn ?? null,
    requested_clock_out: input.requestedClockOut ?? null,
    reason: input.reason.trim(),
    evidence_url: input.evidenceUrl ?? null,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMyCorrections() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, items: [] as any[] };
  const { data, error } = await supabase
    .from("attendance_corrections")
    .select("id, type, target_date, requested_clock_in, requested_clock_out, reason, status, manager_note, decided_by, decided_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, items: [] };
  return { ok: true, items: data || [] };
}

export async function cancelCorrection(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false };
  const { error } = await supabase
    .from("attendance_corrections").delete()
    .eq("id", id).eq("user_id", user.id).eq("status", "pending");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Manager: pending correction requests in the branch, with employee names.
export async function getCorrectionApprovals() {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, items: [] as any[] };
  if (!MGR.includes(role || "")) return { ok: false, items: [] };

  const { data, error } = await supabase
    .from("attendance_corrections")
    .select("id, user_id, type, target_date, requested_clock_in, requested_clock_out, reason, evidence_url, created_at, original:attendance_logs(clock_in, clock_out)")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message, items: [] };

  const ids = [...new Set((data || []).map((d) => d.user_id))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabase.from("users").select("id, full_name").in("id", ids);
    for (const u of us || []) names[u.id] = u.full_name;
  }

  return {
    ok: true,
    items: (data || []).map((d) => {
      const o: any = Array.isArray((d as any).original) ? (d as any).original[0] : (d as any).original;
      return {
        ...d,
        name: names[d.user_id] || "Unknown",
        origIn: o?.clock_in ?? null,
        origOut: o?.clock_out ?? null,
      };
    }),
  };
}

export async function decideCorrection(id: string, approve: boolean, note?: string) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_attendance_correction", { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: data?.status };
}