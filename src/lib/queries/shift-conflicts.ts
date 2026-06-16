"use server";

import { createClient } from "@/lib/supabase/server";
import { DAYS, SHIFT_MODEL } from "@/lib/queries/schedule-constants";

// ============================================================================
// SHIFT CONFLICT DETECTION — finds employees double-booked into overlapping
// roster shifts on the same day (within a branch, or across branches for an
// owner). Scans the current + upcoming roster weeks; ignores past dates.
// RLS-scoped: a manager sees their branch, an owner sees all.
// ============================================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
const TZ = "Europe/Berlin";

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
function addDays(s: string, n: number): string {
  const d = new Date(s + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
function parseModel(s: string) { const p = String(s).split(/[–—-]/).map((x) => x.trim()); return { start: p[0] || "", end: p[1] || "" }; }
const todayStr = () => new Date().toISOString().slice(0, 10);

export async function getShiftConflicts(opts: { weeks?: number } = {}) {
  const weeks = Math.max(1, Math.min(opts.weeks ?? 2, 6));
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in.", conflicts: [], total: 0 };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!MGR.includes(me?.role ?? "")) return { ok: false as const, error: "Managers only.", conflicts: [], total: 0 };

  const today = todayStr();
  const thisMon = mondayOfDate(today);
  const weekStarts = Array.from({ length: weeks }, (_, i) => addDays(thisMon, i * 7));

  const { data: branches } = await supabase.from("branches").select("id, name");
  const brName: Record<string, string> = {}; (branches || []).forEach((b) => { brName[b.id] = b.name; });

  const { data: stRows } = await supabase.from("shift_times").select("branch_id, team, shift, start_time, end_time").eq("is_active", true);
  const tm: Record<string, { start: string; end: string }> = {};
  for (const t of Object.keys(SHIFT_MODEL)) for (const s of (SHIFT_MODEL as any)[t]) { const d = parseModel(s.time); tm[`g|${t}|${s.shift}`] = { start: d.start, end: d.end }; }
  for (const r of stRows || []) if (r.branch_id == null) tm[`g|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  for (const r of stRows || []) if (r.branch_id) tm[`${r.branch_id}|${r.team}|${r.shift}`] = { start: String(r.start_time).slice(0, 5), end: String(r.end_time).slice(0, 5) };
  const resolve = (br: string, team: string, shift: string) => tm[`${br}|${team}|${shift}`] || tm[`g|${team}|${shift}`] || null;

  const { data: rosters } = await supabase.from("weekly_roster").select("branch_id, week_start, roster_data").in("week_start", weekStarts);

  // build per (user|date) list of scheduled intervals
  type Slot = { branch: string; branchName: string; team: string; shift: string; start: number; end: number; label: string; name: string };
  const byUserDate: Record<string, Slot[]> = {};
  for (const r of rosters || []) {
    const rd = (r.roster_data as any) || {};
    for (let i = 0; i < 7; i++) {
      const date = addDays(r.week_start, i);
      if (date < today) continue;                       // only today + future
      const list = rd[DAYS[i]] || [];
      for (const e of list) {
        if (!e?.user_id) continue;
        const times = resolve(r.branch_id, e.team, e.shift);
        if (!times) continue;
        let start = zonedToUtcMs(date, times.start), end = zonedToUtcMs(date, times.end);
        if (end <= start) end += 24 * 3600000;
        const key = `${e.user_id}|${date}`;
        (byUserDate[key] ||= []).push({
          branch: r.branch_id, branchName: brName[r.branch_id] || "—", team: e.team, shift: e.shift,
          start, end, label: `${times.start}–${times.end}`, name: e.name || "",
        });
      }
    }
  }

  // detect overlaps
  const conflicts: any[] = [];
  for (const key in byUserDate) {
    const slots = byUserDate[key];
    if (slots.length < 2) continue;
    let overlap = false;
    for (let i = 0; i < slots.length && !overlap; i++)
      for (let j = i + 1; j < slots.length; j++)
        if (slots[i].start < slots[j].end && slots[j].start < slots[i].end) { overlap = true; break; }
    if (!overlap) continue;
    const [userId, date] = key.split("|");
    const crossBranch = new Set(slots.map((s) => s.branch)).size > 1;
    conflicts.push({
      userId, date, name: slots.find((s) => s.name)?.name || userId.slice(0, 8), crossBranch,
      shifts: slots.map((s) => ({ branch: s.branchName, team: s.team, shift: s.shift, time: s.label })),
    });
  }
  conflicts.sort((a, b) => a.date.localeCompare(b.date));

  return { ok: true as const, conflicts, total: conflicts.length };
}