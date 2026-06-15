"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const TZ = "Europe/Berlin";

function zonedToUtcMs(dateStr: string, hhmm: string): number {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h || 0, mi || 0);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const p: Record<string, string> = {};
  for (const x of dtf.formatToParts(new Date(guess))) p[x.type] = x.value;
  const wall = Date.UTC(+p.year, +p.month - 1, +p.day, p.hour === "24" ? 0 : +p.hour, +p.minute);
  return guess - (wall - guess);
}
function mondayOfDate(dateStr: string): string {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D)); const js = d.getUTCDay();
  d.setUTCDate(d.getUTCDate() + (js === 0 ? -6 : 1 - js));
  return d.toISOString().slice(0, 10);
}
function dayNameOf(dateStr: string): string {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(Y, M - 1, D)).getUTCDay();
  return DAYS[(js + 6) % 7];
}
function parseModel(s: string) { const p = String(s).split(/[–—-]/).map((x) => x.trim()); return { start: p[0] || "", end: p[1] || "" }; }
const todayStr = () => new Date().toISOString().slice(0, 10);

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}

// Filter options for the dashboard controls.
export async function getOpsFilters() {
  const { supabase, user, role, branchId } = await getMe();
  if (!user || !MGR.includes(role || "")) return { ok: false, branches: [] as any[], teams: [] as string[], shifts: [] as string[] };
  const { data: branches } = await supabase.from("branches").select("id, name").order("name");
  const teams = Object.keys(SHIFT_MODEL);
  const shifts = [...new Set(Object.values(SHIFT_MODEL).flat().map((s) => s.shift))];
  return { ok: true, defaultBranch: branchId, branches: branches || [], teams, shifts };
}

export async function getOpsDashboard(opts: { date?: string; branchId?: string | null; team?: string | null; shift?: string | null } = {}) {
  const { supabase, user, role, branchId: myBranch } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only." };

  const date = opts.date || todayStr();
  const isToday = date === todayStr();
  const refMs = isToday ? Date.now() : zonedToUtcMs(date, "23:59") + 60000; // past day → treat as fully elapsed

  // branch: requested if accessible, else caller's
  let branch = myBranch;
  if (opts.branchId) {
    const { data: ok } = await supabase.from("branches").select("id").eq("id", opts.branchId).maybeSingle();
    if (ok?.id) branch = opts.branchId;
  }
  if (!branch) return { ok: false, error: "No branch assigned." };

  const team = opts.team || null;
  const shift = opts.shift || null;

  // resolve shift times for THIS branch (branch row > global > SHIFT_MODEL)
  const { data: stRows } = await supabase.from("shift_times").select("branch_id, team, shift, start_time, end_time").eq("is_active", true);
  const timeMap: Record<string, { start: string; end: string }> = {};
  for (const tm of Object.keys(SHIFT_MODEL)) for (const s of SHIFT_MODEL[tm]) { const d = parseModel(s.time); timeMap[`${tm}|${s.shift}`] = { start: d.start, end: d.end }; }
  for (const r of stRows || []) if (r.branch_id == null) timeMap[`${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  for (const r of stRows || []) if (r.branch_id === branch) timeMap[`${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };

  // roster for the date
  const { data: roster } = await supabase.from("weekly_roster").select("roster_data").eq("branch_id", branch).eq("week_start", mondayOfDate(date)).maybeSingle();
  let scheduled = ((roster?.roster_data as any)?.[dayNameOf(date)] || []) as any[];
  if (team) scheduled = scheduled.filter((e) => e.team === team);
  if (shift) scheduled = scheduled.filter((e) => e.shift === shift);

  // attendance for the date
  const { data: logs } = await supabase.from("attendance_logs")
    .select("id, user_id, clock_in, clock_out, duration_mins, status").eq("branch_id", branch).eq("work_date", date);
  const logByUser: Record<string, any> = {};
  for (const l of logs || []) if (!logByUser[l.user_id] || (l.clock_in && l.clock_in < logByUser[l.user_id].clock_in)) logByUser[l.user_id] = l;

  // names + teams
  const ids = [...new Set([...scheduled.map((e) => e.user_id), ...(logs || []).map((l) => l.user_id)])];
  const meta: Record<string, { name: string; team: string }> = {};
  if (ids.length) { const { data: us } = await supabase.from("users").select("id, full_name, team").in("id", ids); for (const u of us || []) meta[u.id] = { name: u.full_name, team: u.team || "" }; }

  type Row = { userId: string; name: string; team: string; shift: string; schedStart: number | null; schedEnd: number | null; clockIn: string | null; clockOut: string | null; status: string; lateMins: number };
  const rows: Row[] = [];
  const seen = new Set<string>();
  let workingNow = 0, late = 0, absent = 0, notIn = 0, completed = 0;
  let scheduledNow = 0, scheduledNowPresent = 0, laborMins = 0;

  for (const e of scheduled) {
    seen.add(e.user_id);
    const tm = timeMap[`${e.team}|${e.shift}`];
    const S = tm?.start ? zonedToUtcMs(date, tm.start) : null;
    let E = tm?.end ? zonedToUtcMs(date, tm.end) : null;
    if (S != null && E != null && E <= S) E += 24 * 3600 * 1000;
    const inWindowNow = S != null && E != null && refMs >= S && refMs <= E;
    if (inWindowNow) scheduledNow++;

    const log = logByUser[e.user_id];
    let status = "not_checked_in", lateMins = 0;
    if (log && log.clock_in) {
      const inMs = new Date(log.clock_in).getTime();
      if (S != null && inMs > S) lateMins = Math.round((inMs - S) / 60000);
      if (log.status === "active" || log.status === "on-break") { status = "working"; workingNow++; if (inWindowNow) scheduledNowPresent++; laborMins += Math.max(0, Math.round((refMs - inMs) / 60000)); }
      else if (log.status === "complete") { status = "completed"; completed++; laborMins += log.duration_mins || 0; }
      if (lateMins > 0) late++;
    } else {
      if (E != null && refMs >= E) { status = "absent"; absent++; } else { status = "not_checked_in"; notIn++; }
    }
    rows.push({ userId: e.user_id, name: e.name || meta[e.user_id]?.name || "—", team: e.team, shift: e.shift, schedStart: S, schedEnd: E, clockIn: log?.clock_in || null, clockOut: log?.clock_out || null, status, lateMins });
  }

  // present but NOT on the roster (unscheduled) — respect the team filter
  for (const l of logs || []) {
    if (seen.has(l.user_id) || !l.clock_in) continue;
    const uteam = meta[l.user_id]?.team || "";
    if (team && uteam !== team) continue;
    if (shift) continue; // unscheduled has no shift to match
    const inMs = new Date(l.clock_in).getTime();
    if (l.status === "active" || l.status === "on-break") { workingNow++; laborMins += Math.max(0, Math.round((refMs - inMs) / 60000)); }
    else if (l.status === "complete") { completed++; laborMins += l.duration_mins || 0; }
    rows.push({ userId: l.user_id, name: meta[l.user_id]?.name || "—", team: uteam, shift: "", schedStart: null, schedEnd: null, clockIn: l.clock_in, clockOut: l.clock_out, status: "unscheduled", lateMins: 0 });
  }

  const order: Record<string, number> = { absent: 0, working: 1, not_checked_in: 2, unscheduled: 3, completed: 4 };
  rows.sort((a, b) => (order[a.status] - order[b.status]) || a.name.localeCompare(b.name));

  const utilization = scheduledNow > 0 ? Math.round((scheduledNowPresent / scheduledNow) * 100) : (workingNow > 0 ? 100 : 0);

  return {
    ok: true, date, isToday, branchId: branch, asOf: new Date(refMs).toISOString(),
    metrics: { workingNow, late, absent, notCheckedIn: notIn, completed, scheduledTotal: scheduled.length, scheduledNow, laborMins, utilization },
    rows,
  };
}