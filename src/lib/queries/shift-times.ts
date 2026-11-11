"use server";

import { createClient } from "@/lib/supabase/server";
import { SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { activeBranchFor } from "@/lib/activeBranch";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null, name: null };
  const { data: p } = await supabase.from("users").select("role, branch_id, full_name").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: await activeBranchFor(supabase, p), homeBranchId: p?.branch_id ?? null, name: p?.full_name ?? null };
}

const hhmm = (t?: string | null) => (t || "").slice(0, 5);                 // "08:00:00" → "08:00"
function parseModel(t: string): { start: string; end: string } | null {     // "08:00–16:00" → parts
  const parts = (t || "").split(/[–\-—]/).map((s) => s.trim());
  return parts.length === 2 && parts[0] && parts[1] ? { start: parts[0], end: parts[1] } : null;
}

// start/end "" = time pending. friSatStart/friSatEnd: optional Friday + Saturday times.
export type ShiftTime = { team: string; shift: string; start: string; end: string; breakMins: number; scope: "branch" | "global" | "default"; friSatStart: string | null; friSatEnd: string | null };

// Resolved catalog for the caller's branch: branch row > global row > SHIFT_MODEL default.
export async function getShiftTimes() {
  const { supabase, branchId } = await getMe();
  const { data } = await supabase
    .from("shift_times")
    .select("branch_id, team, shift, start_time, end_time, fri_sat_start, fri_sat_end, break_mins, is_active");
  const rows = (data || []).filter((r) => r.is_active !== false);

  const map = new Map<string, ShiftTime>();
  // 1) defaults from the constants
  for (const team of Object.keys(SHIFT_MODEL)) {
    for (const s of SHIFT_MODEL[team]) {
      const p = parseModel(s.time);
      if (p) map.set(`${team}|${s.shift}`, { team, shift: s.shift, start: p.start, end: p.end, breakMins: 0, scope: "default", friSatStart: null, friSatEnd: null });
    }
  }
  // 2) overlay global rows
  for (const r of rows.filter((r) => r.branch_id === null))
    map.set(`${r.team}|${r.shift}`, { team: r.team, shift: r.shift, start: hhmm(r.start_time), end: hhmm(r.end_time), breakMins: r.break_mins || 0, scope: "global", friSatStart: hhmm((r as any).fri_sat_start) || null, friSatEnd: hhmm((r as any).fri_sat_end) || null });
  // 3) overlay this branch's rows (highest priority)
  if (branchId)
    for (const r of rows.filter((r) => r.branch_id === branchId))
      map.set(`${r.team}|${r.shift}`, { team: r.team, shift: r.shift, start: hhmm(r.start_time), end: hhmm(r.end_time), breakMins: r.break_mins || 0, scope: "branch", friSatStart: hhmm((r as any).fri_sat_start) || null, friSatEnd: hhmm((r as any).fri_sat_end) || null });

  return { ok: true, items: [...map.values()] };
}

// Manager edit: writes a branch-scoped override row (leaves the global default intact).
// start/end "" = time pending; friSatStart/friSatEnd "" = same as the other days.
export async function upsertShiftTime(input: { team: string; shift: string; start: string; end: string; breakMins: number; friSatStart?: string; friSatEnd?: string }) {
  const HM = /^\d{2}:\d{2}$/, ok = (a = "", b = "") => (a === "" && b === "") || (HM.test(a) && HM.test(b));
  if (!ok(input.start, input.end) || !ok(input.friSatStart, input.friSatEnd)) return { ok: false, error: "Enter both times as HH:MM, or leave both empty." };
  const { supabase, branchId, role, name } = await getMe();
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  const { data: existing } = await supabase
    .from("shift_times").select("id")
    .eq("branch_id", branchId).eq("team", input.team).eq("shift", input.shift).maybeSingle();

  const payload = {
    branch_id: branchId, team: input.team, shift: input.shift,
    start_time: input.start || null, end_time: input.end || null, fri_sat_start: input.friSatStart || null, fri_sat_end: input.friSatEnd || null, break_mins: input.breakMins,
    updated_by: name ?? null, updated_at: new Date().toISOString(),
  } as any; // fri_sat_* and nullable times come from migration 20261111090000 (generated types predate it)
  const { error } = existing?.id
    ? await supabase.from("shift_times").update(payload).eq("id", existing.id)
    : await supabase.from("shift_times").insert(payload);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}