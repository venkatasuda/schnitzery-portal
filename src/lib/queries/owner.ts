"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";

// ============================================================
// OWNER MULTI-BRANCH LAYER (brand_owner + super_admin ONLY)
// branch_owner is a single-branch role and is treated as a manager
// elsewhere (people / action-center / branch-analytics / org-overview),
// so it is intentionally excluded here. Relies on RLS:
// accessible_branch_ids() returns every branch the caller may read
// (brand_owner/super_admin = all). A plain select on branches returns
// exactly the owner's scope — but note this layer does NOT add an
// app-level branch filter, so correctness depends entirely on RLS.
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, profile };
}
function isOwner(role?: string | null) {
  return ["brand_owner", "super_admin"].includes(role || "");
}
function todayStr() { return berlinToday(); }

// ── List the branches this owner can see (with franchise name) ──
export async function getMyBranches() {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", branches: [] };
  if (!isOwner(profile?.role)) return { ok: false, error: "Owners only.", branches: [] };

  // RLS scopes this to the owner's accessible branches automatically
  const { data, error } = await supabase
    .from("branches")
    .select("id, name, address, is_active, franchise_id, franchises:franchise_id (name)")
    .order("name");
  if (error) return { ok: false, error: error.message, branches: [] };
  return { ok: true, branches: data || [], role: profile?.role };
}

// ── Per-branch live stats across all accessible branches ──
// Returns one row per branch with the headline numbers.
export async function getBranchStats() {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", branches: [] };
  if (!isOwner(profile?.role)) return { ok: false, error: "Owners only.", branches: [] };
  const today = todayStr();

  // 1. branches in scope
  const { data: branches, error: bErr } = await supabase
    .from("branches").select("id, name, address").order("name");
  if (bErr) return { ok: false, error: bErr.message, branches: [] };
  const branchIds = (branches || []).map((b) => b.id);
  if (branchIds.length === 0) return { ok: true, branches: [], totals: emptyTotals() };

  // 2. pull the raw rows we need across all those branches in parallel
  const [users, attendance, leave, incidents] = await Promise.all([
    supabase.from("users").select("branch_id, status").in("branch_id", branchIds),
    supabase.from("attendance_logs").select("branch_id, status, work_date").in("branch_id", branchIds).eq("work_date", today),
    supabase.from("leave_requests").select("branch_id, status").in("branch_id", branchIds).eq("status", "pending"),
    supabase.from("incidents").select("branch_id, status").in("branch_id", branchIds).eq("status", "open"),
  ]);

  // 3. fold them into per-branch counters
  const map: Record<string, any> = {};
  for (const b of branches || []) {
    map[b.id] = { id: b.id, name: b.name, address: b.address, staff: 0, workingNow: 0, pendingLeave: 0, openIncidents: 0 };
  }
  for (const u of (users.data || [])) if (map[u.branch_id] && u.status === "active") map[u.branch_id].staff++;
  for (const a of (attendance.data || [])) if (map[a.branch_id] && ["active", "on-break"].includes(a.status)) map[a.branch_id].workingNow++;
  for (const l of (leave.data || [])) if (map[l.branch_id]) map[l.branch_id].pendingLeave++;
  for (const i of (incidents.data || [])) if (map[i.branch_id]) map[i.branch_id].openIncidents++;

  const rows = Object.values(map);
  // 4. org-wide totals
  const totals = rows.reduce((t: any, r: any) => ({
    branches: t.branches + 1,
    staff: t.staff + r.staff,
    workingNow: t.workingNow + r.workingNow,
    pendingLeave: t.pendingLeave + r.pendingLeave,
    openIncidents: t.openIncidents + r.openIncidents,
  }), emptyTotals());

  return { ok: true, branches: rows, totals, role: profile?.role };
}

function emptyTotals() {
  return { branches: 0, staff: 0, workingNow: 0, pendingLeave: 0, openIncidents: 0 };
}

// ── Detail for one branch (owner drilling in) ──
export async function getBranchDetail(branchId: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isOwner(profile?.role)) return { ok: false, error: "Owners only." };
  if (!branchId) return { ok: false, error: "No branch selected." };
  const today = todayStr();

  // branch info (RLS will block if not accessible → returns null)
  const { data: branch } = await supabase
    .from("branches").select("id, name, address, franchises:franchise_id (name)").eq("id", branchId).maybeSingle();
  if (!branch) return { ok: false, error: "Branch not found or not accessible." };

  const [staff, workingNow, pendingLeave, openIncidents, lowStockMaster, lowStockCounts] = await Promise.all([
    supabase.from("users").select("id, full_name, role, team", { count: "exact" }).eq("branch_id", branchId).eq("status", "active").order("full_name"),
    supabase.from("attendance_logs").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("work_date", today).in("status", ["active", "on-break"]),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "pending"),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "open"),
    supabase.from("inventory_master").select("product, soll").eq("branch_id", branchId).eq("is_active", true),
    supabase.from("inventory_counts").select("product, ist").eq("branch_id", branchId).eq("count_date", today),
  ]);

  // low stock = today's count below target
  const soll: Record<string, number> = {};
  for (const p of (lowStockMaster.data || [])) soll[p.product] = Number(p.soll);
  const latest: Record<string, number> = {};
  for (const c of (lowStockCounts.data || [])) if (!(c.product in latest)) latest[c.product] = Number(c.ist);
  let lowStock = 0;
  for (const prod in latest) if (soll[prod] != null && latest[prod] < soll[prod]) lowStock++;

  return {
    ok: true,
    branch: { id: branch.id, name: branch.name, address: branch.address, franchise: (branch.franchises as any)?.name || null },
    stats: {
      staff: staff.count || 0,
      workingNow: workingNow.count || 0,
      pendingLeave: pendingLeave.count || 0,
      openIncidents: openIncidents.count || 0,
      lowStock,
    },
    staffList: staff.data || [],
  };
}