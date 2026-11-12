"use server";
// Payroll pre-check for a month (managers, active branch): see src/lib/pay/precheck.ts.
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";
import { berlinToday, monthRange } from "@/lib/time/berlinDate";
import { shiftMinutes } from "@/lib/pay/calculations";
import { wageMapForBranches } from "@/lib/pay/wages";
import { payrollPrecheck, type PrecheckIssue } from "@/lib/pay/precheck";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

export async function getPayrollPrecheck(month: string) {
  let range; try { range = monthRange(month); } catch { return { ok: false as const, error: "Invalid month.", issues: [] as PrecheckIssue[] }; }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in.", issues: [] as PrecheckIssue[] };
  const { data: me } = await db.from("users").select("role, branch_id").eq("id", user.id).single();
  if (!me || !MGR.includes(me.role)) return { ok: false as const, error: "Managers only.", issues: [] as PrecheckIssue[] };
  const branch = await activeBranchFor(db, me);
  if (!branch) return { ok: false as const, error: "No branch.", issues: [] as PrecheckIssue[] };

  const [logs, staff, wages, corr] = await Promise.all([
    readAll(db.from("attendance_logs").select("user_id, work_date, clock_in, clock_out, status, approval_status, duration_mins, breaks").eq("branch_id", branch).gte("work_date", range.from).lte("work_date", range.to).order("id")),
    db.from("users").select("id, full_name, contract_type").eq("branch_id", branch),
    wageMapForBranches(db, [branch]).catch(() => null),
    db.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("branch_id", branch).eq("status", "pending"),
  ]);
  if (logs.error || staff.error) return { ok: false as const, error: "Could not load.", issues: [] as PrecheckIssue[] };
  const issues = payrollPrecheck({
    month, today: berlinToday(), pendingCorrections: corr.count ?? 0,
    logs: (logs.data || []).map((l) => ({ user_id: l.user_id as string, work_date: l.work_date as string, clock_in: l.clock_in as string | null, status: l.status as string | null, approval_status: (l as any).approval_status ?? null, paidMin: l.status === "complete" ? shiftMinutes(l as any).paidMin : 0 })),
    staff: (staff.data || []).map((s) => ({ id: s.id as string, name: (s.full_name as string) || "—", contract_type: s.contract_type as string | null })),
    // No wage data at all (wage history unavailable) → skip the wage checks instead of flagging everyone.
    wages: wages ?? Object.fromEntries((staff.data || []).map((s) => [s.id, 0])),
  });
  return { ok: true as const, issues: wages ? issues : issues.filter((i) => i.kind !== "noWage" && i.kind !== "belowMin" && i.kind !== "minijob") };
}
