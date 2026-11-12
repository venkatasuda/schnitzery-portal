"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";
import { sendPushToUser } from "@/lib/push/delivery";
import { activeBranchFor } from "@/lib/activeBranch";
import { availCovers } from "@/lib/roster/smart";
import { workTeams } from "@/lib/roster/teams";
import { createClient as createAdminClient } from "@supabase/supabase-js";

// Fire a push without ever blocking or breaking the caller. If push isn't set
// up (no VAPID keys, no subscriptions), sendPushToUser simply sends nothing.
type Text = { title: string; body: string };
async function pushSafe(userId: string | null | undefined, en: Text, de: Text, url: string) {
  if (!userId) return;
  try { await sendPushToUser(userId, { ...en, de, url }); } catch { /* best effort */ }
}

// ============================================================
// LEAVE REQUESTS + MANAGER APPROVALS (leave + swaps)
// leave_requests: id, branch_id, user_id, from_date, to_date,
//   reason, status, sick_note_url, decided_by, decided_at, created_at
// swap_requests: id, branch_id, requester_id, other_person_id,
//   my_day, their_day, status, created_at
// ============================================================

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users")
    .select("id, full_name, role, branch_id")
    .eq("id", user.id)
    .single();
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}

function isManager(role?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(role || "");
}

// ── STAFF: submit a leave request ──
const LEAVE_TYPES = ["vacation", "sick", "unpaid", "special"];
export async function submitLeave(fromDate: string, toDate: string, reason: string, leaveType = "vacation", sickNotePath: string | null = null) {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!fromDate || !toDate) return { ok: false, error: "Pick both dates." };
  if (toDate < fromDate) return { ok: false, error: "End date can't be before start date." };
  if (!LEAVE_TYPES.includes(leaveType)) return { ok: false, error: "Choose the type of time off." };
  // The note was uploaded by the employee into their own private folder; only that folder is accepted.
  if (sickNotePath && (leaveType !== "sick" || !sickNotePath.startsWith(`${user.id}/`) || sickNotePath.includes(".."))) return { ok: false, error: "Upload the sick note again." };

  const { error } = await supabase.from("leave_requests").insert({
    branch_id: branchId,
    user_id: user.id,
    from_date: fromDate,
    to_date: toDate,
    reason: reason || null,
    status: "pending",
    leave_type: leaveType,
    sick_note_url: sickNotePath,
  } as any);
  if (error) return { ok: false, error: error.message };
  // Sick: offer the rostered shifts to colleagues straight away (never blocks the request).
  const covers = leaveType === "sick" ? await offerSickCover(supabase, user.id, branchId, fromDate, toDate).catch(() => 0) : 0;
  return { ok: true, covers };
}

// ── Sick leave → offer the rostered shifts as cover and tell the colleagues who could take them ──
// Creates one open cover request per rostered shift in the sick period (today onwards, at most 14 days),
// then notifies same-team colleagues who are not working that day and have not marked themselves unavailable.
// Best effort: the leave request itself is already saved; a failure here never blocks it.
async function offerSickCover(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, branchId: string, from: string, to: string) {
  const DAY = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const add = (d: string, n: number) => new Date(Date.parse(`${d}T12:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
  const mon = (d: string) => add(d, -((new Date(`${d}T12:00:00Z`).getUTCDay() + 6) % 7));
  const today = berlinToday(), start = from > today ? from : today, end = to < add(start, 13) ? to : add(start, 13);
  if (end < start) return 0;
  const dates: string[] = []; for (let d = start; d <= end; d = add(d, 1)) dates.push(d);
  const weeks = [...new Set(dates.map(mon))];
  const { data: rosters } = await supabase.from("weekly_roster").select("week_start, roster_data").eq("branch_id", branchId).in("week_start", weeks);
  const rosterOf = new Map((rosters || []).map((r) => [r.week_start as string, (r.roster_data as any) || {}]));
  const shifts: { date: string; day: string; team: string; shift: string; working: Set<string> }[] = [];
  for (const date of dates) {
    const day = DAY[(new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7], entries: any[] = rosterOf.get(mon(date))?.[day] || [];
    for (const e of entries) if (e?.user_id === userId) shifts.push({ date, day, team: e.team, shift: e.shift, working: new Set(entries.map((x) => x?.user_id).filter(Boolean)) });
  }
  // One request per shift, sent together (separate statements so an existing request, 23505, only skips its own shift).
  const made = await Promise.all(shifts.map((s) => supabase.from("cover_requests").insert({ branch_id: branchId, requester_id: userId, work_date: s.date, day: s.day, team: s.team, shift: s.shift, reason: "Sick leave", status: "open" })));
  const offered = made.filter((r) => !r.error).length;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!offered || !url || !key) return offered;
  const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }) as any;
  const [{ data: team }, { data: weekly }, { data: standing }] = await Promise.all([
    admin.from("users").select("id, team, skills").eq("branch_id", branchId).eq("status", "active").neq("role", "kiosk").neq("id", userId),
    admin.from("availability").select("user_id, week_start, days").eq("branch_id", branchId).in("week_start", weeks),
    admin.from("availability_defaults").select("user_id, days").eq("branch_id", branchId),
  ]);
  const key2 = (shift: string) => (shift === "Night" ? "Evening" : shift);
  const sends: Promise<unknown>[] = []; // all bell + push messages go out together, not one after another
  for (const s of shifts) {
    for (const p of (team || []) as { id: string; team: string | null; skills: string[] | null }[]) {
      if (!workTeams(p.team, p.skills).includes(s.team) || s.working.has(p.id)) continue; // main team or a team in their skills
      const days = (weekly || []).find((a: any) => a.user_id === p.id && a.week_start === mon(s.date))?.days ?? (standing || []).find((a: any) => a.user_id === p.id)?.days;
      if (days && !availCovers(days, s.day, s.team, s.shift)) continue; // said they cannot
      const label = `${s.date.slice(8)}.${s.date.slice(5, 7)}. · ${s.team === "Preparation" ? "Preparation" : key2(s.shift)}`;
      sends.push(Promise.resolve(admin.rpc("notify", { p_user: p.id, p_branch: branchId, p_type: "cover_open", p_title: `${s.date}:${s.team}:${s.shift}`, p_message: `${label} needs cover`, p_window: "12:00:00" })).catch(() => undefined),
        pushSafe(p.id, { title: "Shift needs cover", body: `${label} — can you take it?` }, { title: "Schicht zu vergeben", body: `${label} — kannst du übernehmen?` }, "/cover"));
    }
  }
  await Promise.all(sends);
  return offered;
}

// ── STAFF: my leave requests ──
export async function getMyLeave() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", requests: [] };
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message, requests: [] };
  return { ok: true, requests: data || [] };
}

// ── STAFF: attach the sick note after submitting (file already uploaded to the own folder) ──
export async function attachSickNote(leaveId: string, path: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.rpc("attach_sick_note" as any, { p_id: leaveId, p_path: path } as any);
  if (error) return { ok: false, error: error.code === "42501" ? "Not found or no access." : "Upload the sick note again." };
  return { ok: true };
}

// ── Sick note: short-lived link for the employee or their manager ──
// The row lookup runs under RLS (own requests / managed branch), so only they get a link; the file
// itself sits in the private "documents" bucket and is signed server-side for 2 minutes.
export async function getSickNoteUrl(leaveId: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: row } = await supabase.from("leave_requests").select("sick_note_url").eq("id", leaveId).maybeSingle();
  const path = (row as any)?.sick_note_url as string | null | undefined;
  if (!path) return { ok: false, error: "Not found or no access." };
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storage = url && key ? createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } }).storage : supabase.storage;
  const { data, error } = await storage.from("documents").createSignedUrl(path, 120);
  if (error) return { ok: false, error: error.message };
  return { ok: true, url: data.signedUrl };
}

// ── MANAGER: all pending items (leave + swaps) for the branch ──
export async function getPendingApprovals() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", leave: [], swaps: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", leave: [], swaps: [] };

  // pending leave with the requester's name
  const { data: leave } = await supabase
    .from("leave_requests")
    .select("*, users:user_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  // pending swaps with both names
  const { data: swaps } = await supabase
    .from("swap_requests")
    .select("*, requester:requester_id (full_name), other:other_person_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "pending")
    .order("created_at", { ascending: false });

  return { ok: true, leave: leave || [], swaps: swaps || [] };
}

// ── MANAGER: decide a leave request ──
export async function decideLeave(id: string, decision: "approved" | "denied") {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };

  const { data: row, error } = await supabase
    .from("leave_requests")
    .update({ status: decision, decided_by: profile?.full_name || "manager", decided_at: new Date().toISOString() })
    .eq("id", id)
    .select("user_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await pushSafe(
    row?.user_id,
    decision === "approved" ? { title: "Time off approved", body: "Your time-off request was approved." } : { title: "Time off declined", body: "Your time-off request was declined." },
    decision === "approved" ? { title: "Urlaub genehmigt", body: "Dein Urlaubsantrag wurde genehmigt." } : { title: "Urlaub abgelehnt", body: "Dein Urlaubsantrag wurde abgelehnt." },
    "/leave",
  );
  return { ok: true };
}

// ── MANAGER: decide a swap request ──
export async function decideSwap(id: string, decision: "approved" | "denied") {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  // Legacy swaps have no week and never changed the roster: decline only; new swaps go through Cover.
  if (decision === "approved") return { ok: false, error: "Old swap request: decline it and use Shift cover (swap) instead." };

  const { data: row, error } = await supabase
    .from("swap_requests")
    .update({ status: decision })
    .eq("id", id)
    .select("requester_id")
    .single();
  if (error) return { ok: false, error: error.message };

  await pushSafe(
    row?.requester_id,
    { title: "Shift swap declined", body: "Please ask a colleague through Shift cover." },
    { title: "Schichttausch abgelehnt", body: "Bitte über Schicht abgeben / tauschen anfragen." },
    "/cover",
  );
  return { ok: true };
}

// ── Everyone's approved upcoming leave (for the team calendar) ──
export async function getTeamLeave() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", leave: [] };

  const today = berlinToday();
  const { data, error } = await supabase
    .from("leave_requests")
    .select("*, users:user_id (full_name)")
    .eq("branch_id", branchId)
    .eq("status", "approved")
    .gte("to_date", today)
    .order("from_date", { ascending: true });

  if (error) return { ok: false, error: error.message, leave: [] };
  return { ok: true, leave: data || [] };
}