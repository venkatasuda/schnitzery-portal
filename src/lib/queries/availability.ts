"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinMonday, mondayOfDate, berlinWeekdayIndex, isCalendarDate } from "@/lib/time/berlinDate";
import { isAvailDays, weeksOfMonth } from "@/lib/roster/avail-weeks";
import { activeBranchFor } from "@/lib/activeBranch";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { timesOn } from "@/lib/time/roster";
import { SHIFT_MODEL } from "@/lib/queries/schedule-constants";

// ============================================================
// AVAILABILITY + manager MISSING/NO-SHOW checks
// availability: id, user_id, branch_id, week_start, days(jsonb), created_at
//   days shape: { Monday: ["Morning","Evening"], Tuesday: [...], ... }
// ============================================================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const AHEAD = 8; // weeks ahead a person can enter availability for

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}
export async function getNextWeekStart(): Promise<string> {
  return berlinMonday(1);
}

// ── STAFF: get my availability for a week ──
export async function getMyAvailability(weekStart?: string) {
  const { supabase, user, homeBranchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", days: {}, weekStart: "" };
  // Any week from the current one up to AHEAD weeks from now; default is next week.
  const minWeek = berlinMonday(0), maxWeek = berlinMonday(AHEAD);
  const ws = weekStart || (await getNextWeekStart());
  if (!isCalendarDate(ws) || mondayOfDate(ws) !== ws || ws < minWeek || ws > maxWeek) return { ok: false, error: "Invalid availability.", days: {}, weekStart: "" };
  const [{ data }, { data: std }, { data: live }] = await Promise.all([
    supabase.from("availability").select("days").eq("user_id", user.id).eq("week_start", ws).maybeSingle(),
    (supabase as any).from("availability_defaults").select("days").eq("user_id", user.id).maybeSingle(),
    homeBranchId ? supabase.from("weekly_roster").select("id").eq("branch_id", homeBranchId).eq("week_start", ws).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  // Times shown on each option, per weekday (Fri/Sat can differ). Not tied to the person's team, because
  // all-rounders work in several: if teams have different times for a shift, all of them are shown.
  // "" = time not decided yet.
  const st = await getShiftTimes().catch(() => null);
  const byKey = new Map((st?.items || []).map((x) => [`${x.team}|${x.shift}`, x]));
  const floor = Object.keys(SHIFT_MODEL).filter((tm) => tm !== "Preparation");
  const slot: Record<string, [string, string][]> = {
    Preparation: [["Preparation", "Morning"]],
    Morning: floor.map((tm) => [tm, "Morning"]), Mid: floor.map((tm) => [tm, "Mid"]),
    Evening: floor.flatMap((tm): [string, string][] => [[tm, "Night"], [tm, "Evening"]]),
    Dishwashing: [["Dishwashing", "Morning"], ["Dishwashing", "Mid"], ["Dishwashing", "Night"]], // every dishwashing shift of the day
  };
  const times: Record<string, Record<string, string>> = {};
  DAYS.forEach((day, i) => {
    const date = new Date(Date.parse(`${ws}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10);
    times[day] = Object.fromEntries(Object.entries(slot).map(([key, tries]) => {
      const found = tries.map(([tm, sh]) => timesOn(byKey.get(`${tm}|${sh}`), date)).filter(Boolean).map((x) => `${x!.start}–${x!.end}`);
      return [key, [...new Set(found)].sort().join(" / ")];
    }));
  });
  // No entry for this week yet → start from the standing pattern ("every week"), if there is one.
  return { ok: true, days: ((data?.days ?? std?.days) as any) || {}, weekStart: ws, standing: !!std, fromStanding: !data && !!std, times,
    minWeek, maxWeek, published: !!live }; // published: this week's roster is already out — changes only help future planning
}

// ── STAFF: save availability ──
// scope: "week" = this week only · "month" = every week of this week's month (from the current week on) ·
// "always" = this week and the standing pattern used for every week without its own entry.
export async function saveAvailability(weekStart: string, days: unknown, scope: "week" | "month" | "always" = "week") {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  const minWeek = berlinMonday(0);
  if (!isCalendarDate(weekStart) || mondayOfDate(weekStart) !== weekStart || weekStart < minWeek || weekStart > berlinMonday(AHEAD)
    || !isAvailDays(days) || !["week", "month", "always"].includes(scope)) return { ok: false, error: "Invalid availability." };

  const weeks = scope === "month" ? weeksOfMonth(weekStart, minWeek) : [weekStart];
  const { data: existing, error: readError } = await supabase.from("availability").select("id, week_start").eq("user_id", user.id).in("week_start", weeks);
  if (readError) return { ok: false, error: readError.message };
  const idOf = new Map((existing || []).map((r) => [r.week_start as string, r.id]));
  const results = await Promise.all(weeks.map((w) => idOf.has(w)
    ? supabase.from("availability").update({ days }).eq("id", idOf.get(w)!)
    : supabase.from("availability").insert({ user_id: user.id, branch_id: branchId, week_start: w, days })));
  const failed = results.find((r) => r.error);
  if (failed?.error) return { ok: false, error: failed.error.message };
  if (scope === "always") {
    const { error } = await (supabase as any).from("availability_defaults").upsert({ user_id: user.id, branch_id: branchId, days, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true, weeks: weeks.length };
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

  // A standing pattern counts as submitted for every week.
  const { data: standing } = await (supabase as any).from("availability_defaults").select("user_id").eq("branch_id", branchId);
  const submittedIds = new Set([...(avails || []), ...((standing || []) as any[])].map((a: any) => a.user_id));
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
  const dayName = DAYS[berlinWeekdayIndex(dateStr)];
  const ws = mondayOfDate(dateStr);

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