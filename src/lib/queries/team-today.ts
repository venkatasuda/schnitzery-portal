"use server";
// Today's team for shift leaders (and managers): who is planned today and their clock state, for the
// active branch. The database function decides who may see it (migration 20261114120000).
import { shiftScope } from "@/lib/inventory/shift-scope";
import { getShiftTimes } from "@/lib/queries/shift-times";
import { berlinToday } from "@/lib/time/berlinDate";
import { classifyFloor, floorCounts, type FloorRow } from "@/lib/roster/floor";

export async function getTeamToday() {
  const c = await shiftScope();
  if (!c) return { ok: false as const, error: "access" };
  const [res, st] = await Promise.all([(c.db as any).rpc("team_today", { p_branch: c.branch }), getShiftTimes().catch(() => null)]);
  if (res.error) return { ok: false as const, error: res.error.code === "42501" ? "access" : "unavailable" };
  const times = new Map((st && st.ok ? st.items : []).map((x) => [`${x.team}|${x.shift}`, x]));
  const people = classifyFloor((res.data || []) as FloorRow[], times, berlinToday(), Date.now());
  return { ok: true as const, people, counts: floorCounts(people) };
}
