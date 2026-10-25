"use server";

import { createClient } from "@/lib/supabase/server";
import { isCalendarDate } from "@/lib/time/berlinDate";
import { readAll } from "@/lib/supabase/readAll";
import { activeBranchFor } from "@/lib/activeBranch";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: await activeBranchFor(supabase, p), homeBranchId: p?.branch_id ?? null };
}

export async function submitCorrection(input: {
  type: string; targetDate: string; attendanceLogId?: string | null;
  requestedClockIn?: string | null; requestedClockOut?: string | null;
  reason: string; evidenceUrl?: string | null;
}) {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch." };
  if (!input || !["missing", "incorrect", "forgot_in", "forgot_out"].includes(input.type) || !isCalendarDate(input.targetDate)) return { ok: false, error: "Invalid correction type or date." };
  if (typeof input.reason !== "string" || !input.reason.trim() || input.reason.length > 2000) return { ok: false, error: "Provide a reason of up to 2000 characters." };
  for (const instant of [input.requestedClockIn, input.requestedClockOut]) if (instant != null && (typeof instant !== "string" || instant.length > 40 || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(instant) || !Number.isFinite(Date.parse(instant)))) return { ok: false, error: "Invalid correction clock time." };
  if ((["missing", "forgot_in"].includes(input.type) && !input.requestedClockIn) || (input.type === "forgot_out" && !input.requestedClockOut) || (input.type === "incorrect" && !input.requestedClockIn && !input.requestedClockOut)) return { ok: false, error: "Enter the requested clock time." };
  if (input.type === "missing" ? !!input.attendanceLogId : !input.attendanceLogId) return { ok: false, error: "Choose a recorded shift, or use the missing-shift request." };
  if (input.evidenceUrl != null && input.evidenceUrl !== "") {
    try {
      if (typeof input.evidenceUrl !== "string" || input.evidenceUrl.length > 2048) throw Error();
      const url = new URL(input.evidenceUrl);
      if (url.protocol !== "https:" || url.username || url.password) throw Error();
    } catch { return { ok: false, error: "Evidence must use an HTTPS URL." }; }
  }

  const { error } = await supabase.from("attendance_corrections").insert({
    user_id: user.id,
    branch_id: branchId,
    type: input.type,
    target_date: input.targetDate,
    attendance_log_id: input.attendanceLogId ?? null,
    requested_clock_in: input.requestedClockIn ?? null,
    requested_clock_out: input.requestedClockOut ?? null,
    reason: input.reason.trim(),
    evidence_url: input.evidenceUrl || null,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function listMyCorrections() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, items: [] as any[] };
  const { data, error } = await readAll(supabase
    .from("attendance_corrections")
    .select("id, type, target_date, requested_clock_in, requested_clock_out, reason, status, manager_note, decided_by, decided_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false }).order("id"));
  if (error) return { ok: false, error: error.message, items: [] };
  return { ok: true, items: data || [] };
}

export async function cancelCorrection(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false };
  const { data, error } = await supabase
    .from("attendance_corrections").delete()
    .eq("id", id).eq("user_id", user.id).eq("status", "pending").select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Request is unavailable or already decided." };
  return { ok: true };
}

// Manager: pending correction requests in the branch, with employee names.
export async function getCorrectionApprovals() {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, items: [] as any[] };
  if (!MGR.includes(role || "")) return { ok: false, items: [] };

  const { data, error } = await readAll(supabase
    .from("attendance_corrections")
    .select("id, user_id, type, target_date, requested_clock_in, requested_clock_out, reason, evidence_url, created_at, original:attendance_logs(clock_in, clock_out)")
    .eq("status", "pending")
    .order("created_at", { ascending: true }).order("id"));
  if (error) return { ok: false, error: error.message, items: [] };

  const ids = [...new Set((data || []).map((d) => d.user_id))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us, error: namesError } = await readAll(supabase.from("users").select("id, full_name").in("id", ids).order("id"));
    if (namesError) return { ok: false, error: namesError.message, items: [] };
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
  if (typeof id !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id) || typeof approve !== "boolean" || (note !== undefined && (typeof note !== "string" || note.length > 2000))) return { ok: false, error: "Invalid correction decision." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("decide_attendance_correction", { p_id: id, p_approve: approve, p_note: note ?? null });
  if (error) return { ok: false, error: error.message };
  return { ok: true, status: data?.status };
}
