"use server";

import { createClient } from "@/lib/supabase/server";
import { MULTI_BRANCH_ROLES, branchChoices } from "@/lib/activeBranch";
import { getOpsDashboard } from "@/lib/queries/ops-dashboard";
import { berlinToday } from "@/lib/time/berlinDate";
import { getBranchesHealth } from "@/lib/queries/owner-insights";

// "All my branches" — read-only side-by-side of every branch the caller may work in
// (home + linked). Nothing here writes; each row links into that branch.
export async function getMyBranchesOverview() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in.", rows: [] };
  const { data: me } = await db.from("users").select("role").eq("id", user.id).single();
  if (!MULTI_BRANCH_ROLES.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only.", rows: [] };

  const branches = await branchChoices(db);
  const today = berlinToday();
  const healthP = getBranchesHealth(branches.map((b) => b.id)).catch(() => null); // runs alongside the rows
  const rows = await Promise.all(branches.map(async (b) => {
    const [ops, pending, corrections] = await Promise.all([
      getOpsDashboard({ branchId: b.id, date: today }).catch(() => null),
      db.from("attendance_logs").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("status", "complete").or("approval_status.is.null,approval_status.eq.pending"),
      db.from("attendance_corrections").select("id", { count: "exact", head: true }).eq("branch_id", b.id).eq("status", "pending"),
    ]);
    const m = ops && ops.ok ? (ops as { metrics: { workingNow: number; scheduledTotal: number; late: number; absent: number; laborMins: number } }).metrics : null;
    return {
      id: b.id, name: b.name,
      workingNow: m?.workingNow ?? null, scheduled: m?.scheduledTotal ?? null, late: m?.late ?? null, absent: m?.absent ?? null,
      laborHours: m ? Math.round(m.laborMins / 6) / 10 : null,
      toApprove: pending.error || corrections.error ? null : (pending.count ?? 0) + (corrections.count ?? 0),
    };
  }));
  const h = await healthP;
  return { ok: true as const, rows: rows.map((r) => ({ ...r, health: h && h.ok ? h.scores[r.id] ?? null : null })) };
}
