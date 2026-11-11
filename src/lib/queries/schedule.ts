"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL, TEAMS } from "@/lib/queries/schedule-constants";
import { berlinMonday, berlinMonth, isCalendarDate, mondayOfDate } from "@/lib/time/berlinDate";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { rosterEntryTimes } from "@/lib/time/roster";
import { shiftMinutes } from "@/lib/pay/calculations";
import { activeBranchFor } from "@/lib/activeBranch";
import { sendPushToUser } from "@/lib/push/delivery";

// ============================================================
// SCHEDULE / ROSTER — weekly_roster stores ONE row per branch
// per week. roster_data (jsonb) holds all assignments:
//   { "Monday": [{ user_id, name, team, shift }], "Tuesday": [...], ... }
// week_start is always the MONDAY date (YYYY-MM-DD) → fixes the
// old "dateless roster" bug; every roster knows its week.
// ============================================================

// Look up a shift's time string from the model (falls back to "").
export async function shiftTime(team: string, shift: string): Promise<string> {
  const t = SHIFT_MODEL[team]?.find((s) => s.shift === shift);
  return t?.time || "";
}

// Monday of the week containing `date` (default: today), as YYYY-MM-DD.
// Uses the Berlin business week (see berlinMonday) so it never lands on the
// wrong week near midnight.

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

// Helper for the UI: get this week's Monday (and optionally offset by N weeks).
export async function getWeekStart(offsetWeeks = 0): Promise<string> {
  return berlinMonday(offsetWeeks);
}

// ── Shifts page: everyone rostered in a date range (week or month), own entries flagged, times per date ──
// pending = the shift has no decided time yet (empty in Settings → Shift times).
export type TeamShift = { date: string; user_id: string; name: string; team: string; shift: string; start: string; end: string; pending: boolean; mine: boolean };
export async function getTeamShiftsRange(from: string, to: string) {
  if (!isCalendarDate(from) || !isCalendarDate(to) || from > to || Date.parse(to) - Date.parse(from) > 45 * 864e5) return { ok: false as const, error: "Invalid period.", shifts: [] as TeamShift[], isManager: false };
  const { supabase, user, branchId, profile } = await getMe();
  if (!user || !branchId) return { ok: false as const, error: "Not logged in.", shifts: [] as TeamShift[], isManager: false };
  const weeks: string[] = [];
  for (let w = mondayOfDate(from); w <= to; w = mondayOfDate(w, 1)) weeks.push(w);
  const [{ data, error }, times] = await Promise.all([
    supabase.from("weekly_roster").select("week_start, roster_data").eq("branch_id", branchId).in("week_start", weeks),
    getShiftTimes().catch(() => null),
  ]);
  if (error) return { ok: false as const, error: error.message, shifts: [] as TeamShift[], isManager: false };
  const tmap = new Map(((times as any)?.items ?? []).map((t: any) => [`${t.team}|${t.shift}`, t]));
  const shifts: TeamShift[] = [];
  for (const r of data || []) for (const [i, day] of DAYS.entries()) {
    const date = new Date(Date.parse(`${r.week_start}T12:00:00Z`) + i * 864e5).toISOString().slice(0, 10);
    if (date < from || date > to) continue;
    for (const e of ((r.roster_data as any)?.[day] || []) as any[]) {
      if (!e?.user_id) continue;
      const tm = rosterEntryTimes(e, tmap as any, date);
      shifts.push({ date, user_id: e.user_id, name: e.name || "—", team: e.team || "", shift: e.shift || "", start: tm?.start ?? "", end: tm?.end ?? "", pending: !tm, mine: e.user_id === user.id });
    }
  }
  shifts.sort((x, y) => (x.date + x.start + x.name).localeCompare(y.date + y.start + y.name));
  return { ok: true as const, shifts, isManager: ["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "") };
}

// ── MANAGER: get the full roster for a week (for editing) ──
export async function getRoster(weekStart?: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) {
    return { ok: false, error: "Only managers can edit the roster." };
  }

  const ws = weekStart || berlinMonday();
  if (!isCalendarDate(ws) || new Date(ws+"T12:00:00Z").getUTCDay() !== 1) return { ok:false, error:"Choose a Monday for the roster." };

  // Published roster (what staff see) + this week's unpublished draft (managers only), if any.
  const [{ data, error: rosterError }, { data: draftRow, error: draftError }, { data: tierRows }] = await Promise.all([
    supabase.from("weekly_roster").select("id,roster_data,published_at").eq("branch_id", branchId).eq("week_start", ws).maybeSingle(),
    (supabase as any).from("roster_drafts").select("roster_data,base_data,updated_at").eq("branch_id", branchId).eq("week_start", ws).maybeSingle(),
    (supabase as any).from("staff_tiers").select("user_id,tier").eq("branch_id", branchId),
  ]);
  if (rosterError || draftError) return { ok:false, error:(rosterError || draftError).message };
  const tiers: Record<string, number> = Object.fromEntries(((tierRows || []) as any[]).map((t) => [t.user_id, t.tier]));
  // The draft started from an older live roster (e.g. a cover was approved since) → publishing will be refused.
  const draftStale = !!draftRow && JSON.stringify(draftRow.base_data ?? null) !== JSON.stringify(data?.roster_data ?? null);

  // staff list for assignment dropdowns (same branch)
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, full_name, role, team, contract_hours")
    .eq("branch_id", branchId)
    .eq("status", "active").neq("role", "kiosk")
    .order("full_name");
  if (staffError) return { ok:false, error:staffError.message };

  // month-to-date worked hours per staff (capacity hint vs monthly contract)
  const monthStart = berlinMonth() + "-01";
  const { data: mLogs, error: logsError } = await supabase
    .from("attendance_logs")
    .select("user_id,duration_mins,status,clock_in,clock_out,breaks")
    .eq("branch_id", branchId)
    .gte("work_date", monthStart)
    .eq("status", "complete");
  if (logsError) return { ok:false, error:logsError.message };
  const workedMins: Record<string, number> = {};
  for (const l of mLogs || []) workedMins[l.user_id] = (workedMins[l.user_id] || 0) + shiftMinutes(l).paidMin;

  const staffEnriched = (staff || []).map((s: any) => ({
    id: s.id,
    full_name: s.full_name,
    role: s.role,
    team: s.team ?? null,
    contractHours: s.contract_hours ?? null,
    tier: tiers[s.id] ?? null,
    workedH: Math.round(((workedMins[s.id] || 0) / 60) * 10) / 10,
  }));

  // availability submitted for THIS week → { [user_id]: { Monday: ["Morning",...], ... } }
  const { data: avRows, error: availabilityError } = await supabase
    .from("availability")
    .select("user_id, days")
    .eq("branch_id", branchId)
    .eq("week_start", ws);
  if (availabilityError) return { ok:false, error:availabilityError.message };
  const avail: Record<string, any> = {};
  for (const a of avRows || []) avail[a.user_id] = a.days || {};

  return {
    ok: true,
    weekStart: ws,
    roster: ((draftRow?.roster_data ?? data?.roster_data) as any) || {},
    published: (data?.roster_data as any) || null,
    publishedAt: (data as any)?.published_at ?? null,
    hasDraft: !!draftRow, draftStale,
    expected: { draft: draftRow?.roster_data ?? null },
    staff: staffEnriched,
    avail,
  };
}

// ── MANAGER: save this week's DRAFT (staff see nothing until Publish) ──
// expected.draft = the draft as loaded (null = no draft yet); a concurrent edit is refused, not overwritten.
export async function saveRoster(weekStart: string, rosterData: any, expected: { draft: any } | null) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId) return { ok: false, error: "No branch assigned." };
  if (!["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) {
    return { ok: false, error: "Only managers can edit the roster." };
  }

  if (expected === undefined || !isCalendarDate(weekStart) || new Date(weekStart+"T12:00:00Z").getUTCDay() !== 1
    || !rosterData || typeof rosterData !== "object" || Array.isArray(rosterData)
    || Object.entries(rosterData).some(([day,rows])=>!DAYS.includes(day) || !Array.isArray(rows) || rows.length>200
      || rows.some(e=>!e || typeof e.user_id!=="string" || typeof e.shift!=="string"
        || !(SHIFT_MODEL[e.team]?.some(s=>s.shift===e.shift) || /^(?:[01]\d|2[0-3]):[0-5]\d–(?:[01]\d|2[0-3]):[0-5]\d$/.test(e.shift))
        || !TEAMS.includes(e.team)))) return {ok:false,code:"errInvalid",error:"Invalid roster. Reload before saving."};
  const ids = [...new Set<string>(Object.values(rosterData).flat().map((e:any)=>e.user_id))];
  const {data:people,error:peopleError}=ids.length ? await supabase.from("users").select("id,full_name").in("id",ids).eq("branch_id",branchId).eq("status","active").neq("role","kiosk") : {data:[],error:null};
  if (peopleError || people?.length!==ids.length) return {ok:false,code:"errStaff",error:"Roster staff must be active in this branch."};
  const names=new Map((people||[]).map(p=>[p.id,p.full_name]));
  const normalized=Object.fromEntries(Object.entries(rosterData).map(([day,rows])=>[day,(rows as any[]).map(e=>({user_id:e.user_id,name:names.get(e.user_id),team:e.team,shift:e.shift}))]));
  if (!expected || typeof expected !== "object") return {ok:false,code:"errReload",error:"Reload before saving."};
  const db = supabase as any;
  let res;
  if (expected.draft != null) {
    res = await db.from("roster_drafts").update({ roster_data: normalized, updated_by: user.id, updated_at: new Date().toISOString() })
      .eq("branch_id", branchId).eq("week_start", weekStart).eq("roster_data", JSON.stringify(expected.draft)).select("roster_data").maybeSingle();
  } else {
    const live = await supabase.from("weekly_roster").select("roster_data").eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();
    if (live.error) return {ok:false,error:live.error.message};
    res = await db.from("roster_drafts").insert({ branch_id: branchId, week_start: weekStart, roster_data: normalized, base_data: live.data?.roster_data ?? null, updated_by: user.id }).select("roster_data").maybeSingle();
  }
  const { data: changed, error } = res;
  if (error && error.code !== "23505") return {ok:false,error:error.message};
  if (error || !changed) return {ok:false,code:"errConflict",error:"Roster changed elsewhere. Reload before saving; your draft has not been saved."};
  return {ok:true,expected:{draft:changed.roster_data}};
}

// ── MANAGER: publish the draft — staff see it and get a notification ──
export async function publishRoster(weekStart: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user || !branchId || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) return { ok: false as const, error: "Only managers can edit the roster." };
  if (!isCalendarDate(weekStart)) return { ok: false as const, error: "Invalid roster. Reload before saving." };
  const { data, error } = await (supabase as any).rpc("publish_roster", { p_branch: branchId, p_week: weekStart });
  if (error) return { ok: false as const, code: error.code === "40001" ? "errStale" : error.code === "22023" ? "errNoDraft" : undefined, error: error.message };
  // Phone push to everyone on the published roster (best effort; the bell notification exists already).
  const live = await supabase.from("weekly_roster").select("roster_data").eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();
  const ids = [...new Set(Object.values((live.data?.roster_data as any) || {}).flat().map((e: any) => e?.user_id).filter(Boolean))] as string[];
  const d = new Date(weekStart + "T12:00:00Z");
  const dd = (l: string) => d.toLocaleDateString(l, { day: "2-digit", month: "2-digit", timeZone: "UTC" });
  await Promise.all(ids.map((id) => sendPushToUser(id, { title: "Roster published", body: `Your shifts for the week of ${dd("en-GB")} are out.`, url: "/schedule",
    de: { title: "Dienstplan veröffentlicht", body: `Deine Schichten für die Woche ab ${dd("de-DE")} sind da.` } }).catch(() => undefined)));
  return { ok: true as const, notified: Number(data ?? 0) };
}

// ── MANAGER: throw away this week's draft (the published roster stays) ──
export async function discardRosterDraft(weekStart: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user || !branchId || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile?.role || "")) return { ok: false as const, error: "Only managers can edit the roster." };
  if (!isCalendarDate(weekStart)) return { ok: false as const, error: "Invalid roster. Reload before saving." };
  const { error } = await (supabase as any).from("roster_drafts").delete().eq("branch_id", branchId).eq("week_start", weekStart);
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}

// Shift swaps run through the cover flow (src/lib/queries/cover.ts), which updates the roster on approval.
