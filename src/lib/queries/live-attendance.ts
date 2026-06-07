"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// LIVE ATTENDANCE + OVERTIME + APPROVALS — manager/owner views.
// RLS keeps everything scoped to accessible branches.
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

function todayStr() { return new Date().toISOString().slice(0, 10); }
function thisMonth() { return new Date().toISOString().slice(0, 7); } // YYYY-MM

// Month "YYYY-MM" → { start: "YYYY-MM-01", next: first day of next month }
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, next };
}

// ── LIVE: the day's roster for the branch ──
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
  const ids = Array.from(new Set(logs.map((l) => l.user_id)));
  const names: Record<string, { full_name: string; team: string }> = {};
  if (ids.length) {
    const { data: us } = await supabase.from("users").select("id, full_name, team").in("id", ids);
    for (const u of us || []) names[u.id] = { full_name: u.full_name, team: u.team };
  }

  const rows = logs.map((l) => ({
    id: l.id, user_id: l.user_id,
    name: names[l.user_id]?.full_name || "Unknown",
    team: names[l.user_id]?.team || "",
    clock_in: l.clock_in, clock_out: l.clock_out,
    duration_mins: l.duration_mins, status: l.status, late_mins: l.late_mins || 0,
  }));

  const workingNow = rows.filter((r) => r.status === "active" || r.status === "on-break").length;
  const completed = rows.filter((r) => r.status === "complete").length;
  const late = rows.filter((r) => (r.late_mins || 0) > 0).length;
  const totalMins = rows.reduce((s, r) => s + (r.duration_mins || 0), 0);

  return { ok: true, date: day, rows, workingNow, completed, late, totalMins };
}

// ── OVERTIME: monthly contract vs actual, per staff + long shifts ──
// Threshold for a "long shift" = 8h (480 min), the standard full day.
const LONG_SHIFT_MIN = 480;

export async function getMonthlyOvertime(month?: string) {
  const { supabase, user, branchId, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const ym = month || thisMonth();
  const { start, next } = monthBounds(ym);

  const { data: logs, error } = await supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, work_date, status")
    .eq("branch_id", branchId)
    .gte("work_date", start)
    .lt("work_date", next);
  if (error) return { ok: false, error: error.message };

  const { data: staff } = await supabase
    .from("users")
    .select("id, full_name, team, contract_hours, contract_type")
    .eq("branch_id", branchId);

  // accumulate worked minutes per user + collect long shifts
  const byUser: Record<string, { mins: number; shifts: number }> = {};
  const longShifts: { user_id: string; work_date: string; mins: number }[] = [];
  for (const l of logs || []) {
    if (!byUser[l.user_id]) byUser[l.user_id] = { mins: 0, shifts: 0 };
    byUser[l.user_id].mins += l.duration_mins || 0;
    if (l.duration_mins) byUser[l.user_id].shifts += 1;
    if ((l.duration_mins || 0) > LONG_SHIFT_MIN) {
      longShifts.push({ user_id: l.user_id, work_date: l.work_date, mins: l.duration_mins });
    }
  }

  const nameOf: Record<string, string> = {};
  for (const s of staff || []) nameOf[s.id] = s.full_name;

  const rows = (staff || [])
    .map((s) => {
      const worked = byUser[s.id]?.mins || 0;
      const shifts = byUser[s.id]?.shifts || 0;
      const contractMins = (s.contract_hours || 0) * 60;
      const overtimeMins = Math.max(0, worked - contractMins);
      const normalMins = Math.min(worked, contractMins);
      return {
        user_id: s.id, name: s.full_name, team: s.team || "",
        contractHours: s.contract_hours || 0, contractType: s.contract_type || "",
        workedMins: worked, normalMins, overtimeMins, shifts,
      };
    })
    .filter((r) => r.workedMins > 0 || r.contractHours > 0)
    .sort((a, b) => b.overtimeMins - a.overtimeMins);

  const longShiftsNamed = longShifts
    .map((l) => ({ ...l, name: nameOf[l.user_id] || "Unknown" }))
    .sort((a, b) => b.mins - a.mins);

  const totalOvertimeMins = rows.reduce((s, r) => s + r.overtimeMins, 0);
  const totalWorkedMins = rows.reduce((s, r) => s + r.workedMins, 0);
  const peopleOver = rows.filter((r) => r.overtimeMins > 0).length;

  return { ok: true, month: ym, rows, longShifts: longShiftsNamed, totalOvertimeMins, totalWorkedMins, peopleOver };
}

// ── APPROVALS: completed shifts awaiting manager sign-off ──
export async function getAttendanceApprovals() {
  const { supabase, user, branchId, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { data: logs, error } = await supabase
    .from("attendance_logs")
    .select("id, user_id, work_date, clock_in, clock_out, duration_mins, late_mins, approval_status")
    .eq("branch_id", branchId)
    .eq("status", "complete")
    .order("work_date", { ascending: false })
    .limit(80);
  if (error) return { ok: false, error: error.message };

  // pending = not yet approved/rejected (null or "pending")
  const pending = (logs || []).filter((l) => l.approval_status == null || l.approval_status === "pending");

  const ids = Array.from(new Set(pending.map((l) => l.user_id)));
  const names: Record<string, { full_name: string; team: string }> = {};
  if (ids.length) {
    const { data: us } = await supabase.from("users").select("id, full_name, team").in("id", ids);
    for (const u of us || []) names[u.id] = { full_name: u.full_name, team: u.team };
  }

  const rows = pending.map((l) => ({
    id: l.id, user_id: l.user_id,
    name: names[l.user_id]?.full_name || "Unknown",
    team: names[l.user_id]?.team || "",
    work_date: l.work_date, clock_in: l.clock_in, clock_out: l.clock_out,
    duration_mins: l.duration_mins, late_mins: l.late_mins || 0,
    overtime: (l.duration_mins || 0) > LONG_SHIFT_MIN,
  }));

  return { ok: true, rows };
}

export async function setAttendanceApproval(logId: string, status: "approved" | "rejected") {
  const { supabase, user, role } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const { error } = await supabase
    .from("attendance_logs").update({ approval_status: status }).eq("id", logId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}