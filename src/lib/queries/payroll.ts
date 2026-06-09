"use server";

import { createClient } from "@/lib/supabase/server";

// Per-employee hours + gross pay for a given month (YYYY-MM), for the manager's
// branch. Sums worked minutes from attendance_logs; gross = hours × hourly_wage
// (blank where no wage is set — managers set wages on the Labor page).

function thisMonth() { return new Date().toISOString().slice(0, 7); }
function monthBounds(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${ym}-01`;
  const next = new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10); // m (1-based) = next month at 0-based index
  return { start, next };
}

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(r || "");
}

export async function getPayrollSummary(month?: string) {
  const ym = month || thisMonth();
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in.", month: ym, rows: [], totals: { hours: 0, gross: 0 } };
  if (!isManager(role)) return { ok: false, error: "Managers only.", month: ym, rows: [], totals: { hours: 0, gross: 0 } };

  const { start, next } = monthBounds(ym);

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("user_id, duration_mins, work_date")
    .eq("branch_id", branchId)
    .gte("work_date", start).lt("work_date", next);

  const { data: staff } = await supabase
    .from("users")
    .select("id, employee_code, full_name, team, hourly_wage")
    .eq("branch_id", branchId).order("full_name");

  const acc: Record<string, { mins: number; shifts: number }> = {};
  for (const l of logs || []) {
    const mins = l.duration_mins || 0;
    if (!acc[l.user_id]) acc[l.user_id] = { mins: 0, shifts: 0 };
    acc[l.user_id].mins += mins;
    if (mins > 0) acc[l.user_id].shifts += 1;
  }

  const rows = (staff || [])
    .map((s) => {
      const mins = acc[s.id]?.mins || 0;
      const shifts = acc[s.id]?.shifts || 0;
      const hours = Math.round(mins / 6) / 10; // one decimal
      const wage = s.hourly_wage ?? null;
      const gross = wage != null ? Math.round(hours * wage * 100) / 100 : null;
      return { code: s.employee_code || "", name: s.full_name, team: s.team || "", shifts, mins, hours, wage, gross };
    })
    .filter((r) => r.shifts > 0);

  const totals = rows.reduce(
    (t, r) => ({ hours: t.hours + r.hours, gross: t.gross + (r.gross || 0) }),
    { hours: 0, gross: 0 }
  );
  totals.hours = Math.round(totals.hours * 10) / 10;
  totals.gross = Math.round(totals.gross * 100) / 100;

  return { ok: true, month: ym, rows, totals };
}