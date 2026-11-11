"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";
import { berlinToday, berlinMonday, mondayOfDate } from "@/lib/time/berlinDate";
import { activeBranchFor } from "@/lib/activeBranch";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { wageMapForBranches } from "@/lib/pay/wages";
import { shiftMinutes } from "@/lib/pay/calculations";
import { isMinijob, minijobOverCap } from "@/lib/pay/legal";
import { rosterEntryTimes } from "@/lib/time/roster";
import { interval, restIssues, type Slot } from "@/lib/roster/cover-check";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}
const addDays = (dateStr: string, n: number) => {
  const d = new Date(dateStr + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const shiftTime = (team: string, shift: string) => SHIFT_MODEL[team]?.find((s) => s.shift === shift)?.time || "";

// ── STAFF: my upcoming shifts (this week + next), with any active cover request marked ──
export async function getMyUpcomingShifts() {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in.", shifts: [] };
  const today = berlinToday();
  const weeks = [berlinMonday(), berlinMonday(1)];

  const { data: rosters } = await supabase
    .from("weekly_roster").select("week_start, roster_data")
    .eq("branch_id", branchId).in("week_start", weeks);

  const { data: reqs } = await supabase
    .from("cover_requests").select("id, work_date, team, shift, status")
    .eq("branch_id", branchId).eq("requester_id", user.id).in("status", ["open", "claimed"]);
  const reqByKey: Record<string, any> = {};
  for (const r of reqs || []) reqByKey[`${r.work_date}|${r.team}|${r.shift}`] = r;

  const shifts: any[] = [];
  for (const row of rosters || []) {
    const rd = (row.roster_data as any) || {};
    for (const day of DAYS) {
      const wd = addDays(row.week_start, DAYS.indexOf(day));
      if (wd < today) continue;
      for (const e of rd[day] || []) {
        if (e.user_id === user.id) {
          const key = `${wd}|${e.team}|${e.shift}`;
          shifts.push({
            work_date: wd, day, team: e.team, shift: e.shift, time: shiftTime(e.team, e.shift),
            requestId: reqByKey[key]?.id || null, requestStatus: reqByKey[key]?.status || null,
          });
        }
      }
    }
  }
  shifts.sort((a, b) => a.work_date.localeCompare(b.work_date));
  return { ok: true, shifts };
}

export async function requestCover(work_date: string, day: string, team: string, shift: string, reason: string) {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in." };
  if (!work_date || !team || !shift) return { ok: false, error: "Missing shift details." };
  const { data: dupe } = await supabase
    .from("cover_requests").select("id")
    .eq("branch_id", branchId).eq("requester_id", user.id)
    .eq("work_date", work_date).eq("team", team).eq("shift", shift)
    .in("status", ["open", "claimed"]).maybeSingle();
  if (dupe) return { ok: false, error: "You already requested cover for this shift." };
  const { error } = await supabase.from("cover_requests").insert({
    branch_id: branchId, requester_id: user.id, work_date, day, team, shift, reason: reason || null, status: "open",
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STAFF: open requests from others (claimable) ──
export async function getOpenCovers() {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in.", covers: [] };
  const today = berlinToday();
  const { data } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name)")
    .eq("branch_id", branchId).eq("status", "open").neq("requester_id", user.id)
    .gte("work_date", today).order("work_date");
  return { ok: true, covers: data || [] };
}

// Claim an open request. Optionally offer one of your own upcoming shifts in return (a swap).
export async function claimCover(id: string, giveBack?: { work_date: string; team: string; shift: string } | null) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: row } = await supabase.from("cover_requests").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Not found." };
  if (row.status !== "open") return { ok: false, error: "This request is no longer open." };
  if (row.requester_id === user.id) return { ok: false, error: "That's your own request." };
  if (giveBack) {
    // Must be one of my own upcoming shifts (approval checks the roster again).
    const mine = await getMyUpcomingShifts();
    if (!mine.ok || !mine.shifts.some((s) => s.work_date === giveBack.work_date && s.team === giveBack.team && s.shift === giveBack.shift)) return { ok: false, error: "Choose one of your own upcoming shifts." };
  }
  const { error } = await supabase
    .from("cover_requests").update({ claimer_id: user.id, status: "claimed", return_work_date: giveBack?.work_date ?? null, return_team: giveBack?.team ?? null, return_shift: giveBack?.shift ?? null })
    .eq("id", id).eq("status", "open");
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function cancelCover(id: string) {
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase
    .from("cover_requests").update({ status: "cancelled" })
    .eq("id", id).eq("requester_id", user.id).in("status", ["open", "claimed"]);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── STAFF: my own requests + shifts I've offered to cover ──
export async function getMyCovers() {
  const { supabase, user, homeBranchId: branchId } = await getMe(); // personal action: home branch
  if (!user) return { ok: false, error: "Not logged in.", mine: [], claimed: [] };
  const { data: mine } = await supabase
    .from("cover_requests").select("*, claimer:claimer_id (full_name)")
    .eq("branch_id", branchId).eq("requester_id", user.id).order("created_at", { ascending: false });
  const { data: claimed } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name)")
    .eq("branch_id", branchId).eq("claimer_id", user.id).order("created_at", { ascending: false });
  return { ok: true, mine: mine || [], claimed: claimed || [] };
}

// ── MANAGER: active requests (open + claimed) to review ──
export async function getManagerCovers() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", covers: [] };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", covers: [] };
  const { data } = await supabase
    .from("cover_requests").select("*, requester:requester_id (full_name), claimer:claimer_id (full_name)")
    .eq("branch_id", branchId).in("status", ["open", "claimed"]).order("work_date");
  const covers = (data || []) as any[];
  const warnings = await coverWarnings(supabase, branchId!, covers.filter((c) => c.status === "claimed" && c.claimer_id)).catch(() => ({} as Record<string, CoverWarning[]>));
  return { ok: true, covers: covers.map((c) => ({ ...c, warnings: warnings[c.id] ?? [] })) };
}

// Rule checks shown before a manager approves: for whoever takes a shift — overlap, rest under 11 h,
// and the Minijob monthly cap (worked so far + rostered for the rest of the month).
export type CoverWarning = { who: string; kind: "overlap" | "rest" | "minijob"; restH?: number; earnings?: number; cap?: number };
async function coverWarnings(db: any, branchId: string, claimed: any[]): Promise<Record<string, CoverWarning[]>> {
  if (!claimed.length) return {};
  const today = berlinToday();
  const dates = claimed.flatMap((c) => [c.work_date, c.return_work_date].filter(Boolean)) as string[];
  const last = dates.reduce((m, d) => (d > m ? d : m), today);
  const monthEnd = addDays(`${addDays(`${last.slice(0, 7)}-28`, 4).slice(0, 7)}-01`, -1);
  const weeks: string[] = [];
  for (let w = mondayOfDate(addDays(dates.reduce((m, d) => (d < m ? d : m), today), -1)); w <= monthEnd; w = addDays(w, 7)) weeks.push(w);
  const people = [...new Set(claimed.flatMap((c) => [c.requester_id, c.claimer_id]))];
  const [rosters, times, users, wages, logs] = await Promise.all([
    db.from("weekly_roster").select("week_start, roster_data").eq("branch_id", branchId).in("week_start", weeks),
    getShiftTimes(),
    db.from("users").select("id, full_name, contract_type").in("id", people),
    wageMapForBranches(db, [branchId]).catch(() => null),
    db.from("attendance_logs").select("user_id, work_date, duration_mins, breaks, clock_in, clock_out, status").in("user_id", people).eq("status", "complete").gte("work_date", `${today.slice(0, 7)}-01`).lt("work_date", today),
  ]);
  const tmap = new Map((((times as any).items ?? []) as { team: string; shift: string; start: string; end: string; breakMins: number; friSatStart: string | null; friSatEnd: string | null }[]).map((t) => [`${t.team}|${t.shift}`, t]));
  type S = Slot & { user: string; team: string; shift: string; mins: number };
  const slots: S[] = [];
  for (const r of rosters.data || []) for (const [i, day] of DAYS.entries()) for (const e of (r.roster_data as any)?.[day] || []) {
    const date = addDays(r.week_start, i), tm = rosterEntryTimes(e, tmap as any, date); if (!e?.user_id || !tm) continue;
    const [a, b] = interval({ date, ...tm });
    slots.push({ user: e.user_id, team: e.team, shift: e.shift, date, ...tm, mins: (b - a) / 6e4 - (tmap.get(`${e.team}|${e.shift}`)?.breakMins ?? 0) });
  }
  const userOf = new Map<string, { full_name: string | null; contract_type: string | null }>((users.data || []).map((u: any) => [u.id, u]));
  const worked: Record<string, Record<string, number>> = {};
  for (const l of logs.data || []) { const k = String(l.work_date).slice(0, 7); (worked[l.user_id] ||= {})[k] = (worked[l.user_id][k] || 0) + shiftMinutes(l).paidMin; }
  const same = (s: S, d: string, team: string, shift: string) => s.date === d && s.team === team && s.shift === shift;

  const out: Record<string, CoverWarning[]> = {};
  for (const c of claimed) {
    // Moves this approval makes: requester's shift → claimer; for a swap also claimer's shift → requester.
    const moves = [{ to: c.claimer_id, from: c.requester_id, date: c.work_date, team: c.team, shift: c.shift }];
    if (c.return_work_date) moves.push({ to: c.requester_id, from: c.claimer_id, date: c.return_work_date, team: c.return_team, shift: c.return_shift });
    const list: CoverWarning[] = [];
    for (const m of moves) {
      const taken = slots.find((s) => s.user === m.from && same(s, m.date, m.team, m.shift)); if (!taken) continue;
      const given = moves.find((x) => x.from === m.to); // in a swap the person also gives one away
      const keep = slots.filter((s) => s.user === m.to && !(given && same(s, given.date, given.team, given.shift)));
      const who = userOf.get(m.to)?.full_name || "—", r = restIssues(taken, keep.filter((s) => Math.abs(Date.parse(s.date) - Date.parse(m.date)) <= 864e5));
      if (r.overlap) list.push({ who, kind: "overlap" }); else if (r.restH != null) list.push({ who, kind: "rest", restH: r.restH });
      const u = userOf.get(m.to);
      if (u && isMinijob(u.contract_type)) {
        const month = m.date.slice(0, 7), planned = [...keep, taken].filter((s) => s.date >= today && s.date.slice(0, 7) === month);
        const over = minijobOverCap([{ id: m.to, name: who, wage: wages?.[m.to] ?? null, workedMins: worked[m.to] ?? {} }], planned.map((s) => ({ date: s.date, user_id: m.to, mins: s.mins })));
        if (over.length) list.push({ who, kind: "minijob", earnings: over[0].earnings, cap: over[0].cap });
      }
    }
    out[c.id] = list;
  }
  return out;
}

// ── MANAGER: approve (reassigns the roster) or reject ──
export async function decideCover(id: string, decision: "approved" | "rejected") {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!["approved", "rejected"].includes(decision)) return { ok: false, error: "Invalid decision." };
  const { data: reassigned, error } = await supabase.rpc("decide_cover_atomic", { p_id: id, p_decision: decision });
  if (error) return { ok: false, error: error.message };
  return { ok: true, reassigned: Boolean(reassigned) };
}
