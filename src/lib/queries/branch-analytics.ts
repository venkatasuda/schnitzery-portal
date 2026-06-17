"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";

// ============================================================================
// BRANCH PERFORMANCE ANALYTICS — aggregate KPIs over a daily / weekly / monthly
// window. Managers see their own branch; brand_owner / super_admin can pick a
// branch or aggregate "all". Cross-references roster (scheduled), shift_times
// (expected start/end), attendance_logs (actual), wages, and daily_sales.
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const OWNER = ["brand_owner", "super_admin"];          // may pick a branch or "all"
const TZ = "Europe/Berlin";
const GRACE_LATE = 5;        // minutes after scheduled start before counted "late"
const COMPLY_LATE = 10;      // late tolerance for a shift to count "compliant"
const COMPLY_COVER = 0.85;   // must work ≥85% of the scheduled window

function zonedToUtcMs(dateStr: string, hhmm: string): number {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mi] = (hhmm || "00:00").split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h || 0, mi || 0);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p: Record<string, string> = {};
  for (const x of dtf.formatToParts(new Date(guess))) p[x.type] = x.value;
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === "24" ? 0 : +p.hour, +p.minute);
  return guess - (wall - guess);
}
function mondayOfDate(s: string): string {
  const [Y, M, D] = s.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D)); const js = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (js === 0 ? -6 : 1 - js));
  return d.toISOString().slice(0, 10);
}
function dayNameOf(s: string): string {
  const [Y, M, D] = s.split("-").map(Number);
  const js = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  return DAYS[(js + 6) % 7];
}
function parseModel(s: string) { const p = String(s).split(/[–—-]/).map((x) => x.trim()); return { start: p[0] || "", end: p[1] || "" }; }
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const todayStr = () => berlinToday();

function windowFor(period: string, date: string) {
  const [Y, M] = date.split("-").map(Number);
  if (period === "weekly") {
    const mon = mondayOfDate(date); const s = new Date(mon + "T00:00:00Z"); s.setUTCDate(s.getUTCDate() + 6);
    return { from: mon, to: ymd(s) };
  }
  if (period === "monthly") return { from: `${date.slice(0, 7)}-01`, to: ymd(new Date(Date.UTC(Y, M, 0))) };
  return { from: date, to: date }; // daily
}
function daysBetween(from: string, to: string) {
  const out: string[] = []; const d = new Date(from + "T00:00:00Z"); const end = new Date(to + "T00:00:00Z");
  while (d <= end) { out.push(ymd(d)); d.setUTCDate(d.getUTCDate() + 1); }
  return out;
}
function breakMins(breaks: any): number {
  if (!Array.isArray(breaks)) return 0;
  let m = 0;
  for (const b of breaks) if (b?.start && b?.end) { const s = new Date(b.start), e = new Date(b.end); if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e > s) m += Math.round((e.getTime() - s.getTime()) / 60000); }
  return m;
}
const h1 = (min: number) => Math.round(min / 6) / 10;

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null as string | null, branchId: null as string | null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}

export async function getAnalyticsScope() {
  const { user, role, branchId } = await getMe();
  if (!user || !MGR.includes(role ?? "")) return { ok: false as const, canPickBranch: false, branches: [] as any[] };
  const supabase = (await createClient());
  const isOwner = OWNER.includes(role ?? "");
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");
  return { ok: true as const, canPickBranch: isOwner, defaultBranch: branchId, branches: isOwner ? (branches || []) : (branches || []).filter((b) => b.id === branchId) };
}

export async function getBranchAnalytics(opts: { period?: "daily" | "weekly" | "monthly"; date?: string; branchId?: string | null } = {}) {
  const period = opts.period || "weekly";
  const date = opts.date || todayStr();
  const { supabase, user, role, branchId: myBranch } = await getMe();
  const blank = { ok: false as const, period, ...windowFor(period, date), scope: "", metrics: emptyMetrics(), trend: [] as any[], teams: [] as any[] };
  if (!user) return { ...blank, error: "Not logged in." };
  if (!MGR.includes(role ?? "")) return { ...blank, error: "Managers only." };

  const isOwner = OWNER.includes(role ?? "");
  const { data: accBranches } = await supabase.from("branches").select("id, name");
  const accMap: Record<string, string> = {}; (accBranches || []).forEach((b) => { accMap[b.id] = b.name; });

  let targets: string[]; let scope: string;
  if (isOwner && (!opts.branchId || opts.branchId === "all")) { targets = (accBranches || []).map((b) => b.id); scope = "All branches"; }
  else if (isOwner && opts.branchId && accMap[opts.branchId]) { targets = [opts.branchId]; scope = accMap[opts.branchId]; }
  else { targets = myBranch ? [myBranch] : []; scope = myBranch ? (accMap[myBranch] || "") : ""; }
  if (!targets.length) return { ...blank, error: "No branch." };

  const { from, to } = windowFor(period, date);
  const days = daysBetween(from, to);
  const weeks = [...new Set(days.map(mondayOfDate))];

  // shift-time resolution (model < global < per-branch)
  const { data: stRows } = await supabase.from("shift_times").select("branch_id, team, shift, start_time, end_time").eq("is_active", true);
  const tm: Record<string, { start: string; end: string }> = {};
  for (const t of Object.keys(SHIFT_MODEL)) for (const s of (SHIFT_MODEL as any)[t]) { const d = parseModel(s.time); tm[`g|${t}|${s.shift}`] = { start: d.start, end: d.end }; }
  for (const r of stRows || []) if (r.branch_id == null) tm[`g|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  for (const r of stRows || []) if (r.branch_id) tm[`${r.branch_id}|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  const resolveTimes = (br: string, team: string, shift: string) => tm[`${br}|${team}|${shift}`] || tm[`g|${team}|${shift}`] || null;

  // data loads (scoped to target branches + window)
  const { data: rosters } = await supabase.from("weekly_roster").select("branch_id, week_start, roster_data").in("branch_id", targets).in("week_start", weeks);
  const { data: logs } = await supabase.from("attendance_logs").select("user_id, branch_id, work_date, clock_in, clock_out, duration_mins, breaks, status").in("branch_id", targets).gte("work_date", from).lte("work_date", to);
  const { data: users } = await supabase.from("users").select("id, hourly_wage, team").in("branch_id", targets);
  const { data: sales } = await supabase.from("daily_sales").select("amount").in("branch_id", targets).gte("sale_date", from).lte("sale_date", to);
  const { data: psettings } = await supabase.from("payroll_settings").select("branch_id, ot_daily_hours").in("branch_id", targets);

  const wage: Record<string, number | null> = {}; const uteam: Record<string, string> = {};
  (users || []).forEach((u) => { wage[u.id] = u.hourly_wage ?? null; uteam[u.id] = u.team || ""; });
  const otThresh: Record<string, number> = {}; targets.forEach((b) => { otThresh[b] = 8 * 60; });
  (psettings || []).forEach((p) => { otThresh[p.branch_id] = Number(p.ot_daily_hours ?? 8) * 60; });

  // roster index: branch|date -> entries[]
  const sched: Record<string, any[]> = {};
  for (const r of rosters || []) {
    const rd = (r.roster_data as any) || {};
    for (const d of days) {
      if (mondayOfDate(d) !== r.week_start) continue;
      const list = rd[dayNameOf(d)] || [];
      if (list.length) sched[`${r.branch_id}|${d}`] = (sched[`${r.branch_id}|${d}`] || []).concat(list);
    }
  }
  // attendance index: branch|date|user -> log
  const logIx: Record<string, any> = {};
  for (const l of logs || []) logIx[`${l.branch_id}|${l.work_date}|${l.user_id}`] = l;

  // ── scheduled-side metrics + per-day trend ──
  let scheduled = 0, attended = 0, late = 0, absent = 0, compliant = 0, scheduledMins = 0;
  const perDay: Record<string, { sched: number; att: number; labor: number }> = {};
  for (const d of days) perDay[d] = { sched: 0, att: 0, labor: 0 };

  for (const br of targets) for (const d of days) {
    const entries = sched[`${br}|${d}`] || [];
    for (const e of entries) {
      scheduled++; perDay[d].sched++;
      const times = resolveTimes(br, e.team, e.shift);
      let winMin = 0, startMs: number | null = null, endMs: number | null = null;
      if (times) {
        startMs = zonedToUtcMs(d, times.start); endMs = zonedToUtcMs(d, times.end);
        if (endMs <= startMs) endMs += 24 * 3600000;
        winMin = Math.round((endMs - startMs) / 60000);
      }
      scheduledMins += winMin;
      const log = logIx[`${br}|${d}|${e.user_id}`];
      if (log && log.clock_in) {
        attended++; perDay[d].att++;
        const inMs = new Date(log.clock_in).getTime();
        const lateMins = startMs != null ? Math.max(0, Math.round((inMs - startMs) / 60000)) : 0;
        if (lateMins > GRACE_LATE) late++;
        const worked = log.duration_mins || 0;
        const cover = winMin > 0 ? worked / winMin : 1;
        if (lateMins <= COMPLY_LATE && (log.status !== "complete" || cover >= COMPLY_COVER)) compliant++;
      } else {
        absent++;
      }
    }
  }

  // ── labor-side metrics (all worked time, incl. unscheduled) ──
  const perDayPaid: Record<string, number> = {};   // key user|date|branch
  let laborMins = 0, laborCost = 0;
  const teamMins: Record<string, number> = {};
  for (const l of logs || []) {
    const gross = l.duration_mins || 0; if (gross <= 0) continue;
    const paid = Math.max(0, gross - breakMins(l.breaks));
    laborMins += paid;
    perDay[l.work_date] && (perDay[l.work_date].labor += paid);
    perDayPaid[`${l.user_id}|${l.work_date}|${l.branch_id}`] = (perDayPaid[`${l.user_id}|${l.work_date}|${l.branch_id}`] || 0) + paid;
    const w = wage[l.user_id]; if (w != null) laborCost += (paid / 60) * w;
    const tk = uteam[l.user_id] || "—"; teamMins[tk] = (teamMins[tk] || 0) + paid;
  }
  let overtimeMins = 0;
  for (const k in perDayPaid) { const br = k.split("|")[2]; overtimeMins += Math.max(0, perDayPaid[k] - (otThresh[br] || 480)); }

  const totalSales = (sales || []).reduce((s, r) => s + Number(r.amount || 0), 0);
  const laborHours = h1(laborMins);
  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);

  const metrics = {
    attendancePct: pct(attended, scheduled),
    absencePct: pct(absent, scheduled),
    latePct: pct(late, scheduled),
    overtimePct: pct(overtimeMins, laborMins),
    laborHours,
    laborCost: Math.round(laborCost * 100) / 100,
    shiftCompliancePct: pct(compliant, scheduled),
    utilizationPct: scheduledMins > 0 ? pct(laborMins, scheduledMins) : (laborMins > 0 ? 100 : 0),
    salesPerLaborHour: laborHours > 0 && totalSales > 0 ? Math.round((totalSales / laborHours) * 100) / 100 : null,
    laborCostPct: totalSales > 0 ? Math.round((laborCost / totalSales) * 1000) / 10 : null,
    scheduled, attended, totalSales: Math.round(totalSales * 100) / 100,
  };

  const trend = days.map((d) => ({ day: d.slice(5), labor: h1(perDay[d].labor), attendance: pct(perDay[d].att, perDay[d].sched) }));
  const teams = Object.entries(teamMins).map(([team, m]) => ({ team, hours: h1(m) })).sort((a, b) => b.hours - a.hours);

  return { ok: true as const, period, from, to, scope, branchCount: targets.length, metrics, trend, teams };
}

function emptyMetrics() {
  return { attendancePct: 0, absencePct: 0, latePct: 0, overtimePct: 0, laborHours: 0, laborCost: 0, shiftCompliancePct: 0, utilizationPct: 0, salesPerLaborHour: null as number | null, laborCostPct: null as number | null, scheduled: 0, attended: 0, totalSales: 0 };
}

// ── Executive overtime trend: overtime % per month over the last N months ────
export async function getOvertimeTrend(opts: { branchId?: string | null; months?: number } = {}) {
  const months = Math.max(3, Math.min(opts.months ?? 6, 12));
  const { supabase, user, role, branchId: myBranch } = await getMe();
  if (!user) return { ok: false as const, error: "Not logged in.", trend: [] as any[] };
  if (!MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only.", trend: [] as any[] };

  const isOwner = OWNER.includes(role ?? "");
  const { data: accBranches } = await supabase.from("branches").select("id, name");
  const accMap: Record<string, string> = {}; (accBranches || []).forEach((b) => { accMap[b.id] = b.name; });
  let targets: string[];
  if (isOwner && (!opts.branchId || opts.branchId === "all")) targets = (accBranches || []).map((b) => b.id);
  else if (isOwner && opts.branchId && accMap[opts.branchId]) targets = [opts.branchId];
  else targets = myBranch ? [myBranch] : [];
  if (!targets.length) return { ok: false as const, error: "No branch.", trend: [] };

  const now = new Date();
  const startMonth = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);
  const from = startMonth.toISOString().slice(0, 10);
  const to = now.toISOString().slice(0, 10);
  const monthsList: string[] = [];
  for (let i = 0; i < months; i++) { const d = new Date(startMonth.getFullYear(), startMonth.getMonth() + i, 1); monthsList.push(d.toISOString().slice(0, 7)); }

  const [{ data: psettings }, { data: logs }] = await Promise.all([
    supabase.from("payroll_settings").select("branch_id, ot_daily_hours").in("branch_id", targets),
    supabase.from("attendance_logs").select("user_id, branch_id, work_date, duration_mins, breaks").in("branch_id", targets).gte("work_date", from).lte("work_date", to),
  ]);
  const otThresh: Record<string, number> = {}; targets.forEach((b) => { otThresh[b] = 8 * 60; });
  (psettings || []).forEach((p) => { otThresh[p.branch_id] = Number(p.ot_daily_hours ?? 8) * 60; });

  const paidByMonth: Record<string, number> = {};
  const perDay: Record<string, number> = {};
  for (const l of logs || []) {
    const gross = l.duration_mins || 0; if (gross <= 0) continue;
    const paid = Math.max(0, gross - breakMins(l.breaks));
    const mon = String(l.work_date).slice(0, 7);
    paidByMonth[mon] = (paidByMonth[mon] || 0) + paid;
    perDay[`${l.user_id}|${l.work_date}|${l.branch_id}`] = (perDay[`${l.user_id}|${l.work_date}|${l.branch_id}`] || 0) + paid;
  }
  const otByMonth: Record<string, number> = {};
  for (const k in perDay) { const parts = k.split("|"); const mon = parts[1].slice(0, 7); const br = parts[2]; const ot = Math.max(0, perDay[k] - (otThresh[br] || 480)); if (ot > 0) otByMonth[mon] = (otByMonth[mon] || 0) + ot; }

  const trend = monthsList.map((mon) => {
    const paid = paidByMonth[mon] || 0; const ot = otByMonth[mon] || 0;
    return { month: mon.slice(2), overtimePct: paid > 0 ? Math.round((ot / paid) * 1000) / 10 : 0, hours: h1(paid), otHours: h1(ot) };
  });
  return { ok: true as const, trend, scope: isOwner && targets.length > 1 ? "All branches" : (accMap[targets[0]] || "") };
}
// ── Per-employee performance: attendance %, late count, absences, avg/total hours ──
// Reuses the same roster + log matching as getBranchAnalytics, bucketed per employee.
export async function getStaffPerformance(opts: { period?: "daily" | "weekly" | "monthly"; date?: string; branchId?: string | null } = {}) {
  const period = opts.period || "weekly";
  const date = opts.date || todayStr();
  const { supabase, user, role, branchId: myBranch } = await getMe();
  const blank = { ok: false as const, period, ...windowFor(period, date), scope: "", rows: [] as any[] };
  if (!user) return { ...blank, error: "Not logged in." };
  if (!MGR.includes(role ?? "")) return { ...blank, error: "Managers only." };

  const isOwner = OWNER.includes(role ?? "");
  const { data: accBranches } = await supabase.from("branches").select("id, name");
  const accMap: Record<string, string> = {}; (accBranches || []).forEach((b) => { accMap[b.id] = b.name; });

  let targets: string[]; let scope: string;
  if (isOwner && (!opts.branchId || opts.branchId === "all")) { targets = (accBranches || []).map((b) => b.id); scope = "All branches"; }
  else if (isOwner && opts.branchId && accMap[opts.branchId]) { targets = [opts.branchId]; scope = accMap[opts.branchId]; }
  else { targets = myBranch ? [myBranch] : []; scope = myBranch ? (accMap[myBranch] || "") : ""; }
  if (!targets.length) return { ...blank, error: "No branch." };

  const { from, to } = windowFor(period, date);
  const days = daysBetween(from, to);
  const weeks = [...new Set(days.map(mondayOfDate))];

  // shift-time resolution (model < global < per-branch)
  const { data: stRows } = await supabase.from("shift_times").select("branch_id, team, shift, start_time, end_time").eq("is_active", true);
  const tm: Record<string, { start: string; end: string }> = {};
  for (const t of Object.keys(SHIFT_MODEL)) for (const s of (SHIFT_MODEL as any)[t]) { const d = parseModel(s.time); tm[`g|${t}|${s.shift}`] = { start: d.start, end: d.end }; }
  for (const r of stRows || []) if (r.branch_id == null) tm[`g|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  for (const r of stRows || []) if (r.branch_id) tm[`${r.branch_id}|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  const resolveTimes = (br: string, team: string, shift: string) => tm[`${br}|${team}|${shift}`] || tm[`g|${team}|${shift}`] || null;

  const { data: rosters } = await supabase.from("weekly_roster").select("branch_id, week_start, roster_data").in("branch_id", targets).in("week_start", weeks);
  const { data: logs } = await supabase.from("attendance_logs").select("user_id, branch_id, work_date, clock_in, duration_mins, breaks").in("branch_id", targets).gte("work_date", from).lte("work_date", to);
  const { data: users } = await supabase.from("users").select("id, full_name, team, status, hourly_wage").in("branch_id", targets);
  const { data: psettings } = await supabase.from("payroll_settings").select("branch_id, ot_daily_hours").in("branch_id", targets);
  const otThresh: Record<string, number> = {}; targets.forEach((b) => { otThresh[b] = 8 * 60; });
  (psettings || []).forEach((p) => { otThresh[p.branch_id] = Number(p.ot_daily_hours ?? 8) * 60; });
  const wage: Record<string, number | null> = {}; (users || []).forEach((u) => { wage[u.id] = u.hourly_wage ?? null; });

  type S = { name: string; team: string; scheduled: number; attended: number; late: number; absent: number; workedMins: number; shifts: number; cost: number };
  const stat: Record<string, S> = {};
  (users || []).forEach((u) => { if (u.status === "inactive") return; stat[u.id] = { name: u.full_name || "—", team: u.team || "—", scheduled: 0, attended: 0, late: 0, absent: 0, workedMins: 0, shifts: 0, cost: 0 }; });
  const perDayPaid: Record<string, number> = {};  // user|date|branch -> paid mins (for overtime)

  // roster index: branch|date -> entries[]
  const sched: Record<string, any[]> = {};
  for (const r of rosters || []) {
    const rd = (r.roster_data as any) || {};
    for (const d of days) {
      if (mondayOfDate(d) !== r.week_start) continue;
      const list = rd[dayNameOf(d)] || [];
      if (list.length) sched[`${r.branch_id}|${d}`] = (sched[`${r.branch_id}|${d}`] || []).concat(list);
    }
  }
  const logIx: Record<string, any> = {};
  for (const l of logs || []) logIx[`${l.branch_id}|${l.work_date}|${l.user_id}`] = l;

  // scheduled-side: attendance / lateness / absences per employee
  for (const br of targets) for (const d of days) {
    for (const e of sched[`${br}|${d}`] || []) {
      const s = stat[e.user_id]; if (!s) continue;
      s.scheduled++;
      const times = resolveTimes(br, e.team, e.shift);
      const startMs = times ? zonedToUtcMs(d, times.start) : null;
      const log = logIx[`${br}|${d}|${e.user_id}`];
      if (log && log.clock_in) {
        s.attended++;
        const lateMins = startMs != null ? Math.max(0, Math.round((new Date(log.clock_in).getTime() - startMs) / 60000)) : 0;
        if (lateMins > GRACE_LATE) s.late++;
      } else {
        s.absent++;
      }
    }
  }
  // worked-time side: total + avg shift hours (all worked time, incl. unscheduled)
  for (const l of logs || []) {
    const s = stat[l.user_id]; if (!s) continue;
    const gross = l.duration_mins || 0; if (gross <= 0) continue;
    const paid = Math.max(0, gross - breakMins(l.breaks));
    s.workedMins += paid; s.shifts++;
    const w = wage[l.user_id]; if (w != null) s.cost += (paid / 60) * w;
    perDayPaid[`${l.user_id}|${l.work_date}|${l.branch_id}`] = (perDayPaid[`${l.user_id}|${l.work_date}|${l.branch_id}`] || 0) + paid;
  }
  // per-employee overtime: sum of each day's paid minutes over the branch's daily OT threshold
  const otMins: Record<string, number> = {};
  for (const k in perDayPaid) { const [uid, , br] = k.split("|"); otMins[uid] = (otMins[uid] || 0) + Math.max(0, perDayPaid[k] - (otThresh[br] || 480)); }

  // shift swaps requested in the window (count, scoped to target branches)
  const toNext = new Date(to + "T00:00:00Z"); toNext.setUTCDate(toNext.getUTCDate() + 1);
  const { count: swapCount } = await supabase.from("swap_requests").select("*", { count: "exact", head: true })
    .in("branch_id", targets).gte("created_at", from).lt("created_at", toNext.toISOString().slice(0, 10));

  const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 1000) / 10 : 0);
  const rows = Object.entries(stat)
    .filter(([, s]) => s.scheduled > 0 || s.workedMins > 0)
    .map(([id, s]) => ({
      id, name: s.name, team: s.team,
      attendancePct: s.scheduled > 0 ? pct(s.attended, s.scheduled) : null,
      late: s.late, absent: s.absent,
      avgShiftHours: s.shifts > 0 ? Math.round((s.workedMins / s.shifts / 60) * 10) / 10 : 0,
      totalHours: Math.round((s.workedMins / 60) * 10) / 10,
      cost: Math.round(s.cost * 100) / 100,
      otHours: Math.round(((otMins[id] || 0) / 60) * 10) / 10,
      scheduled: s.scheduled,
    }))
    // lowest attendance first surfaces who needs attention; null (no scheduled shifts) sinks to the bottom
    .sort((a, b) => {
      const av = a.attendancePct == null ? 1000 : a.attendancePct;
      const bv = b.attendancePct == null ? 1000 : b.attendancePct;
      return av !== bv ? av - bv : b.totalHours - a.totalHours;
    });

  return { ok: true as const, period, from, to, scope, rows, swapCount: swapCount || 0 };
}

// ── Branch comparison (owners): attendance %, labor hours & cost per branch over a period ──
// Bulk queries across all branches (no per-branch loop of getBranchAnalytics).
export async function getBranchComparison(opts: { period?: "weekly" | "monthly"; date?: string } = {}) {
  const period = opts.period || "weekly";
  const date = opts.date || todayStr();
  const { supabase, user, role } = await getMe();
  const blank = { ok: false as const, period, ...windowFor(period, date), rows: [] as any[] };
  if (!user) return { ...blank, error: "Not logged in." };
  if (!OWNER.includes(role ?? "")) return { ...blank, error: "Owners only." };

  const { data: branches } = await supabase.from("branches").select("id, name").order("name");
  const targets = (branches || []).map((b) => b.id);
  if (!targets.length) return { ...blank, error: "No branches." };

  const { from, to } = windowFor(period, date);
  const days = daysBetween(from, to);
  const weeks = [...new Set(days.map(mondayOfDate))];

  const [{ data: rosters }, { data: logs }, { data: users }] = await Promise.all([
    supabase.from("weekly_roster").select("branch_id, week_start, roster_data").in("branch_id", targets).in("week_start", weeks),
    supabase.from("attendance_logs").select("user_id, branch_id, work_date, clock_in, duration_mins, breaks").in("branch_id", targets).gte("work_date", from).lte("work_date", to),
    supabase.from("users").select("id, branch_id, hourly_wage").in("branch_id", targets),
  ]);
  const wage: Record<string, number | null> = {}; (users || []).forEach((u) => { wage[u.id] = u.hourly_wage ?? null; });

  // roster index: branch|date -> entries[]
  const sched: Record<string, any[]> = {};
  for (const r of rosters || []) {
    const rd = (r.roster_data as any) || {};
    for (const d of days) { if (mondayOfDate(d) !== r.week_start) continue; const list = rd[dayNameOf(d)] || []; if (list.length) sched[`${r.branch_id}|${d}`] = (sched[`${r.branch_id}|${d}`] || []).concat(list); }
  }
  const logIx: Record<string, any> = {};
  for (const l of logs || []) logIx[`${l.branch_id}|${l.work_date}|${l.user_id}`] = l;

  type B = { id: string; name: string; scheduled: number; attended: number; laborMins: number; laborCost: number };
  const map: Record<string, B> = {};
  for (const b of branches || []) map[b.id] = { id: b.id, name: b.name, scheduled: 0, attended: 0, laborMins: 0, laborCost: 0 };

  for (const br of targets) for (const d of days) {
    for (const e of sched[`${br}|${d}`] || []) {
      const b = map[br]; if (!b) continue;
      b.scheduled++;
      const log = logIx[`${br}|${d}|${e.user_id}`];
      if (log && log.clock_in) b.attended++;
    }
  }
  for (const l of logs || []) {
    const b = map[l.branch_id]; if (!b) continue;
    const gross = l.duration_mins || 0; if (gross <= 0) continue;
    const paid = Math.max(0, gross - breakMins(l.breaks));
    b.laborMins += paid;
    const w = wage[l.user_id]; if (w != null) b.laborCost += (paid / 60) * w;
  }

  const rows = Object.values(map).map((b) => ({
    id: b.id, name: b.name,
    attendancePct: b.scheduled > 0 ? Math.round((b.attended / b.scheduled) * 1000) / 10 : null,
    laborHours: h1(b.laborMins),
    laborCost: Math.round(b.laborCost),
    scheduled: b.scheduled, attended: b.attended,
  })).sort((a, b) => (b.attendancePct == null ? -1 : b.attendancePct) - (a.attendancePct == null ? -1 : a.attendancePct));

  return { ok: true as const, period, from, to, rows };
}