"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { berlinToday, berlinMonday, mondayOfDate } from "@/lib/time/berlinDate";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}
const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const shiftTime = (team: string, shift: string) => SHIFT_MODEL[team]?.find((s) => s.shift === shift)?.time || "";

// ── STAFF: my upcoming shifts (this week + next), with any active cover request marked ──
export async function getMyUpcomingShifts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", shifts: [] };
  const today = berlinToday();
  const weeks = [berlinMonday(), berlinMonday(1)];

  const { data: rosters } = await supabase
    .from("weekly_roster").select("week_start, roster_data")
    .eq("branch_id", branchId).in("week_start", weeks);

  const { data: reqs } = await supabase
    .from("cover_requests").select("id, work_date, team, shift, status")
    .eq("branch_id", branchId).eq("requester_id", user.id).in("status", ["open", "claimed"]);
  const reqByKey: Record<string, any> = {};
  for (const r of reqs || []) reqByKey[`${r.work_date}|${r.team}|${r.shift}`] = r;

  const shifts: any[] = [];
  for (const row of rosters || []) {
    const rd = (row.roster_data as any) || {};
    for (const day of DAYS) {
      const wd = addDays(row.week_start, DAYS.indexOf(day));
      if (wd < today) continue;
      for (const e of rd[day] || []) {
        if (e.user_id === user.id) {
          const key = `${wd}|${e.team}|${e.shift}`;
          shifts.push({
            work_date: wd, day, team: e.team, shift: e.shift, time: shiftTime(e.team, e.shift),
            requestId: reqByKey[key]?.id || null, requestStatus: reqByKey[key]?.status || null,
          });
        }
      }
    }
  }
  shifts.sort((a, b) => a.work_date.localeCompare(b.work_date));
  return { ok: true, shifts };
}

export async function requestCover(work_date: string, day: string, team: string, shift: string, reason: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!work_date || !team || !shift) return { ok: false, error: "Missing shift details." };
  const { data: dupe } = await supabase
    .from("cover_requests").select("id")
    .eq("branch_id", branchId).eq("requester_id", user.id)
    .eq("work_date", work_date).eq("team", team).eq("shift", shift)
    .in("status", ["open", "claimed"]).maybeSingle();
  if (dupe) return { ok: false, error: "You already requested cover for this shift." };
  const { error } = await supabase.from("cover_requests").insert({
    branch_id: branchId, requester_id: user.id, work_date, day, team, shift, reason: reason || null, status: "open",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STAFF: open requests from others (claimable) ──
export async function getOpenCovers() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", covers: [] };
  const today = berlinToday();
  const { data } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name)")
    .eq("branch_id", branchId).eq("status", "open").neq("requester_id", user.id)
    .gte("work_date", today).order("work_date");
  return { ok: true, covers: data || [] };
}

export async function claimCover(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: row } = await supabase.from("cover_requests").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== "open") return { ok: false, error: "This request is no longer open." };
  if (row.requester_id === user.id) return { ok: false, error: "That's your own request." };
  const { error } = await supabase
    .from("cover_requests").update({ claimer_id: user.id, status: "claimed" })
    .eq("id", id).eq("status", "open");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelCover(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase
    .from("cover_requests").update({ status: "cancelled" })
    .eq("id", id).eq("requester_id", user.id).in("status", ["open", "claimed"]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STAFF: my own requests + shifts I've offered to cover ──
export async function getMyCovers() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", mine: [], claimed: [] };
  const { data: mine } = await supabase
    .from("cover_requests").select("*, claimer:claimer_id (full_name)")
    .eq("branch_id", branchId).eq("requester_id", user.id).order("created_at", { ascending: false });
  const { data: claimed } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name)")
    .eq("branch_id", branchId).eq("claimer_id", user.id).order("created_at", { ascending: false });
  return { ok: true, mine: mine || [], claimed: claimed || [] };
}

// ── MANAGER: active requests (open + claimed) to review ──
export async function getManagerCovers() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", covers: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", covers: [] };
  const { data } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name), claimer:claimer_id (full_name)")
    .eq("branch_id", branchId).in("status", ["open", "claimed"]).order("work_date");
  return { ok: true, covers: data || [] };
}

// ── MANAGER: approve (reassigns the roster) or reject ──
export async function decideCover(id: string, decision: "approved" | "rejected") {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { data: row } = await supabase.from("cover_requests").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Not found." };

  const stamp = { resolved_by: profile?.full_name || "manager", resolved_at: new Date().toISOString() };

  if (decision === "rejected") {
    const { error } = await supabase.from("cover_requests").update({ status: "rejected", ...stamp }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }

  if (!row.claimer_id) return { ok: false, error: "No one has claimed this shift yet." };

  const { data: claimer } = await supabase.from("users").select("full_name").eq("id", row.claimer_id).maybeSingle();

  // reassign the shift in the weekly roster
  const ws = mondayOfDate(row.work_date);
  const { data: rosterRow } = await supabase
    .from("weekly_roster").select("id, roster_data")
    .eq("branch_id", branchId).eq("week_start", ws).maybeSingle();

  let reassigned = false;
  if (rosterRow) {
    const rd = (rosterRow.roster_data as any) || {};
    const list = rd[row.day] || [];
    for (const e of list) {
      if (e.user_id === row.requester_id && e.team === row.team && e.shift === row.shift) {
        e.user_id = row.claimer_id;
        e.name = claimer?.full_name || e.name;
        reassigned = true;
        break;
      }
    }
    if (reassigned) await supabase.from("weekly_roster").update({ roster_data: rd }).eq("id", rosterRow.id);
  }

  const { error } = await supabase.from("cover_requests").update({ status: "approved", ...stamp }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, reassigned };
}