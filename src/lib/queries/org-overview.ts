"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";
import { DAYS } from "@/lib/queries/schedule-constants";

// ============================================================================
// ORG OVERVIEW — cross-branch command view for brand_owner / super_admin.
// Totals across all branches, payroll / document / system-health signals, and
// a branch performance ranking. Bulk queries (no per-branch loop).
// Branch managers don't use this (they have one branch → /ops).
// ============================================================================

const OWNER = ["brand_owner", "super_admin"];
const LATE_MIN = 5;

const todayStr = () => berlinToday();
function mondayOfDate(s: string): string {
  const [Y, M, D] = s.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D)); const js = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (js === 0 ? -6 : 1 - js));
  return d.toISOString().slice(0, 10);
}
function dayNameOf(s: string): string {
  const [Y, M, D] = s.split("-").map(Number);
  const js = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  return DAYS[(js + 6) % 7];
}

export async function getOrgOverview() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!OWNER.includes(me?.role ?? "")) return { ok: false as const, error: "Owners only." };

  const { data: branches } = await supabase.from("branches").select("id, name").order("name");
  const ids = (branches || []).map((b) => b.id);
  if (!ids.length) return { ok: false as const, error: "No branches." };

  const today = todayStr();
  const monday = mondayOfDate(today);
  const dayName = dayNameOf(today);
  const month = today.slice(0, 7);
  const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

  const [usersR, logsR, rosterR, docsR, kioskR, payR] = await Promise.all([
    supabase.from("users").select("id, branch_id, role").in("branch_id", ids),
    supabase.from("attendance_logs").select("branch_id, user_id, clock_in, status, late_mins").in("branch_id", ids).eq("work_date", today),
    supabase.from("weekly_roster").select("branch_id, roster_data").in("branch_id", ids).eq("week_start", monday),
    supabase.from("user_documents").select("branch_id, expiry_date").in("branch_id", ids).not("expiry_date", "is", null).lte("expiry_date", in30),
    supabase.from("kiosks").select("branch_id, is_active, last_seen").in("branch_id", ids),
    supabase.from("payroll_runs").select("branch_id, status").in("branch_id", ids).eq("month", month),
  ]);

  type B = { id: string; name: string; employees: number; workingNow: number; attended: number; scheduled: number; late: number };
  const map: Record<string, B> = {};
  for (const b of branches || []) map[b.id] = { id: b.id, name: b.name, employees: 0, workingNow: 0, attended: 0, scheduled: 0, late: 0 };

  for (const u of usersR.data || []) if (map[u.branch_id] && u.role !== "kiosk") map[u.branch_id].employees++;

  const seen: Record<string, Set<string>> = {};
  for (const l of logsR.data || []) {
    const b = map[l.branch_id]; if (!b) continue;
    if (l.clock_in) { (seen[l.branch_id] ||= new Set()).add(l.user_id); }
    if (l.status === "active" || l.status === "on-break") b.workingNow++;
    if ((l.late_mins || 0) > LATE_MIN) b.late++;
  }
  for (const bid in seen) map[bid].attended = seen[bid].size;

  for (const r of rosterR.data || []) {
    const b = map[r.branch_id]; if (!b) continue;
    b.scheduled = (((r.roster_data as any) || {})[dayName] || []).length;
  }

  const expByBranch: Record<string, number> = {};
  for (const d of docsR.data || []) expByBranch[d.branch_id] = (expByBranch[d.branch_id] || 0) + 1;
  const expiringDocs = (docsR.data || []).length;

  const now = Date.now();
  let kiosksOffline = 0;
  for (const k of kioskR.data || []) if (k.is_active && (!k.last_seen || new Date(k.last_seen).getTime() < now - 15 * 60000)) kiosksOffline++;

  const approved = (payR.data || []).filter((p) => p.status === "approved").length;

  const rows = Object.values(map).map((b) => ({
    id: b.id, name: b.name, employees: b.employees, workingNow: b.workingNow,
    attended: b.attended, scheduled: b.scheduled, late: b.late,
    attendanceRate: b.scheduled > 0 ? Math.round((b.attended / b.scheduled) * 100) : null,
    issues: b.late + Math.max(0, b.scheduled - b.attended),
    expiringDocs: expByBranch[b.id] || 0,
  }));
  // rank: by attendance rate (branches with a roster first), then by who's working now
  rows.sort((a, b) => {
    const ar = a.attendanceRate, br = b.attendanceRate;
    if (ar != null && br != null && ar !== br) return br - ar;
    if (ar != null && br == null) return -1;
    if (ar == null && br != null) return 1;
    return b.workingNow - a.workingNow;
  });
  rows.forEach((r, i) => ((r as any).rank = i + 1));

  const totals = {
    branches: ids.length,
    employees: Object.values(map).reduce((s, b) => s + b.employees, 0),
    workingNow: Object.values(map).reduce((s, b) => s + b.workingNow, 0),
    attended: Object.values(map).reduce((s, b) => s + b.attended, 0),
    scheduled: Object.values(map).reduce((s, b) => s + b.scheduled, 0),
    issues: rows.reduce((s, b) => s + b.issues, 0),
  };

  return {
    ok: true as const,
    totals,
    payroll: { approved, total: ids.length, month },
    expiringDocs,
    health: { kiosksOffline, status: kiosksOffline > 0 ? "attention" : "ok" },
    ranking: rows,
  };
}