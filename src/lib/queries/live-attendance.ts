"use server";

import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/readAll";
import { berlinToday, berlinMonth } from "@/lib/time/berlinDate";
import { activeBranchFor } from "@/lib/activeBranch";
import { IMPLAUSIBLE_SHIFT_MIN, isImplausibleShift } from "@/lib/pay/calculations";

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
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, role: profile?.role ?? null };
}

function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}

function todayStr() { return berlinToday(); }
function thisMonth() { return berlinMonth(); } // YYYY-MM

// Month "YYYY-MM" → { start: "YYYY-MM-01", next: first day of next month }
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`;
  return { start, next };
}

// ── LIVE: the day's roster for the branch ──
// Open longer than this = treat as a forgotten clock-out (longest legal shift is 10h + breaks).
const STALE_OPEN_MS = 14 * 60 * 60 * 1000;

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

  // Shifts still open after 14h are almost always a forgotten clock-out. They sit on an
  // earlier work_date (so "today" never shows them) and stay out of payroll until closed.
  const staleBefore = new Date(Date.now() - STALE_OPEN_MS).toISOString();
  const { data: staleData, error: staleError } = await supabase
    .from("attendance_logs").select("id, user_id, clock_in")
    .eq("branch_id", branchId).in("status", ["active", "on-break"]).lt("clock_in", staleBefore)
    .order("clock_in", { ascending: true }).limit(50);
  if (staleError) return { ok: false, error: staleError.message };

  // Closed shifts over 16h that nobody has reviewed yet: a clock-out was forgotten and
  // fixed late (or by the system). They block approval until corrected (see below).
  const { count: suspect, error: suspectError } = await supabase
    .from("attendance_logs").select("id", { count: "exact", head: true })
    .eq("branch_id", branchId).eq("status", "complete").gt("duration_mins", IMPLAUSIBLE_SHIFT_MIN)
    .or("approval_status.is.null,approval_status.eq.pending");
  if (suspectError) return { ok: false, error: suspectError.message };

  const logs = data || [];
  const ids = Array.from(new Set([...logs, ...(staleData || [])].map((l) => l.user_id)));
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

  const forgotten = (staleData || []).map((l) => ({ id: l.id, name: names[l.user_id]?.full_name || "Unknown", clock_in: l.clock_in }));

  return { ok: true, date: day, rows, workingNow, completed, late, totalMins, forgotten, suspect: suspect || 0 };
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

  const { data: logs, error } = await readAll(supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, work_date, status")
    .eq("branch_id", branchId)
    .gte("work_date", start)
    .lt("work_date", next).order("id")); // > 1,000 shifts a month must not be cut off
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

  if (!branchId) return { ok: false, error: "No branch." };
  const { data: logs, error } = await readAll(supabase
    .from("attendance_logs")
    .select("id, user_id, work_date, clock_in, clock_out, duration_mins, late_mins, approval_status")
    .eq("branch_id", branchId)
    .eq("status", "complete")
    .or("approval_status.is.null,approval_status.eq.pending")
    .order("work_date", { ascending: true }).order("id"));
  if (error) return { ok: false, error: error.message };

  const pending = logs || [];

  const ids = Array.from(new Set(pending.map((l) => l.user_id)));
  const names: Record<string, { full_name: string; team: string }> = {};
  if (ids.length) {
    const { data: us, error: namesError } = await readAll(supabase.from("users").select("id, full_name, team").in("id", ids).order("id"));
    if (namesError) return { ok: false, error: namesError.message };
    for (const u of us || []) names[u.id] = { full_name: u.full_name, team: u.team };
    // Employees who moved branch are hidden by users RLS; resolve their names from
    // the shifts they worked here (bounded, branch-scoped RPC, one call per month).
    // ponytail: one RPC per pending month; batch if old pending months pile up.
    const months = [...new Set(pending.filter((l) => !names[l.user_id]).map((l) => String(l.work_date).slice(0, 7)))];
    for (const m of months) {
      const next = new Date(`${m}-01T00:00:00Z`); next.setUTCMonth(next.getUTCMonth() + 1);
      try {
        const { data: past } = await supabase.rpc("branch_worker_identities", { p_branch: branchId, p_from: `${m}-01`, p_to: next.toISOString().slice(0, 10) });
        for (const u of past || []) names[u.id] ??= { full_name: u.full_name, team: u.team };
      } catch { /* names are cosmetic; keep "Unknown" */ }
    }
  }

  const rows = pending.map((l) => ({
    id: l.id, user_id: l.user_id,
    name: names[l.user_id]?.full_name || "Unknown",
    team: names[l.user_id]?.team || "",
    work_date: l.work_date, clock_in: l.clock_in, clock_out: l.clock_out,
    duration_mins: l.duration_mins, late_mins: l.late_mins || 0,
    overtime: (l.duration_mins || 0) > LONG_SHIFT_MIN,
    suspect: isImplausibleShift(l), // probable forgotten clock-out: correct before approving
  }));

  return { ok: true, rows };
}

export async function setAttendanceApproval(logId: string, status: "approved" | "rejected") {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  if (!branchId) return { ok: false, error: "No branch." };
  if (typeof logId !== "string" || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(logId) || !["approved", "rejected"].includes(status)) return { ok: false, error: "Invalid attendance decision." };

  // A 16h+ shift is a forgotten clock-out until proven otherwise: it may be rejected,
  // but approving it would pay the wrong hours. Fix the time with a correction first.
  const { data: log, error: readError } = await supabase.from("attendance_logs")
    .select("user_id, clock_in, clock_out, duration_mins").eq("id", logId).eq("branch_id", branchId).maybeSingle();
  if (readError) return { ok: false, error: readError.message };
  // Nobody decides about their own shift (the database refuses it too), except the top role.
  if (log?.user_id === user.id && !["brand_owner", "super_admin"].includes(role || "")) return { ok: false, error: "You cannot edit or approve your own shifts." };
  if (status === "approved" && log && isImplausibleShift(log)) return { ok: false, error: "Over 16 hours: correct the clock-out time before approving." };

  const { data, error } = await supabase
    .from("attendance_logs").update({ approval_status: status }).eq("id", logId).eq("branch_id", branchId).eq("status", "complete")
    .or("approval_status.is.null,approval_status.eq.pending").select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: false, error: "Shift is unavailable or already reviewed. Reload the queue." };
  return { ok: true };
}
