"use server";
// Today's team for every employee of the active branch: who is planned today and their clock state.
// Clock-in times and lateness only for shift leaders / managers — the database decides (20261117120000).
import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { berlinToday } from "@/lib/time/berlinDate";
import { classifyFloor, floorCounts, type FloorRow } from "@/lib/roster/floor";

export async function getTeamToday() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "access" };
  const { data: me } = await db.from("users").select("role,branch_id,status").eq("id", user.id).single();
  const branch = me && me.status === "active" ? await activeBranchFor(db, me) : null;
  if (!branch) return { ok: false as const, error: "access" };
  const [res, st, lead] = await Promise.all([(db as any).rpc("team_today", { p_branch: branch }), getShiftTimes().catch(() => null), db.rpc("can_plan_prep", { p_branch: branch })]);
  const full = lead.data === true;
  if (res.error) return { ok: false as const, error: res.error.code === "42501" ? "access" : "unavailable" };
  const times = new Map((st && st.ok ? st.items : []).map((x) => [`${x.team}|${x.shift}`, x]));
  // Plain employees: "late" reads as "not in yet" (lateness is shift-leader / manager information).
  const people = classifyFloor((res.data || []) as FloorRow[], times, berlinToday(), Date.now())
    .map((p) => (full || p.state !== "late" ? p : { ...p, state: "not_in" as const, lateBy: 0 }));
  return { ok: true as const, full, people, counts: floorCounts(people) };
}
