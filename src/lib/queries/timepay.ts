"use server";
import { getMe } from "@/lib/queries/me";
import { readAll } from "@/lib/supabase/readAll";


import { monthRange } from "@/lib/time/berlinDate";
import { shiftMinutes } from "@/lib/pay/calculations";

// ============================================================
// TIME & PAY — all computed from attendance_logs (no new tables)
// attendance_logs: id, user_id, branch_id, work_date, clock_in,
//   clock_out, duration_mins, status, breaks, late_mins, approval_status
// ============================================================

function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}
// First & last day of a month (YYYY-MM). Default: current month.
export async function getMyHours(month?: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { ym, from, to } = monthRange(month);

  const { data, error } = await readAll(supabase
    .from("attendance_logs")
    .select("work_date, duration_mins, status, breaks, clock_in, clock_out")
    .eq("user_id", user.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .eq("status", "complete").order("id"));
  if (error) return { ok: false, error: error.message };

  const totalMins = (data || []).reduce((s, r) => s + shiftMinutes(r).paidMin, 0);
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
  const { data, error } = await readAll(supabase
    .from("attendance_logs")
    .select("*")
    .eq("user_id", user.id)
    .gte("work_date", from)
    .lte("work_date", to)
    .order("work_date", { ascending: false }).order("id"));
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
  const { data: logs, error } = await readAll(supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, breaks, clock_in, clock_out, work_date, users:user_id (full_name, employee_code, contract_hours)")
    .eq("branch_id", branchId)
    .gte("work_date", from)
    .lte("work_date", to)
    .eq("status", "complete").order("id"));
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
    byUser[id].totalMins += shiftMinutes(l).paidMin;
    byUser[id].shifts += 1;
  }

  const rows = Object.values(byUser).map((u: any) => ({
    name: u.name, code: u.code, shifts: u.shifts,
    hours: +(u.totalMins / 60).toFixed(2),
    contract: u.contract,
  })).sort((a: any, b: any) => a.name.localeCompare(b.name));

  return { ok: true, month: ym, rows };
}

// ── Working-time record (§ 16 ArbZG) for one person and month: yourself, or (managers) someone in your branches.
// Branch scope comes from RLS: a manager simply cannot read people or attendance outside their branches.
export async function getWorkingTimeRecord(month?: string, userId?: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in." };
  if (month !== undefined && !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { ok: false as const, error: "Invalid month." };
  const target = userId ?? user.id;
  if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(target)) return { ok: false as const, error: "Invalid person." };
  if (target !== user.id && !isManager(profile?.role)) return { ok: false as const, error: "Managers only." };
  const { ym, from, to } = monthRange(month);
  const [person, logs] = await Promise.all([
    supabase.from("users").select("id, full_name, employee_code, branch_id").eq("id", target).maybeSingle(),
    readAll(supabase.from("attendance_logs").select("work_date, clock_in, clock_out, breaks, duration_mins, status, approval_status, source")
      .eq("user_id", target).gte("work_date", from).lte("work_date", to).order("work_date").order("id")),
  ]);
  if (person.error || logs.error) return { ok: false as const, error: "Could not load the record." };
  if (!person.data) return { ok: false as const, error: "Managers only." }; // not visible = not in your branches
  const branch = person.data.branch_id ? await supabase.from("branches").select("name").eq("id", person.data.branch_id).maybeSingle() : null;
  return { ok: true as const, month: ym, person: { name: person.data.full_name as string, code: (person.data.employee_code as string | null) ?? "" },
    branch: (branch?.data?.name as string | undefined) ?? "", logs: logs.data ?? [] };
}
