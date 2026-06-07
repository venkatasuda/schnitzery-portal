"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// LIVE ATTENDANCE — the branch roster for a given day.
// Powers the manager Attendance > Live screen (who's clocked in
// right now, who finished, who was late, total hours).
// RLS keeps this scoped to branches the manager can access.
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, role: null };
  const { data: profile } = await supabase
    .from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, role: profile?.role ?? null };
}

function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// Returns the day's attendance roster for the manager's branch, with names
// joined in and the four headline counts the old app showed.
export async function getLiveAttendance(date?: string) {
  const { supabase, user, branchId, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const day = date || todayStr();

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("id, user_id, clock_in, clock_out, duration_mins, status, late_mins")
    .eq("branch_id", branchId)
    .eq("work_date", day)
    .order("clock_in", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const logs = data || [];

  // Fetch names for the people who have a log today (one round-trip).
  const ids = Array.from(new Set(logs.map((l) => l.user_id)));
  const names: Record<string, { full_name: string; team: string }> = {};
  if (ids.length) {
    const { data: us } = await supabase
      .from("users").select("id, full_name, team").in("id", ids);
    for (const u of us || []) names[u.id] = { full_name: u.full_name, team: u.team };
  }

  const rows = logs.map((l) => ({
    id: l.id,
    user_id: l.user_id,
    name: names[l.user_id]?.full_name || "Unknown",
    team: names[l.user_id]?.team || "",
    clock_in: l.clock_in,
    clock_out: l.clock_out,
    duration_mins: l.duration_mins,
    status: l.status,
    late_mins: l.late_mins || 0,
  }));

  const workingNow = rows.filter((r) => r.status === "active" || r.status === "on-break").length;
  const completed = rows.filter((r) => r.status === "complete").length;
  const late = rows.filter((r) => (r.late_mins || 0) > 0).length;
  const totalMins = rows.reduce((s, r) => s + (r.duration_mins || 0), 0);

  return { ok: true, date: day, rows, workingNow, completed, late, totalMins };
}