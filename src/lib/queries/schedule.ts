"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { berlinMonday, berlinMonth } from "@/lib/time/berlinDate";

// ============================================================
// SCHEDULE / ROSTER — weekly_roster stores ONE row per branch
// per week. roster_data (jsonb) holds all assignments:
//   { "Monday": [{ user_id, name, team, shift }], "Tuesday": [...], ... }
// week_start is always the MONDAY date (YYYY-MM-DD) → fixes the
// old "dateless roster" bug; every roster knows its week.
// ============================================================

// Look up a shift's time string from the model (falls back to "").
export async function shiftTime(team: string, shift: string): Promise<string> {
  const t = SHIFT_MODEL[team]?.find((s) => s.shift === shift);
  return t?.time || "";
}

// Monday of the week containing `date` (default: today), as YYYY-MM-DD.
// Uses the Berlin business week (see berlinMonday) so it never lands on the
// wrong week near midnight.

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

// Helper for the UI: get this week's Monday (and optionally offset by N weeks).
export async function getWeekStart(offsetWeeks = 0): Promise<string> {
  return berlinMonday(offsetWeeks);
}

// ── STAFF: my shifts for a given week ──
export async function getMyShifts(weekStart?: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", shifts: [], weekStart: "" };
  if (!branchId) return { ok: false, error: "No branch assigned.", shifts: [], weekStart: "" };

  const ws = weekStart || berlinMonday();

  const { data, error } = await supabase
    .from("weekly_roster")
    .select("roster_data")
    .eq("branch_id", branchId)
    .eq("week_start", ws)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, shifts: [], weekStart: ws };

  const roster = (data?.roster_data as any) || {};
  const myShifts: { day: string; team: string; shift: string; time: string }[] = [];

  for (const day of DAYS) {
    const entries = roster[day] || [];
    for (const e of entries) {
      if (e.user_id === user.id) {
        myShifts.push({
          day,
          team: e.team,
          shift: e.shift,
          time: SHIFT_MODEL[e.team]?.find((s) => s.shift === e.shift)?.time || "",
        });
      }
    }
  }

  return { ok: true, shifts: myShifts, weekStart: ws };
}

// ── MANAGER: get the full roster for a week (for editing) ──
export async function getRoster(weekStart?: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) {
    return { ok: false, error: "Only managers can edit the roster." };
  }

  const ws = weekStart || berlinMonday();

  const { data } = await supabase
    .from("weekly_roster")
    .select("roster_data")
    .eq("branch_id", branchId)
    .eq("week_start", ws)
    .maybeSingle();

  // staff list for assignment dropdowns (same branch)
  const { data: staff } = await supabase
    .from("users")
    .select("id, full_name, role, contract_hours")
    .eq("branch_id", branchId)
    .order("full_name");

  // month-to-date worked hours per staff (capacity hint vs monthly contract)
  const monthStart = berlinMonth() + "-01";
  const { data: mLogs } = await supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, status")
    .eq("branch_id", branchId)
    .gte("work_date", monthStart)
    .eq("status", "complete");
  const workedMins: Record<string, number> = {};
  for (const l of mLogs || []) workedMins[l.user_id] = (workedMins[l.user_id] || 0) + (l.duration_mins || 0);

  const staffEnriched = (staff || []).map((s: any) => ({
    id: s.id,
    full_name: s.full_name,
    role: s.role,
    contractHours: s.contract_hours ?? null,
    workedH: Math.round(((workedMins[s.id] || 0) / 60) * 10) / 10,
  }));

  // availability submitted for THIS week → { [user_id]: { Monday: ["Morning",...], ... } }
  const { data: avRows } = await supabase
    .from("availability")
    .select("user_id, days")
    .eq("branch_id", branchId)
    .eq("week_start", ws);
  const avail: Record<string, any> = {};
  for (const a of avRows || []) avail[a.user_id] = a.days || {};

  return {
    ok: true,
    weekStart: ws,
    roster: (data?.roster_data as any) || {},
    staff: staffEnriched,
    avail,
  };
}

// ── MANAGER: save the roster for a week (upsert by branch + week) ──
export async function saveRoster(weekStart: string, rosterData: any) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) {
    return { ok: false, error: "Only managers can edit the roster." };
  }

  // upsert: one row per branch+week
  const { data: existing } = await supabase
    .from("weekly_roster")
    .select("id")
    .eq("branch_id", branchId)
    .eq("week_start", weekStart)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("weekly_roster")
      .update({ roster_data: rosterData })
      .eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .from("weekly_roster")
      .insert({ branch_id: branchId, week_start: weekStart, roster_data: rosterData });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── SWAP REQUESTS ──
export async function getStaffForSwap() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", staff: [] };
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("branch_id", branchId)
    .neq("id", user.id)
    .order("full_name");
  return { ok: true, staff: data || [] };
}

export async function submitSwap(myDay: string, otherUserId: string, otherDay: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!myDay || !otherUserId || !otherDay) return { ok: false, error: "Fill in all fields." };

  const { error } = await supabase.from("swap_requests").insert({
    branch_id: branchId,
    requester_id: user.id,
    my_day: myDay,
    other_person_id: otherUserId,
    their_day: otherDay,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMySwaps() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", swaps: [] };

  const { data, error } = await supabase
    .from("swap_requests")
    .select("*")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message, swaps: [] };
  return { ok: true, swaps: data || [] };
}