"use server";

import { createClient } from "@/lib/supabase/server";
import { getNextWeekStart } from "@/lib/queries/availability";

// ============================================================
// SCHEDULE OVERVIEW — powers the manager Schedule hub:
//  • This Week panel (submissions, roster status)
//  • Insights (shift distribution by team / person / day)
//  • Conflicts (scheduled-but-unavailable, double-booked)
// All scoped to the manager's branch for the upcoming week.
// ============================================================

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, role: null };
  const { data: profile } = await supabase
    .from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, role: profile?.role ?? null };
}

function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}

export async function getScheduleOverview(weekStart?: string) {
  const { supabase, user, branchId, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const ws = weekStart || (await getNextWeekStart());

  // staff (for submission counts + names)
  const { data: staff } = await supabase
    .from("users").select("id, full_name").eq("branch_id", branchId);
  const nameOf: Record<string, string> = {};
  for (const s of staff || []) nameOf[s.id] = s.full_name;
  const staffCount = (staff || []).length;

  // availability submissions for the week
  const { data: avails } = await supabase
    .from("availability").select("user_id, days").eq("branch_id", branchId).eq("week_start", ws);
  const submissionCount = (avails || []).length;
  const availByUser: Record<string, Record<string, string[]>> = {};
  for (const a of avails || []) availByUser[a.user_id] = (a.days as any) || {};

  // roster for the week
  const { data: rosterRow } = await supabase
    .from("weekly_roster").select("roster_data").eq("branch_id", branchId).eq("week_start", ws).maybeSingle();
  const roster: Record<string, any[]> = (rosterRow?.roster_data as any) || {};

  // walk the roster: totals, distributions, conflicts
  let totalShifts = 0;
  const byTeam: Record<string, number> = {};
  const byPerson: Record<string, number> = {};
  const byDay: Record<string, number> = {};
  const conflicts: { name: string; day: string; type: string; detail: string }[] = [];

  for (const d of DAYS) {
    const entries = roster[d] || [];
    byDay[d] = entries.length;
    totalShifts += entries.length;
    const seen: Record<string, boolean> = {};
    for (const e of entries) {
      const nm = e.name || nameOf[e.user_id] || "Unknown";
      if (e.team) byTeam[e.team] = (byTeam[e.team] || 0) + 1;
      byPerson[nm] = (byPerson[nm] || 0) + 1;

      if (seen[e.user_id]) {
        conflicts.push({ name: nm, day: d, type: "Double-booked", detail: "Assigned more than once this day" });
      }
      seen[e.user_id] = true;

      const av = availByUser[e.user_id];
      if (av && (!av[d] || av[d].length === 0)) {
        conflicts.push({ name: nm, day: d, type: "Unavailable", detail: "Scheduled but didn't mark availability" });
      }
    }
  }

  const byTeamArr = Object.entries(byTeam).map(([team, count]) => ({ team, count })).sort((a, b) => b.count - a.count);
  const byPersonArr = Object.entries(byPerson).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
  const byDayArr = DAYS.map((d) => ({ day: d, count: byDay[d] || 0 }));

  return {
    ok: true, weekStart: ws, staffCount, submissionCount,
    rosterExists: totalShifts > 0, totalShifts,
    byTeamArr, byPersonArr, byDayArr, conflicts,
  };
}