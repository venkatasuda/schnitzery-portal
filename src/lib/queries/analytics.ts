"use server";

import { createClient } from "@/lib/supabase/server";

// Aggregates branch attendance into chart-ready series:
//  • hours per week (last 8 weeks)   • hours by weekday   • hours by team
//  • headline totals + punctuality (late rate)
// Manager/owner only, scoped to their branch.

async function getMgr() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, role: null, branchId: null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, user, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}
function mondayOf(d: Date) {
  const x = new Date(d);
  const day = x.getDay();           // 0 Sun .. 6 Sat
  const diff = day === 0 ? 6 : day - 1;
  x.setDate(x.getDate() - diff);
  x.setHours(0, 0, 0, 0);
  return x;
}
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const toH = (m: number) => Math.round((m / 60) * 10) / 10;

export async function getAnalytics() {
  const { supabase, user, role, branchId } = await getMgr();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(role)) return { ok: false, error: "Managers only." };

  const now = new Date();
  const start = new Date(now); start.setDate(now.getDate() - 7 * 8);
  const startStr = start.toISOString().slice(0, 10);

  const { data: staff } = await supabase.from("users").select("id, team").eq("branch_id", branchId);
  const teamOf: Record<string, string> = {};
  for (const s of staff || []) teamOf[s.id] = s.team || "—";

  const { data: logs } = await supabase
    .from("attendance_logs")
    .select("user_id, work_date, duration_mins, late_mins, status")
    .eq("branch_id", branchId).gte("work_date", startStr).eq("status", "complete");

  // 8 weekly buckets (oldest → newest)
  const weekKeys: string[] = [];
  const weekMap: Record<string, number> = {};
  for (let i = 7; i >= 0; i--) {
    const m = mondayOf(new Date(now)); m.setDate(m.getDate() - 7 * i);
    const key = m.toISOString().slice(0, 10);
    weekKeys.push(key); weekMap[key] = 0;
  }

  const byDay = [0, 0, 0, 0, 0, 0, 0];
  const byTeam: Record<string, number> = {};
  let totalShifts = 0, lateShifts = 0, monthMins = 0, monthShifts = 0;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  for (const l of logs || []) {
    const mins = l.duration_mins || 0;
    const d = new Date(l.work_date);
    const wk = mondayOf(d).toISOString().slice(0, 10);
    if (wk in weekMap) weekMap[wk] += mins;
    byDay[d.getDay()] += mins;
    const team = teamOf[l.user_id] || "—";
    byTeam[team] = (byTeam[team] || 0) + mins;
    totalShifts++;
    if ((l.late_mins || 0) > 0) lateShifts++;
    if (d >= monthStart) { monthMins += mins; monthShifts++; }
  }

  const weekly = weekKeys.map((k) => ({ week: new Date(k).toLocaleDateString([], { day: "2-digit", month: "short" }), hours: toH(weekMap[k]) }));
  const daily = [1, 2, 3, 4, 5, 6, 0].map((idx) => ({ day: DOW[idx], hours: toH(byDay[idx]) }));
  const teams = Object.entries(byTeam).map(([team, m]) => ({ team, hours: toH(m) })).sort((a, b) => b.hours - a.hours);
  const lateRate = totalShifts > 0 ? Math.round((lateShifts / totalShifts) * 100) : 0;

  return { ok: true, weekly, daily, teams, monthHours: toH(monthMins), monthShifts, lateRate, totalShifts };
}