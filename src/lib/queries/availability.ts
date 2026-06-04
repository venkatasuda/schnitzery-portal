"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// AVAILABILITY + manager MISSING/NO-SHOW checks
// availability: id, user_id, branch_id, week_start, days(jsonb), created_at
//   days shape: { Monday: ["Morning","Evening"], Tuesday: [...], ... }
// ============================================================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}
function mondayOf(date = new Date()): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  return d.toISOString().slice(0, 10);
}
export async function getNextWeekStart(): Promise<string> {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return mondayOf(d);
}

// ── STAFF: get my availability for a week ──
export async function getMyAvailability(weekStart?: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", days: {}, weekStart: "" };
  const ws = weekStart || (await getNextWeekStart());
  const { data } = await supabase
    .from("availability")
    .select("days")
    .eq("user_id", user.id)
    .eq("week_start", ws)
    .maybeSingle();
  return { ok: true, days: (data?.days as any) || {}, weekStart: ws };
}

// ── STAFF: save availability (upsert by user + week) ──
export async function saveAvailability(weekStart: string, days: any) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };

  const { data: existing } = await supabase
    .from("availability").select("id")
    .eq("user_id", user.id).eq("week_start", weekStart).maybeSingle();

  if (existing) {
    const { error } = await supabase.from("availability").update({ days }).eq("id", existing.id);
    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase.from("availability").insert({
      user_id: user.id, branch_id: branchId, week_start: weekStart, days,
    });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}

// ── MANAGER: who hasn't submitted availability for a week ──
export async function getMissingAvailability(weekStart?: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", missing: [], submitted: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", missing: [], submitted: [] };
  const ws = weekStart || (await getNextWeekStart());

  const { data: staff } = await supabase
    .from("users").select("id, full_name").eq("branch_id", branchId).order("full_name");

  const { data: avails } = await supabase
    .from("availability").select("user_id").eq("branch_id", branchId).eq("week_start", ws);

  const submittedIds = new Set((avails || []).map((a: any) => a.user_id));
  const missing = (staff || []).filter((s: any) => !submittedIds.has(s.id));
  const submitted = (staff || []).filter((s: any) => submittedIds.has(s.id));

  return { ok: true, missing, submitted, weekStart: ws };
}

// ── MANAGER: no-shows for a date (rostered but didn't clock in) ──
export async function getNoShows(dateStr: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", noShows: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", noShows: [] };
  if (!dateStr) return { ok: false, error: "Pick a date.", noShows: [] };

  // which weekday + which week does this date fall in?
  const date = new Date(dateStr);
  const dayName = DAYS[date.getDay() === 0 ? 6 : date.getDay() - 1];
  const ws = mondayOf(date);

  // who was rostered that day?
  const { data: roster } = await supabase
    .from("weekly_roster").select("roster_data")
    .eq("branch_id", branchId).eq("week_start", ws).maybeSingle();

  const dayEntries = ((roster?.roster_data as any) || {})[dayName] || [];
  if (dayEntries.length === 0) return { ok: true, noShows: [], rosteredCount: 0, dayName };

  // who clocked in that date?
  const { data: logs } = await supabase
    .from("attendance_logs").select("user_id")
    .eq("branch_id", branchId).eq("work_date", dateStr);

  const clockedInIds = new Set((logs || []).map((l: any) => l.user_id));

  // rostered but not clocked in
  const noShows = dayEntries
    .filter((e: any) => !clockedInIds.has(e.user_id))
    .map((e: any) => ({ name: e.name, team: e.team, shift: e.shift }));

  return { ok: true, noShows, rosteredCount: dayEntries.length, dayName };
}