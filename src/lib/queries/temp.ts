"use server";

import { getMe } from "@/lib/queries/me";
import { berlinToday } from "@/lib/time/berlinDate";

function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

// ── Units + today's status (which are logged, latest reading, in/out of range) ──
export async function getTempUnits() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", units: [], isManager: false };
  const today = berlinToday();

  const { data: units } = await supabase
    .from("temp_units").select("*").eq("branch_id", branchId).eq("is_active", true).order("sort").order("name");

  const { data: todayLogs } = await supabase
    .from("temp_logs").select("unit_id, temp, in_range, recorded_at, recorded_by_name, slot")
    .eq("branch_id", branchId).eq("work_date", today).order("recorded_at", { ascending: false });

  const latest: Record<string, any> = {};
  // In-range reading per unit and check: the check is done, no second entry (re-check only after out of range).
  const done: Record<Slot, Record<string, any>> = { opening: {}, closing: {} };
  const any: Record<Slot, Set<string>> = { opening: new Set(), closing: new Set() };
  for (const l of todayLogs || []) {
    if (!latest[l.unit_id]) latest[l.unit_id] = l; // first seen = latest (desc order)
    const sl = slotOf(l);
    any[sl].add(l.unit_id);
    if (l.in_range && !done[sl][l.unit_id]) done[sl][l.unit_id] = l;
  }

  const enriched = (units || []).map((u: any) => ({
    ...u,
    opening: any.opening.has(u.id), closing: any.closing.has(u.id),
    latest: latest[u.id] || null, done: { opening: done.opening[u.id] || null, closing: done.closing[u.id] || null },
  }));
  return { ok: true, units: enriched, isManager: isManager(profile?.role), closingNow: isClosing(new Date().toISOString()) };
}

type Slot = "opening" | "closing";
// The employee picks Opening or Closing (temp_logs.slot); rows without one fall back to the time rule.
const slotOf = (l: { slot?: string | null; recorded_at: string }): Slot => (l.slot === "closing" || l.slot === "opening" ? l.slot : isClosing(l.recorded_at) ? "closing" : "opening");

// Default check for "now": before 15:00 Berlin = opening, from 15:00 = closing.
function isClosing(iso: string) {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date(iso))) >= 15;
}

export async function addTempUnit(name: string, kind: string, minTemp: number, maxTemp: number, room = "") {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!name) return { ok: false, error: "Name required." };
  if (!(maxTemp > minTemp)) return { ok: false, error: "Max must be greater than min." };
  const { error } = await supabase.from("temp_units").insert({
    branch_id: branchId, name, kind: kind || "fridge", min_temp: minTemp, max_temp: maxTemp, is_active: true, room: room.trim().slice(0, 40) || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function removeTempUnit(id: string) {
  const { supabase, user, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("temp_units").update({ is_active: false }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// ── Record a reading. Out-of-range requires a corrective action. ──
export async function logTemp(unitId: string, temp: number, note: string, correctiveAction: string, slot: Slot) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (slot !== "opening" && slot !== "closing") return { ok: false, error: "Pick Opening or Closing." };
  if (!unitId || temp === null || temp === undefined || Number.isNaN(temp)) return { ok: false, error: "Enter a temperature." };

  const { data: unit } = await supabase
    .from("temp_units").select("min_temp, max_temp").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Unit not found." };

  const inRange = temp >= Number(unit.min_temp) && temp <= Number(unit.max_temp);
  if (!inRange && !(correctiveAction && correctiveAction.trim())) {
    return { ok: false, error: "Out of range — please record a corrective action.", needsAction: true };
  }

  // One check per unit per slot (opening / closing). A second reading is only allowed while the slot has no
  // in-range reading yet, i.e. a re-check after an out-of-range reading and its corrective action.
  // ponytail: app-level check; two phones saving within the same second could still both pass. DB unique index if that ever happens.
  const { data: slotLogs } = await supabase.from("temp_logs").select("recorded_at, recorded_by_name, slot")
    .eq("unit_id", unitId).eq("work_date", berlinToday()).eq("in_range", true);
  const done = (slotLogs || []).find((l: any) => slotOf(l) === slot);
  if (done) return { ok: false, error: "This check is already recorded.", alreadyDone: true };

  const { error } = await supabase.from("temp_logs").insert({
    branch_id: branchId, unit_id: unitId, temp, in_range: inRange,
    note: note || null, corrective_action: !inRange ? correctiveAction : null,
    recorded_by: user.id, recorded_by_name: profile?.full_name || null, work_date: berlinToday(), slot,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true, inRange };
}

// ── Recent log (history) with unit names, newest first ──
export async function getTempLog(days = 14) {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", logs: [] };
  const anchor = new Date(berlinToday() + "T12:00:00Z").getTime();
  const from = new Date(anchor - days * 86400000).toISOString().slice(0, 10);
  const { data } = await supabase
    .from("temp_logs").select("*, unit:unit_id (name, kind)")
    .eq("branch_id", branchId).gte("work_date", from)
    .order("recorded_at", { ascending: false }).limit(200);
  return { ok: true, logs: data || [] };
}

// ── Today's compliance snapshot: coverage + any breaches ──
export async function getTempSummary() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const today = berlinToday();
  const { data: units, error: uErr } = await supabase
    .from("temp_units").select("id, name").eq("branch_id", branchId).eq("is_active", true);
  const { data: logs, error: lErr } = await supabase
    .from("temp_logs").select("unit_id, in_range, recorded_at, slot, temp").eq("branch_id", branchId).eq("work_date", today).order("recorded_at");
  if (uErr || lErr) return { ok: false, error: (uErr || lErr)!.message };

  const active = new Set((units || []).map((u: any) => u.id));
  const checks = new Set((logs || []).filter((l: any) => active.has(l.unit_id)).map((l: any) => `${l.unit_id}|${slotOf(l)}`));
  const breaches = (logs || []).filter((l: any) => !l.in_range).length;
  const total = active.size * 2; // opening + closing per unit
  // Still out of range = the unit's latest reading today is out of range (a good re-check clears it).
  const latest = new Map<string, any>(); for (const l of logs || []) if (active.has(l.unit_id)) latest.set(l.unit_id, l);
  const openBreaches = [...latest.values()].filter((l) => !l.in_range)
    .map((l) => ({ name: (units || []).find((u: any) => u.id === l.unit_id)?.name || "", temp: Number(l.temp) }));
  const missing = (slot: "opening" | "closing") => [...active].filter((id) => !checks.has(`${id}|${slot}`)).length;
  return {
    ok: true,
    totalUnits: active.size,
    totalChecks: total,
    doneChecks: checks.size,
    pending: Math.max(0, total - checks.size),
    breachesToday: breaches,
    openBreaches, openingMissing: missing("opening"), closingMissing: missing("closing"),
  };
}