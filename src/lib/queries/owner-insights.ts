"use server";

import { createClient } from "@/lib/supabase/server";
import { readAll } from "@/lib/supabase/readAll";
import { activeBranchFor, accessibleBranchIds } from "@/lib/activeBranch";
import { berlinToday, berlinMonday, mondayOfDate } from "@/lib/time/berlinDate";
import { shiftMinutes } from "@/lib/pay/calculations";
import { wageMapForBranches } from "@/lib/pay/wages";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { DAYS } from "@/lib/queries/schedule-constants";
import { weeklyTrend, forecastWeek, healthPart, healthScore, setupSteps, rosterEntryMinutes, type HealthPart, type PlannedShift, type ShiftTimeDef } from "@/lib/owner/insights";

// Owner home, second band (docs/OWNER-COCKPIT.md): 8-week trend, next week's labour
// forecast from the roster, and the branch health score. Read-only.
const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
type Db = Awaited<ReturnType<typeof createClient>>;

async function ctx() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: p } = await db.from("users").select("role, branch_id").eq("id", user.id).single();
  return { db, role: p?.role ?? "", branchId: await activeBranchFor(db, p) };
}
const addDays = (d: string, n: number) => { const x = new Date(`${d}T12:00:00Z`); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

// Last 7 full days (today excluded — it is still running).
async function health(db: Db, branchId: string): Promise<{ score: number | null; parts: HealthPart[] } | null> {
  const to = berlinToday(), from = addDays(to, -7);
  const [units, temps, checks, logs, sales] = await Promise.all([
    db.from("temp_units").select("id", { count: "exact", head: true }).eq("branch_id", branchId).eq("is_active", true),
    readAll(db.from("temp_logs").select("unit_id, work_date").eq("branch_id", branchId).gte("work_date", from).lt("work_date", to).order("id")),
    readAll(db.from("checklists").select("done").eq("branch_id", branchId).gte("work_date", from).lt("work_date", to).order("id")),
    readAll(db.from("attendance_logs").select("work_date, approval_status").eq("branch_id", branchId).eq("status", "complete").gte("work_date", from).lt("work_date", to).order("id")),
    readAll(db.from("daily_sales").select("sale_date").eq("branch_id", branchId).gte("sale_date", from).lt("sale_date", to).order("id")),
  ]);
  if (units.error || temps.error || checks.error || logs.error || sales.error) return null;
  const unitDays = new Set((temps.data || []).map((r) => `${r.unit_id}|${r.work_date}`)).size;
  const workedDays = new Set((logs.data || []).map((r) => r.work_date));
  const salesDays = new Set((sales.data || []).map((r) => r.sale_date));
  const parts = [
    healthPart("temps", unitDays, (units.count || 0) * 7),
    healthPart("checklists", (checks.data || []).filter((r) => r.done).length, (checks.data || []).length),
    healthPart("sales", [...workedDays].filter((d) => salesDays.has(d)).length, workedDays.size),
    healthPart("approvals", (logs.data || []).filter((r) => r.approval_status && r.approval_status !== "pending").length, (logs.data || []).length),
  ];
  return { score: healthScore(parts), parts };
}

// Health for several branches with one auth/access check (All my branches).
export async function getBranchesHealth(branchIds: string[]) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  const allowed = new Set(await accessibleBranchIds(c.db));
  const ids = branchIds.filter((id) => allowed.has(id));
  const res = await Promise.all(ids.map((id) => health(c.db, id).catch(() => null)));
  return { ok: true as const, scores: Object.fromEntries(ids.map((id, i) => [id, res[i]?.score ?? null])) as Record<string, number | null> };
}

export async function getOwnerInsights() {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  const b = c.branchId;
  if (!b) return { ok: false as const, error: "No branch." };

  const thisMon = berlinMonday(), nextMon = berlinMonday(1);
  const weeks = Array.from({ length: 8 }, (_, i) => mondayOfDate(thisMon, i - 8)); // 8 full weeks
  const [sales, logs, wages, roster, times, h] = await Promise.all([
    readAll(c.db.from("daily_sales").select("sale_date, amount").eq("branch_id", b).gte("sale_date", weeks[0]).lt("sale_date", thisMon).order("id")),
    readAll(c.db.from("attendance_logs").select("user_id, work_date, duration_mins, breaks, clock_in, clock_out").eq("branch_id", b).eq("status", "complete").gte("work_date", weeks[0]).lt("work_date", thisMon).order("id")),
    wageMapForBranches(c.db, [b]).catch(() => null),
    c.db.from("weekly_roster").select("roster_data").eq("branch_id", b).eq("week_start", nextMon).maybeSingle(),
    getShiftTimes().catch(() => null),
    health(c.db, b),
  ]);
  if (sales.error || logs.error || roster.error) return { ok: false as const, error: (sales.error || logs.error || roster.error)!.message };
  const w = wages ?? {}; // wage lookup failed → every cost shows "—"
  const worked = (logs.data || []).map((l) => ({ user_id: l.user_id, work_date: l.work_date, paidMin: shiftMinutes(l).paidMin }));
  const trend = weeklyTrend(weeks, sales.data || [], worked, w);

  // Roster → planned minutes per person per day, using the branch's shift times.
  const tmap = new Map<string, ShiftTimeDef>((times && times.ok ? times.items : []).map((s) => [`${s.team}|${s.shift}`, s]));
  const data = (roster.data?.roster_data ?? {}) as unknown as Record<string, { user_id?: string; team?: string; shift?: string }[]>;
  const dates = DAYS.map((_, i) => addDays(nextMon, i));
  const planned: PlannedShift[] = [];
  let unknownShifts = 0;
  DAYS.forEach((day, i) => {
    for (const e of data[day] || []) {
      const mins = rosterEntryMinutes(e, tmap); // preset or custom "HH:MM–HH:MM"
      if (!e.user_id || mins == null) { unknownShifts++; continue; }
      planned.push({ date: dates[i], user_id: e.user_id, mins });
    }
  });
  const history = (sales.data || []).filter((s) => s.sale_date >= mondayOfDate(thisMon, -4));
  const forecast = forecastWeek(dates, history, planned, w);

  return { ok: true as const, trend, forecast: { ...forecast, weekStart: nextMon, hasRoster: planned.length > 0, unknownShifts }, health: h };
}

// "Get your branch ready" card: is the data the owner figures depend on in place?
export async function getSetupProgress() {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  const b = c.branchId;
  if (!b) return { ok: false as const, error: "No branch." };
  const since = addDays(berlinToday(), -30);
  const [staff, wages, targets, fridges, checks, sales, roster] = await Promise.all([
    readAll(c.db.from("users").select("id").eq("branch_id", b).eq("status", "active").in("role", ["staff", "manager", "branch_owner"]).order("id")),
    wageMapForBranches(c.db, [b]).catch(() => null),
    c.db.from("branch_targets").select("labour_pct, purchase_pct, prime_pct").eq("branch_id", b).maybeSingle(),
    c.db.from("temp_units").select("id", { count: "exact", head: true }).eq("branch_id", b).eq("is_active", true),
    c.db.from("checklists").select("id", { count: "exact", head: true }).eq("branch_id", b).gte("work_date", since),
    c.db.from("daily_sales").select("id", { count: "exact", head: true }).eq("branch_id", b).gte("sale_date", since),
    c.db.from("weekly_roster").select("id", { count: "exact", head: true }).eq("branch_id", b).gte("week_start", berlinMonday()),
  ]);
  if (staff.error || !wages || targets.error || fridges.error || checks.error || sales.error || roster.error) return { ok: false as const, error: "Could not load alerts." };
  const ids = (staff.data || []).map((u) => u.id as string);
  const t = targets.data;
  const steps = setupSteps({
    staff: ids.length, staffWithoutWage: ids.filter((id) => wages[id] == null).length,
    hasTargets: !!t && (t.labour_pct != null || t.purchase_pct != null || t.prime_pct != null),
    fridges: fridges.count || 0, checklistTasks: checks.count || 0, salesDays: sales.count || 0, hasRoster: (roster.count || 0) > 0,
  });
  return { ok: true as const, steps };
}

// Roster editor side panel: everything needed to price the roster live in the browser
// while shifts are added (wages, shift times, last 4 weeks of sales, labour target).
// Managers already see these wages on the labour page; nothing new is exposed.
export async function getRosterPlanning(weekStart: string) {
  const c = await ctx();
  if (!c) return { ok: false as const, error: "Not logged in." };
  if (!MGR.includes(c.role)) return { ok: false as const, error: "Managers only." };
  const b = c.branchId;
  if (!b) return { ok: false as const, error: "No branch." };
  if (typeof weekStart !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) return { ok: false as const, error: "Invalid period." };
  const until = weekStart < berlinToday() ? weekStart : berlinToday();
  const [sales, wages, times, target] = await Promise.all([
    readAll(c.db.from("daily_sales").select("sale_date, amount").eq("branch_id", b).gte("sale_date", addDays(until, -28)).lt("sale_date", until).order("id")),
    wageMapForBranches(c.db, [b]).catch(() => null),
    getShiftTimes().catch(() => null),
    c.db.from("branch_targets").select("labour_pct").eq("branch_id", b).maybeSingle(),
  ]);
  if (sales.error) return { ok: false as const, error: sales.error.message };
  return {
    ok: true as const,
    history: (sales.data || []).map((r) => ({ sale_date: r.sale_date as string, amount: Number(r.amount) })),
    wages: wages ?? {}, wagesKnown: wages != null,
    times: (times && times.ok ? times.items : []).map(({ team, shift, start, end, breakMins }) => ({ team, shift, start, end, breakMins })),
    labourTarget: target.data?.labour_pct != null ? Number(target.data.labour_pct) : null,
  };
}
