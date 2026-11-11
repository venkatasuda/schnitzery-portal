"use server";
// Staffing targets (people needed per team, shift and weekday) — managers only, active branch.
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { SHIFT_MODEL, TEAMS } from "@/lib/queries/schedule-constants";
import type { Target } from "@/lib/roster/smart";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
async function ctx() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from("users").select("role, branch_id").eq("id", user.id).single();
  if (!me || !MGR.includes(me.role)) return null;
  const branch = await activeBranchFor(db, me);
  return branch ? { db: db as any, uid: user.id, branch } : null;
}

export async function getStaffingTargets() {
  const c = await ctx(); if (!c) return { ok: false as const, error: "Managers only.", targets: [] as Target[] };
  const { data, error } = await c.db.from("staffing_targets").select("weekday, team, shift, needed").eq("branch_id", c.branch);
  if (error) return { ok: false as const, error: error.message, targets: [] as Target[] };
  return { ok: true as const, targets: (data || []).map((t: any) => ({ weekday: t.weekday, team: t.team, shift: t.shift, needed: t.needed })) as Target[] };
}

// Saves the full grid (0 = nobody needed). Only known team/shift combinations are accepted.
export async function saveStaffingTargets(targets: Target[]) {
  const c = await ctx(); if (!c) return { ok: false as const, error: "Managers only." };
  const valid = Array.isArray(targets) && targets.length <= 7 * 40 && targets.every((t) =>
    Number.isInteger(t?.weekday) && t.weekday >= 0 && t.weekday <= 6 && Number.isInteger(t.needed) && t.needed >= 0 && t.needed <= 30
    && TEAMS.includes(t.team) && (SHIFT_MODEL[t.team] || []).some((s) => s.shift === t.shift));
  if (!valid) return { ok: false as const, error: "Invalid staffing targets." };
  const rows = targets.map((t) => ({ branch_id: c.branch, weekday: t.weekday, team: t.team, shift: t.shift, needed: t.needed, updated_by: c.uid, updated_at: new Date().toISOString() }));
  const { error } = await c.db.from("staffing_targets").upsert(rows, { onConflict: "branch_id,weekday,team,shift" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
