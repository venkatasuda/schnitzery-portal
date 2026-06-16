"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// PEOPLE & PROFILE
// users: id, employee_code, full_name, email, team, contract_type,
//   contract_hours, phone, avatar_url, skills(text[]), status, role, branch_id
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}

// ── MY PROFILE: read ──
export async function getMyProfile() {
  const { user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", profile: null };
  return { ok: true, profile };
}

// ── MY PROFILE: update (staff can edit their own contact + skills) ──
export async function updateMyProfile(fields: {
  full_name?: string; phone?: string; skills?: string[];
}) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };

  const update: any = {};
  if (fields.full_name !== undefined) update.full_name = fields.full_name;
  if (fields.phone !== undefined) update.phone = fields.phone;
  if (fields.skills !== undefined) update.skills = fields.skills;

  const { error } = await supabase.from("users").update(update).eq("id", user.id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── DIRECTORY: everyone in my branch (name, team, phone, role) ──
export async function getDirectory() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", people: [] };
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, team, role, phone, email, avatar_url, status")
    .eq("branch_id", branchId)
    .order("full_name");
  if (error) return { ok: false, error: error.message, people: [] };
  return { ok: true, people: data || [] };
}

// ── MANAGER: full staff list ──
export async function getStaffList() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", staff: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", staff: [] };
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("branch_id", branchId)
    .order("full_name");
  if (error) return { ok: false, error: error.message, staff: [] };
  return { ok: true, staff: data || [] };
}

// ── MANAGER: update a staff member's details ──
export async function updateStaff(staffId: string, fields: {
  full_name?: string; employee_code?: string; team?: string;
  contract_type?: string; contract_hours?: number | null;
  phone?: string; role?: string; status?: string; skills?: string[];
}) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const callerRole = profile?.role || "";
  const isOwner = ["brand_owner", "super_admin"].includes(callerRole);

  // Self-protection: you can't change your own role or status (avoids lockout).
  if (staffId === user.id && (fields.role !== undefined || fields.status !== undefined)) {
    return { ok: false, error: "You can't change your own role or status." };
  }

  // Target must exist; non-owners can only manage staff in their own branch.
  const { data: target } = await supabase
    .from("users").select("id, branch_id, role").eq("id", staffId).single();
  if (!target) return { ok: false, error: "Staff member not found." };
  if (!isOwner && target.branch_id !== profile?.branch_id) {
    return { ok: false, error: "You can only manage staff in your own branch." };
  }

  // Role assignment: a caller can only assign roles within their authority.
  const ASSIGNABLE: Record<string, string[]> = {
    manager: ["staff", "manager"],
    branch_owner: ["staff", "manager"],
    brand_owner: ["staff", "manager", "branch_owner", "brand_owner"],
    super_admin: ["staff", "manager", "branch_owner", "brand_owner", "super_admin"],
  };
  if (fields.role !== undefined && !(ASSIGNABLE[callerRole] || []).includes(fields.role)) {
    return { ok: false, error: "You're not allowed to assign that role." };
  }

  const update: Record<string, unknown> = {};
  for (const k of ["full_name", "employee_code", "team", "contract_type", "phone", "role", "status", "skills"] as const) {
    if (fields[k] !== undefined) update[k] = fields[k];
  }
  if (fields.contract_hours !== undefined) update.contract_hours = fields.contract_hours;
  if (Object.keys(update).length === 0) return { ok: false, error: "No changes supplied." };

  const { data, error } = await supabase.from("users").update(update).eq("id", staffId).select("id");
  if (error) return { ok: false, error: error.message };
  if (!data || data.length === 0) return { ok: false, error: "Update didn't apply — check permissions or branch." };
  return { ok: true };
}