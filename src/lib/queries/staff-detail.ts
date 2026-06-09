"use server";

import { createClient } from "@/lib/supabase/server";

// Manager/owner views of a single staff member: full details, this month's
// hours, and their documents. Every call verifies the caller is a manager
// AND that the target staff member is in the caller's own branch.

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

export async function getStaffDetail(userId: string) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data, error } = await supabase.from("users").select("*").eq("id", userId).single();
  if (error || !data) return { ok: false, error: error?.message || "Staff member not found." };
  if (data.branch_id !== branchId) return { ok: false, error: "This staff member isn't in your branch." };
  return { ok: true, staff: data };
}

export async function getStaffHours(userId: string) {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data: tgt } = await supabase.from("users").select("branch_id, contract_hours").eq("id", userId).single();
  if (!tgt || tgt.branch_id !== branchId) return { ok: false, error: "This staff member isn't in your branch." };

  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("duration_mins, status")
    .eq("user_id", userId).gte("work_date", first).eq("status", "complete");

  let workedMins = 0;
  for (const l of logs || []) workedMins += l.duration_mins || 0;
  return { ok: true, workedMins, shifts: (logs || []).length, contractHours: tgt.contract_hours ?? null };
}

export async function getStaffDocuments(userId: string) {
  const { supabase, user, role } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in.", documents: [] };
  if (!isManager(role)) return { ok: false, error: "Managers only.", documents: [] };
  const { data, error } = await supabase
    .from("user_documents").select("*").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, documents: [] };
  return { ok: true, documents: data || [] };
}

export async function getStaffDocumentUrl(filePath: string) {
  const { supabase, user, role } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };
  const { data, error } = await supabase.storage.from("documents").createSignedUrl(filePath, 120);
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data.signedUrl };
}