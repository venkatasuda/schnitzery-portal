"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS } from "@/lib/queries/schedule-constants";
import { getShiftTimes } from "@/lib/queries/shift-times";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const TZ = "Europe/Berlin"; // Stuttgart wall-clock for shift times

// Convert a wall-clock time on a given date in `tz` to the correct UTC instant
// (DST-safe), so it can be compared against UTC attendance timestamps.
function zonedToUtc(dateStr: string, hhmm: string, tz = TZ): Date {
  const [Y, Mo, D] = dateStr.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  const guess = Date.UTC(Y, Mo - 1, D, h || 0, mi || 0);
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: tz, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const parts: Record<string, string> = {};
  for (const p of dtf.formatToParts(new Date(guess))) parts[p.type] = p.value;
  const wall = Date.UTC(+parts.year, +parts.month - 1, +parts.day, parts.hour === "24" ? 0 : +parts.hour, +parts.minute);
  return new Date(guess - (wall - guess));
}

function dateOfDay(weekStart: string, dayName: string): string {
  const idx = DAYS.indexOf(dayName);
  const [Y, M, D] = weekStart.split("-").map(Number);
  const d = new Date(Date.UTC(Y, M - 1, D));
  d.setUTCDate(d.getUTCDate() + (idx < 0 ? 0 : idx));
  return d.toISOString().slice(0, 10);
}
function dayNameOf(dateStr: string): string {
  const [Y, M, D] = dateStr.split("-").map(Number);
  const js = new Date(Date.UTC(Y, M - 1, D)).getUTCDay(); // 0=Sun
  return DAYS[(js + 6) % 7];
}
const mins = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 60000);

export type CompareRow = {
  date: string; day: string; userId: string; name: string; team: string; shift: string;
  schedStart: string | null; schedEnd: string | null; schedMins: number;
  actIn: string | null; actOut: string | null;
  lateMins: number; earlyMins: number; otMins: number; missingMins: number; pct: number;
  status: "ontime" | "late" | "left_early" | "no_show" | "unscheduled" | "active";
};

export async function getScheduleComparison(weekStart: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not logged in." };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  if (!MGR.includes(p?.role || "")) return { ok: false, error: "Managers only." };
  const branchId = p?.branch_id;
  if (!branchId) return { ok: false, error: "No branch assigned." };

  // 1) roster for the week
  const { data: roster } = await supabase
    .from("weekly_roster").select("roster_data")
    .eq("branch_id", branchId).eq("week_start", weekStart).maybeSingle();
  const rd = (roster?.roster_data as any) || {};

  // 2) resolved shift times
  const st = await getShiftTimes();
  const timeMap: Record<string, { start: string; end: string; breakMins: number }> = {};
  for (const s of (st.ok ? st.items : [])) timeMap[`${s.team}|${s.shift}`] = { start: s.start, end: s.end, breakMins: s.breakMins };

  // 3) attendance for the week's date span
  const from = dateOfDay(weekStart, DAYS[0]);
  const to = dateOfDay(weekStart, DAYS[6]);
  const { data: logs } = await supabase
    .from("attendance_logs").select("id, user_id, work_date, clock_in, clock_out, duration_mins, status")
    .eq("branch_id", branchId).gte("work_date", from).lte("work_date", to);

  // 4) names for the branch
  const { data: us } = await supabase.from("users").select("id, full_name").eq("branch_id", branchId);
  const nameOf: Record<string, string> = {};
  for (const u of us || []) nameOf[u.id] = u.full_name;

  // index a single log per (user, date) — prefer the earliest clock-in
  const logBy: Record<string, any> = {};
  for (const l of logs || []) {
    if (!l.clock_in) continue;
    const k = `${l.user_id}|${l.work_date}`;
    if (!logBy[k] || l.clock_in < logBy[k].clock_in) logBy[k] = l;
  }
  const used = new Set<string>();
  const rows: CompareRow[] = [];

  for (const day of DAYS) {
    const date = dateOfDay(weekStart, day);
    for (const e of (rd[day] || [])) {
      const tm = timeMap[`${e.team}|${e.shift}`];
      if (!tm || !tm.start || !tm.end) continue;
      const S = zonedToUtc(date, tm.start);
      let E = zonedToUtc(date, tm.end);
      if (E.getTime() <= S.getTime()) E = new Date(E.getTime() + 24 * 3600 * 1000); // overnight
      const schedMins = Math.max(0, mins(S, E));

      const k = `${e.user_id}|${date}`;
      used.add(k);
      const log = logBy[k];

      if (!log) {
        rows.push({ date, day, userId: e.user_id, name: e.name || nameOf[e.user_id] || "—", team: e.team, shift: e.shift, schedStart: S.toISOString(), schedEnd: E.toISOString(), schedMins, actIn: null, actOut: null, lateMins: 0, earlyMins: 0, otMins: 0, missingMins: schedMins, pct: 0, status: "no_show" });
        continue;
      }
      const A = new Date(log.clock_in);
      const O = log.clock_out ? new Date(log.clock_out) : null;
      const endRef = O || new Date();
      const coverStart = Math.max(S.getTime(), A.getTime());
      const coverEnd = Math.min(E.getTime(), endRef.getTime());
      const covered = Math.max(0, Math.round((coverEnd - coverStart) / 60000));
      const late = Math.max(0, mins(S, A));
      const early = O ? Math.max(0, mins(O, E)) : 0;
      const ot = O ? Math.max(0, mins(E, O)) : 0;
      const missing = Math.max(0, schedMins - covered);
      const pct = schedMins > 0 ? Math.min(100, Math.round((covered / schedMins) * 100)) : 100;
      const status: CompareRow["status"] = !O ? "active" : late > 0 ? "late" : early > 0 ? "left_early" : "ontime";

      rows.push({ date, day, userId: e.user_id, name: e.name || nameOf[e.user_id] || "—", team: e.team, shift: e.shift, schedStart: S.toISOString(), schedEnd: E.toISOString(), schedMins, actIn: A.toISOString(), actOut: O ? O.toISOString() : null, lateMins: late, earlyMins: early, otMins: ot, missingMins: missing, pct, status });
    }
  }

  // 5) worked-but-not-rostered → "unscheduled"
  for (const l of logs || []) {
    if (!l.clock_in) continue;
    const k = `${l.user_id}|${l.work_date}`;
    if (used.has(k)) continue;
    used.add(k);
    rows.push({ date: l.work_date, day: dayNameOf(l.work_date), userId: l.user_id, name: nameOf[l.user_id] || "—", team: "", shift: "", schedStart: null, schedEnd: null, schedMins: 0, actIn: l.clock_in, actOut: l.clock_out, lateMins: 0, earlyMins: 0, otMins: l.duration_mins || 0, missingMins: 0, pct: 100, status: "unscheduled" });
  }

  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.name.localeCompare(b.name)));

  // 6) rollups (unscheduled rows excluded from scheduled stats)
  const empMap: Record<string, any> = {};
  const sum = { shifts: 0, noShows: 0, unscheduled: 0, schedMins: 0, coveredMins: 0, lateMins: 0, earlyMins: 0, otMins: 0, missingMins: 0, pct: 0 };
  for (const r of rows) {
    if (r.status === "unscheduled") { sum.unscheduled++; continue; }
    const e = (empMap[r.userId] ||= { userId: r.userId, name: r.name, team: r.team, shifts: 0, noShows: 0, schedMins: 0, coveredMins: 0, lateMins: 0, earlyMins: 0, otMins: 0, missingMins: 0, pct: 0 });
    const covered = r.schedMins - r.missingMins;
    e.shifts++; sum.shifts++;
    if (r.status === "no_show") { e.noShows++; sum.noShows++; }
    e.schedMins += r.schedMins; e.coveredMins += covered; e.lateMins += r.lateMins; e.earlyMins += r.earlyMins; e.otMins += r.otMins; e.missingMins += r.missingMins;
    sum.schedMins += r.schedMins; sum.coveredMins += covered; sum.lateMins += r.lateMins; sum.earlyMins += r.earlyMins; sum.otMins += r.otMins; sum.missingMins += r.missingMins;
  }
  const byEmployee = Object.values(empMap).map((e: any) => ({ ...e, pct: e.schedMins > 0 ? Math.round((e.coveredMins / e.schedMins) * 100) : 100 }))
    .sort((a: any, b: any) => a.pct - b.pct);
  sum.pct = sum.schedMins > 0 ? Math.round((sum.coveredMins / sum.schedMins) * 100) : 100;

  return { ok: true, weekStart, rows, byEmployee, summary: sum };
}