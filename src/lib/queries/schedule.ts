"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { berlinMonday, berlinMonth, isCalendarDate } from "@/lib/time/berlinDate";
import { shiftMinutes } from "@/lib/pay/calculations";
import { activeBranchFor } from "@/lib/activeBranch";

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

// ── STAFF: my shifts for a given week ──
export async function getMyShifts(weekStart?: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", shifts: [], weekStart: "" };
  if (!branchId) return { ok: false, error: "No branch assigned.", shifts: [], weekStart: "" };

  const ws = weekStart || berlinMonday();

  const { data, error } = await supabase
    .from("weekly_roster")
    .select("roster_data")
    .eq("branch_id", branchId)
    .eq("week_start", ws)
    .maybeSingle();

  if (error) return { ok: false, error: error.message, shifts: [], weekStart: ws };

  const roster = (data?.roster_data as any) || {};
  const myShifts: { day: string; team: string; shift: string; time: string }[] = [];

  for (const day of DAYS) {
    const entries = roster[day] || [];
    for (const e of entries) {
      if (e.user_id === user.id) {
        myShifts.push({
          day,
          team: e.team,
          shift: e.shift,
          time: SHIFT_MODEL[e.team]?.find((s) => s.shift === e.shift)?.time || "",
        });
      }
    }
  }

  return { ok: true, shifts: myShifts, weekStart: ws };
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

  const { data, error: rosterError } = await supabase
    .from("weekly_roster")
    .select("id,roster_data")
    .eq("branch_id", branchId)
    .eq("week_start", ws)
    .maybeSingle();
  if (rosterError) return { ok:false, error:rosterError.message };

  // staff list for assignment dropdowns (same branch)
  const { data: staff, error: staffError } = await supabase
    .from("users")
    .select("id, full_name, role, contract_hours")
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
    contractHours: s.contract_hours ?? null,
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
    roster: (data?.roster_data as any) || {},
    expected: data ? { id:data.id, roster:data.roster_data } : null,
    staff: staffEnriched,
    avail,
  };
}

// ── MANAGER: save the roster for a week (upsert by branch + week) ──
export async function saveRoster(weekStart: string, rosterData: any, expected: {id:string;roster:any} | null) {
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
        || !["Manager","Preparation","Kitchen","Cashier","Dishwashing"].includes(e.team)))) return {ok:false,code:"errInvalid",error:"Invalid roster. Reload before saving."};
  const ids = [...new Set<string>(Object.values(rosterData).flat().map((e:any)=>e.user_id))];
  const {data:people,error:peopleError}=ids.length ? await supabase.from("users").select("id,full_name").in("id",ids).eq("branch_id",branchId).eq("status","active").neq("role","kiosk") : {data:[],error:null};
  if (peopleError || people?.length!==ids.length) return {ok:false,code:"errStaff",error:"Roster staff must be active in this branch."};
  const names=new Map((people||[]).map(p=>[p.id,p.full_name]));
  const normalized=Object.fromEntries(Object.entries(rosterData).map(([day,rows])=>[day,(rows as any[]).map(e=>({user_id:e.user_id,name:names.get(e.user_id),team:e.team,shift:e.shift}))]));
  let query;
  if (expected) {
    if (typeof expected.id!=="string") return {ok:false,code:"errReload",error:"Reload before saving."};
    query=supabase.from("weekly_roster").update({roster_data:normalized}).eq("id",expected.id).eq("branch_id",branchId).eq("week_start",weekStart);
    query=expected.roster==null ? query.is("roster_data",null) : query.eq("roster_data",JSON.stringify(expected.roster));
  } else query=supabase.from("weekly_roster").insert({branch_id:branchId,week_start:weekStart,roster_data:normalized});
  const {data:changed,error}=await query.select("id,roster_data").maybeSingle();
  if (error && error.code!=="23505") return {ok:false,error:error.message};
  if (error || !changed) return {ok:false,code:"errConflict",error:"Roster changed elsewhere. Reload before saving; your draft has not been saved."};
  return {ok:true,expected:{id:changed.id,roster:changed.roster_data}};
}

// ── SWAP REQUESTS ──
export async function getStaffForSwap() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", staff: [] };
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("branch_id", branchId)
    .neq("id", user.id)
    .order("full_name");
  return { ok: true, staff: data || [] };
}

export async function submitSwap(myDay: string, otherUserId: string, otherDay: string) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!myDay || !otherUserId || !otherDay) return { ok: false, error: "Fill in all fields." };

  const { error } = await supabase.from("swap_requests").insert({
    branch_id: branchId,
    requester_id: user.id,
    my_day: myDay,
    other_person_id: otherUserId,
    their_day: otherDay,
    status: "pending",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function getMySwaps() {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", swaps: [] };

  const { data, error } = await supabase
    .from("swap_requests")
    .select("*")
    .eq("requester_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: error.message, swaps: [] };
  return { ok: true, swaps: data || [] };
}
