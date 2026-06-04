"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// OPERATIONS — checklists, incidents, performance notes + recognition
// checklists: id, branch_id, work_date, type(opening/closing), task,
//   done, completed_by, completed_at
// incidents: id, branch_id, reported_by, category, severity,
//   description, photo_url, status, reviewed_by, manager_note, created_at
// performance_notes: id, branch_id, user_id, note, author, created_at
//   (recognition = a note prefixed with [RECOGNITION])
// ============================================================

const RECOGNITION_TAG = "[RECOGNITION] ";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "franchise_owner", "brand_owner"].includes(role || "");
}
function todayStr() { return new Date().toISOString().slice(0, 10); }

// ─────────────── CHECKLISTS ───────────────

// Get today's checklist (auto-seeds from the template if none exists yet).
export async function getTodayChecklist() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", tasks: [], canManage: false };
  const today = todayStr();

  let { data: tasks } = await supabase
    .from("checklists")
    .select("*")
    .eq("branch_id", branchId)
    .eq("work_date", today)
    .order("type").order("id");

  return { ok: true, tasks: tasks || [], canManage: isManager(profile?.role), today };
}

// Add a checklist task for today (manager).
export async function addChecklistTask(type: string, task: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!task.trim()) return { ok: false, error: "Task can't be empty." };
  const { error } = await supabase.from("checklists").insert({
    branch_id: branchId, work_date: todayStr(), type: type || "opening", task, done: false,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Toggle a task done/undone (any staff).
export async function toggleTask(id: string, done: boolean) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.from("checklists").update({
    done,
    completed_by: done ? user.id : null,
    completed_at: done ? new Date().toISOString() : null,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Delete a checklist task (manager).
export async function deleteTask(id: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("checklists").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────── INCIDENTS ───────────────

export async function reportIncident(category: string, severity: string, description: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!description.trim()) return { ok: false, error: "Describe what happened." };
  const { error } = await supabase.from("incidents").insert({
    branch_id: branchId, reported_by: user.id,
    category: category || "Other", severity: severity || "medium",
    description, status: "open",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getIncidents() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", incidents: [], canManage: false };
  const manager = isManager(profile?.role);

  // managers see all branch incidents; staff see only their own
  let q = supabase
    .from("incidents")
    .select("*, reporter:reported_by (full_name)")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (!manager) q = q.eq("reported_by", user.id);

  const { data, error } = await q;
  if (error) return { ok: false, error: error.message, incidents: [], canManage: false };
  return { ok: true, incidents: data || [], canManage: manager };
}

export async function resolveIncident(id: string, note: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("incidents").update({
    status: "resolved", reviewed_by: profile?.full_name || "manager", manager_note: note || null,
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ─────────────── NOTES + RECOGNITION ───────────────

export async function getStaffForNotes() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", staff: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", staff: [] };
  const { data } = await supabase.from("users").select("id, full_name").eq("branch_id", branchId).order("full_name");
  return { ok: true, staff: data || [] };
}

export async function addNote(userId: string, note: string, isRecognition: boolean) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!userId || !note.trim()) return { ok: false, error: "Pick a person and write a note." };
  const { error } = await supabase.from("performance_notes").insert({
    branch_id: branchId, user_id: userId,
    note: (isRecognition ? RECOGNITION_TAG : "") + note,
    author: user.id,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getNotes() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", notes: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", notes: [] };
  const { data, error } = await supabase
    .from("performance_notes")
    .select("*, subject:user_id (full_name)")
    .eq("branch_id", branchId)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, notes: [] };
  const notes = (data || []).map((n: any) => ({
    ...n,
    isRecognition: (n.note || "").startsWith(RECOGNITION_TAG),
    cleanNote: (n.note || "").replace(RECOGNITION_TAG, ""),
  }));
  return { ok: true, notes };
}