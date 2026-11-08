"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";
import { activeBranchFor } from "@/lib/activeBranch";

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
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}
function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}
function todayStr() { return berlinToday(); }

// ─────────────── CHECKLISTS ───────────────

// ISO weekday (1 = Monday … 7 = Sunday) of a Berlin calendar date.
const isoWeekday = (day: string) => new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
const groupOf = (t: { team: string; section: string | null }) => t.section ? `${t.team} · ${t.section}` : t.team;

// Today's checklist. The first visit of the day copies the branch's active templates for this
// weekday into today's rows; the (branch, day, template) unique index ignores repeats/races.
export async function getTodayChecklist() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", tasks: [], canManage: false, team: null as string | null };
  if (!branchId) return { ok: false, error: "No branch.", tasks: [], canManage: false, team: null as string | null };
  const today = todayStr();

  const { data: templates } = await supabase.from("checklist_templates")
    .select("id, team, section, task, task_de, input_kind, sort")
    .eq("branch_id", branchId).eq("is_active", true).contains("weekdays", [isoWeekday(today)]).order("sort").order("id");
  if (templates?.length) {
    // Missing table (migration not applied) or a race: ignore — the read below still works.
    await supabase.from("checklists").upsert(templates.map((t) => ({
      branch_id: branchId, work_date: today, template_id: t.id, type: groupOf(t), task: t.task, task_de: t.task_de,
      input_kind: t.input_kind, done: false,
    })), { onConflict: "branch_id,work_date,template_id", ignoreDuplicates: true });
  }

  const { data: tasks, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("branch_id", branchId)
    .eq("work_date", today)
    .order("type").order("id");
  if (error) return { ok: false, error: error.message, tasks: [], canManage: false, team: null as string | null };
  const { data: me } = await supabase.from("users").select("team").eq("id", user.id).maybeSingle();
  // Keep the template order within each team (hand-added tasks last).
  const order = new Map((templates ?? []).map((t) => [t.id, t.sort as number]));
  const sorted = [...(tasks || [])].sort((a, b) => String(a.type ?? "").localeCompare(String(b.type ?? ""))
    || (order.get(a.template_id) ?? 1e9) - (order.get(b.template_id) ?? 1e9) || String(a.id).localeCompare(String(b.id)));
  return { ok: true, tasks: sorted, canManage: isManager(profile?.role), today, team: (me?.team as string | null) ?? null };
}

// ── Checklist templates (manager): standing tasks per team and weekday ──
export type ChecklistTemplateInput = { team: string; section: string; task: string; task_de: string; weekdays: number[]; input_kind: string };
export async function getChecklistTemplates() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false as const, error: "Managers only." };
  const { data, error } = await supabase.from("checklist_templates")
    .select("id, team, section, task, task_de, weekdays, input_kind, sort, is_active")
    .eq("branch_id", branchId).order("team").order("section").order("sort").order("created_at");
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, templates: data || [] };
}
export async function saveChecklistTemplate(id: string | null, input: ChecklistTemplateInput) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!branchId) return { ok: false, error: "No branch." };
  const clean = (s: unknown, max: number) => (typeof s === "string" ? s.trim().slice(0, max) : "");
  const team = clean(input?.team, 60), section = clean(input?.section, 60), task = clean(input?.task, 300), taskDe = clean(input?.task_de, 300);
  const weekdays = [...new Set((Array.isArray(input?.weekdays) ? input.weekdays : []).map(Number))].filter((d) => Number.isInteger(d) && d >= 1 && d <= 7).sort();
  if (!team || task.length < 3 || (taskDe && taskDe.length < 3) || weekdays.length === 0) return { ok: false, error: "Enter team, task (3+ characters) and at least one weekday." };
  const row = { team, section: section || null, task, task_de: taskDe || null, weekdays, input_kind: input?.input_kind === "number" ? "number" : "check" };
  const { error } = id
    ? await supabase.from("checklist_templates").update(row).eq("id", id).eq("branch_id", branchId)
    : await supabase.from("checklist_templates").insert({ ...row, branch_id: branchId, created_by: user.id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
export async function setChecklistTemplateActive(id: string, active: boolean) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("checklist_templates").update({ is_active: !!active }).eq("id", id).eq("branch_id", branchId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Read-only checklist oversight for owners/managers: every task for a given
// date with who completed it + when (for inspection history). Defaults to today.
export async function getChecklistOversight(dateStr?: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", tasks: [], date: "", total: 0, done: 0 };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", tasks: [], date: "", total: 0, done: 0 };
  const day = (dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr)) ? dateStr : todayStr();

  const { data: tasks, error } = await supabase
    .from("checklists")
    .select("*")
    .eq("branch_id", branchId)
    .eq("work_date", day)
    .order("type").order("id");
  if (error) return { ok: false, error: error.message, tasks: [], date: day, total: 0, done: 0 };

  // resolve completer names in one extra query (robust; no FK-embed dependency)
  const ids = [...new Set((tasks || []).map((t) => t.completed_by).filter(Boolean))];
  const names: Record<string, string> = {};
  if (ids.length) {
    const { data: us } = await supabase.from("users").select("id, full_name").in("id", ids);
    for (const u of us || []) names[u.id] = u.full_name || "—";
  }
  const rows = (tasks || []).map((t) => ({
    ...t,
    completed_by_name: t.completed_by ? (names[t.completed_by] || "—") : null,
  }));
  return { ok: true, tasks: rows, date: day, total: rows.length, done: rows.filter((t) => t.done).length };
}

// Per-day completion history for the branch (last `days` days). Owner/manager.
// Returns only days that actually have tasks recorded.
export async function getChecklistHistory(days: number = 30) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", days: [] as { date: string; total: number; done: number }[] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", days: [] as { date: string; total: number; done: number }[] };
  const n = Math.min(Math.max(days, 1), 120);
  const today = todayStr();
  const from = new Date(today + "T00:00:00Z");
  from.setUTCDate(from.getUTCDate() - (n - 1));
  const fromStr = from.toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from("checklists")
    .select("work_date, done")
    .eq("branch_id", branchId)
    .gte("work_date", fromStr)
    .lte("work_date", today);
  if (error) return { ok: false, error: error.message, days: [] as { date: string; total: number; done: number }[] };

  const map: Record<string, { total: number; done: number }> = {};
  for (const r of data || []) {
    const d = r.work_date as string;
    if (!map[d]) map[d] = { total: 0, done: 0 };
    map[d].total++;
    if (r.done) map[d].done++;
  }
  const daysArr = Object.entries(map)
    .map(([date, c]) => ({ date, total: c.total, done: c.done }))
    .sort((a, b) => (a.date < b.date ? 1 : -1)); // most recent first
  return { ok: true, days: daysArr };
}

// Add a checklist task for today (manager). inputKind: 'check' (yes/no) or 'number' (reading).
export async function addChecklistTask(type: string, task: string, inputKind: string = "check") {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!task.trim()) return { ok: false, error: "Task can't be empty." };
  const kind = inputKind === "number" ? "number" : "check";
  const { error } = await supabase.from("checklists").insert({
    branch_id: branchId, work_date: todayStr(), type: type || "opening", task, done: false, input_kind: kind,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Toggle a yes/no task done/undone (any staff).
export async function toggleTask(id: string, done: boolean) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.from("checklists").update({
    done,
    completed_by: done ? user.id : null,
    completed_at: done ? new Date().toISOString() : null,
    ...(done ? {} : { value: null }), // undoing also clears any captured reading
  }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// Save a reading/value for a number task (any staff). Marks it done with who + when.
export async function saveTaskValue(id: string, value: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const v = (value ?? "").trim();
  if (!v) {
    // empty value = clear it back to not-done
    const { error } = await supabase.from("checklists").update({
      value: null, done: false, completed_by: null, completed_at: null,
    }).eq("id", id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  }
  const { error } = await supabase.from("checklists").update({
    value: v, done: true, completed_by: user.id, completed_at: new Date().toISOString(),
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