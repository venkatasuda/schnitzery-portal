"use server";

import { createClient } from "@/lib/supabase/server";
import { getOpsDashboard } from "@/lib/queries/ops-dashboard";
import { getShiftConflicts } from "@/lib/queries/shift-conflicts";

// ============================================================================
// ACTION CENTER — one count of everything that needs a manager's attention,
// aggregated from the real tables (RLS-scoped, so a manager sees their branch,
// an owner sees all). Each line links to the page where it's resolved; we don't
// re-implement approve/reject here — this is the "what needs attention" radar.
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

export async function getActionCenter() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!MGR.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only." };

  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  const now = new Date();
  const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 7);

  const cnt = (p: any) => (p?.count ?? 0) as number;

  const [leaveR, swapR, attR, corrR, docR, brR, payR, ops, conf] = await Promise.all([
    supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("swap_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance_logs").select("*", { count: "exact", head: true }).eq("status", "complete").or("approval_status.is.null,approval_status.eq.pending"),
    supabase.from("attendance_corrections").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("user_documents").select("*", { count: "exact", head: true }).not("expiry_date", "is", null).lte("expiry_date", in30),
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("payroll_runs").select("*", { count: "exact", head: true }).eq("month", prevMonth).eq("status", "approved"),
    getOpsDashboard({}).catch(() => null),
    getShiftConflicts({ weeks: 2 }).catch(() => null),
  ]);

  const approvals = cnt(leaveR) + cnt(swapR) + cnt(attR);
  const corrections = cnt(corrR);
  const expiringDocs = cnt(docR);
  const branches = cnt(brR);
  const payrollPending = Math.max(0, branches - cnt(payR));
  const m: any = ops && (ops as any).ok ? (ops as any).metrics : null;
  const noShows = m?.absent ?? 0;
  const notCheckedIn = m?.notCheckedIn ?? 0;
  const lateToday = m?.late ?? 0;
  const conflicts = conf && (conf as any).ok ? (conf as any).total : 0;

  const total = approvals + corrections + expiringDocs + payrollPending + noShows + notCheckedIn + conflicts;

  return {
    ok: true as const,
    total,
    items: {
      approvals: { count: approvals, leave: cnt(leaveR), swaps: cnt(swapR), attendance: cnt(attR) },
      corrections,
      expiringDocs,
      payrollPending,
      noShows,
      notCheckedIn,
      lateToday,
      conflicts,
      prevMonth,
    },
  };
}