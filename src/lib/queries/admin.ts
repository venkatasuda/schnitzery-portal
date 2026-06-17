"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";

// ============================================================
// ADMIN & INSIGHTS — dashboard stats, branch settings, audit log
// branch_settings: branch_id(PK), qr_required, gps_mode, settings(jsonb)
// audit_logs: id, branch_id, action, actor, details, created_at
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}
function todayStr() { return berlinToday(); }

// ── DASHBOARD: live stats pulled from across the app ──
export async function getDashboardStats() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const today = todayStr();

  // Run the counts in parallel for speed
  const [
    clockedIn, staffCount, pendingLeave, pendingSwaps, openIncidents, todayCounts, products, checklistToday,
  ] = await Promise.all([
    supabase.from("attendance_logs").select("user_id", { count: "exact", head: true }).eq("branch_id", branchId).eq("work_date", today).in("status", ["active", "on-break"]),
    supabase.from("users").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "active"),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "pending"),
    supabase.from("swap_requests").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "pending"),
    supabase.from("incidents").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("status", "open"),
    supabase.from("inventory_counts").select("product, ist, soll").eq("branch_id", branchId).eq("count_date", today),
    supabase.from("inventory_master").select("product, soll").eq("branch_id", branchId).eq("is_active", true),
    supabase.from("checklists").select("done").eq("branch_id", branchId).eq("work_date", today),
  ]);

  // low-stock: latest count today below target
  const sollMap: Record<string, number> = {};
  for (const p of (products.data || [])) sollMap[p.product] = Number(p.soll);
  const latestCount: Record<string, number> = {};
  for (const c of (todayCounts.data || [])) {
    if (!(c.product in latestCount)) latestCount[c.product] = Number(c.ist);
  }
  let lowStock = 0;
  for (const prod in latestCount) {
    if (sollMap[prod] != null && latestCount[prod] < sollMap[prod]) lowStock++;
  }

  // checklist progress today
  const checks = checklistToday.data || [];
  const checklistDone = checks.filter((c: any) => c.done).length;
  const checklistTotal = checks.length;

  return {
    ok: true,
    stats: {
      clockedIn: clockedIn.count || 0,
      staffCount: staffCount.count || 0,
      pendingApprovals: (pendingLeave.count || 0) + (pendingSwaps.count || 0),
      openIncidents: openIncidents.count || 0,
      lowStock,
      checklistDone, checklistTotal,
    },
  };
}

// ── SETTINGS: get branch settings (creates default row if missing) ──
export async function getBranchSettings() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const { data } = await supabase.from("branch_settings").select("*").eq("branch_id", branchId).maybeSingle();
  return {
    ok: true,
    settings: data || { branch_id: branchId, qr_required: false, gps_mode: "off", settings: {} },
  };
}

// ── SETTINGS: save (upsert) ──
export async function saveBranchSettings(qrRequired: boolean, gpsMode: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const { error } = await supabase.from("branch_settings").upsert({
    branch_id: branchId, qr_required: qrRequired, gps_mode: gpsMode,
  });
  if (error) return { ok: false, error: error.message };

  // log it
  await supabase.from("audit_logs").insert({
    branch_id: branchId, action: "settings_updated",
    actor: profile?.full_name || "manager",
    details: `QR required: ${qrRequired}, GPS: ${gpsMode}`,
  });
  return { ok: true };
}

// ── AUDIT LOG: recent entries ──
export async function getAuditLog() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", logs: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", logs: [] };
  const { data, error } = await supabase
    .from("audit_logs").select("*").eq("branch_id", branchId)
    .order("created_at", { ascending: false }).limit(100);
  if (error) return { ok: false, error: error.message, logs: [] };
  return { ok: true, logs: data || [] };
}