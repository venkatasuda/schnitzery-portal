"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// TIME & PAY — all computed from attendance_logs (no new tables)
// attendance_logs: id, user_id, branch_id, work_date, clock_in,
//   clock_out, duration_mins, status, breaks, late_mins, approval_status
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id, contract_hours").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}
// First & last day of a month (YYYY-MM). Default: current month.
function monthRange(month?: string) {
  const now = new Date();
  const ym = month || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [y, m] = ym.split("-").map(Number);
  const from = `${ym}-01`;
  const to = new Date(y, m, 0).toISOString().slice(0, 10); // last day
  return { ym, from, to };
}

// ── STAFF: my hours summary for a month ──
export async function getMyHours(month?: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { ym, from, to } = monthRange(month);

  const { data, error } = await supabase
    .from("attendance_logs")
    .select("work_date, duration_mins, status")
    .eq("user_id", user.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .eq("status", "complete");
  if (error) return { ok: false, error: error.message };

  const totalMins = (data || []).reduce((s, r) => s + (r.duration_mins || 0), 0);
  const shifts = (data || []).length;
  const targetHours = profile?.contract_hours ? Number(profile.contract_hours) : null;
  const totalHours = +(totalMins / 60).toFixed(1);

  return {
    ok: true, month: ym, totalMins, totalHours, shifts,
    targetHours,
    debt: targetHours != null ? +(targetHours - totalHours).toFixed(1) : null,
  };
}

// ── STAFF: my detailed timesheet for a month ──
export async function getMyTimesheet(month?: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", rows: [] };
  const { ym, from, to } = monthRange(month);
  const { data, error } = await supabase
    .from("attendance_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false });
  if (error) return { ok: false, error: error.message, rows: [] };
  return { ok: true, month: ym, rows: data || [] };
}

// ── MANAGER: payroll export for the branch (a month) ──
export async function getPayrollExport(month?: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", rows: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", rows: [] };
  const { ym, from, to } = monthRange(month);

  // all completed logs for the branch in the month, with staff names
  const { data: logs, error } = await supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, work_date, users:user_id (full_name, employee_code, contract_hours)")
    .eq("branch_id", branchId)
    .gte("work_date", from)
    .lte("work_date", to)
    .eq("status", "complete");
  if (error) return { ok: false, error: error.message, rows: [] };

  // aggregate per staff
  const byUser: Record<string, any> = {};
  for (const l of logs || []) {
    const id = l.user_id;
    if (!byUser[id]) {
      byUser[id] = {
        name: (l.users as any)?.full_name || "—",
        code: (l.users as any)?.employee_code || "",
        contract: (l.users as any)?.contract_hours ?? null,
        totalMins: 0, shifts: 0,
      };
    }
    byUser[id].totalMins += l.duration_mins || 0;
    byUser[id].shifts += 1;
  }

  const rows = Object.values(byUser).map((u: any) => ({
    name: u.name, code: u.code, shifts: u.shifts,
    hours: +(u.totalMins / 60).toFixed(2),
    contract: u.contract,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));

  return { ok: true, month: ym, rows };
}