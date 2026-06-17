"use server";

import { createClient } from "@/lib/supabase/server";
import { getOpsDashboard } from "@/lib/queries/ops-dashboard";
import { getShiftConflicts } from "@/lib/queries/shift-conflicts";
import { getStaffPerformance } from "@/lib/queries/branch-analytics";

// ============================================================================
// ACTION CENTER — one count of everything that needs a manager's attention,
// aggregated from the real tables (RLS-scoped, so a manager sees their branch,
// an owner sees all). Each line links to the page where it's resolved; we don't
// re-implement approve/reject here — this is the "what needs attention" radar.
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const OWNER = ["brand_owner", "super_admin"];

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

  const isOwner = OWNER.includes(me?.role ?? "");

  const [leaveR, swapR, attR, corrR, docR, brR, payR, conf] = await Promise.all([
    supabase.from("leave_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("swap_requests").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("attendance_logs").select("*", { count: "exact", head: true }).eq("status", "complete").or("approval_status.is.null,approval_status.eq.pending"),
    supabase.from("attendance_corrections").select("*", { count: "exact", head: true }).eq("status", "pending"),
    supabase.from("user_documents").select("*", { count: "exact", head: true }).not("expiry_date", "is", null).lte("expiry_date", in30),
    supabase.from("branches").select("*", { count: "exact", head: true }),
    supabase.from("payroll_runs").select("*", { count: "exact", head: true }).eq("month", prevMonth).eq("status", "approved"),
    getShiftConflicts({ weeks: 2 }).catch(() => null),
  ]);

  // Today's no-shows / not-in / late. Managers (single branch) use the ops
  // dashboard directly; owners aggregate it across every accessible branch.
  let noShows = 0, notCheckedIn = 0, lateToday = 0;
  if (isOwner) {
    const { data: brs } = await supabase.from("branches").select("id");
    const results = await Promise.all((brs || []).map((b) => getOpsDashboard({ branchId: b.id }).catch(() => null)));
    for (const r of results) { const mm: any = r && (r as any).ok ? (r as any).metrics : null; if (mm) { noShows += mm.absent || 0; notCheckedIn += mm.notCheckedIn || 0; lateToday += mm.late || 0; } }
  } else {
    const ops = await getOpsDashboard({}).catch(() => null);
    const m: any = ops && (ops as any).ok ? (ops as any).metrics : null;
    noShows = m?.absent ?? 0; notCheckedIn = m?.notCheckedIn ?? 0; lateToday = m?.late ?? 0;
  }

  const approvals = cnt(leaveR) + cnt(swapR) + cnt(attR);
  const corrections = cnt(corrR);
  const expiringDocs = cnt(docR);
  const branches = cnt(brR);
  const payrollPending = Math.max(0, branches - cnt(payR));
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

// ============================================================================
// STAFF ALERTS — turns the weekly per-employee numbers into specific, named
// "needs attention" items (e.g. "Sarah late 4x this week"), using simple
// thresholds on the same figures shown in the analytics staff table. Same
// RLS scope as everything else (manager = own branch, owner = all).
// ============================================================================

const LATE_THRESHOLD = 3;     // late this many times in the week -> flag
const ABSENT_THRESHOLD = 2;   // missed this many scheduled shifts -> flag
const LOW_ATT_PCT = 80;       // attendance below this % (with >=3 scheduled) -> flag

export async function getStaffAlerts() {
  const perf = await getStaffPerformance({ period: "weekly" }).catch(() => null);
  if (!perf || !(perf as any).ok) return { ok: false as const, alerts: [] as any[] };
  const rows = ((perf as any).rows || []) as any[];

  type Sev = "high" | "warn";
  const alerts: { id: string; userId: string; type: "absent" | "lowAtt" | "late"; name: string; n: number; severity: Sev }[] = [];
  for (const r of rows) {
    if (r.absent >= ABSENT_THRESHOLD)
      alerts.push({ id: `${r.id}-absent`, userId: r.id, type: "absent", name: r.name, n: r.absent, severity: "high" });
    if (r.attendancePct != null && r.attendancePct < LOW_ATT_PCT && r.scheduled >= 3)
      alerts.push({ id: `${r.id}-lowatt`, userId: r.id, type: "lowAtt", name: r.name, n: r.attendancePct, severity: "high" });
    if (r.late >= LATE_THRESHOLD)
      alerts.push({ id: `${r.id}-late`, userId: r.id, type: "late", name: r.name, n: r.late, severity: "warn" });
  }
  const rank: Record<Sev, number> = { high: 0, warn: 1 };
  alerts.sort((a, b) => (rank[a.severity] - rank[b.severity]) || (b.n - a.n));
  return { ok: true as const, alerts: alerts.slice(0, 8) };
}