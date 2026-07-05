"use server";

import { createClient } from "@/lib/supabase/server";
import { berlinToday } from "@/lib/time/berlinDate";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id").eq("id", user.id).single();
  return { supabase, user, branchId: profile?.branch_id ?? null, profile };
}
function isManager(r?: string | null) {
  return ["manager", "branch_owner", "brand_owner", "super_admin"].includes(r || "");
}

// ── Units + today's status (which are logged, latest reading, in/out of range) ──
export async function getTempUnits() {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", units: [], isManager: false };
  const today = berlinToday();

  const { data: units } = await supabase
    .from("temp_units").select("*").eq("branch_id", branchId).eq("is_active", true).order("name");

  const { data: todayLogs } = await supabase
    .from("temp_logs").select("unit_id, temp, in_range, recorded_at, recorded_by_name")
    .eq("branch_id", branchId).eq("work_date", today).order("recorded_at", { ascending: false });

  const latest: Record<string, any> = {};
  const count: Record<string, number> = {};
  for (const l of todayLogs || []) {
    count[l.unit_id] = (count[l.unit_id] || 0) + 1;
    if (!latest[l.unit_id]) latest[l.unit_id] = l; // first seen = latest (desc order)
  }

  const enriched = (units || []).map((u: any) => ({
    ...u,
    todayCount: count[u.id] || 0,
    latest: latest[u.id] || null,
  }));
  return { ok: true, units: enriched, isManager: isManager(profile?.role) };
}

export async function addTempUnit(name: string, kind: string, minTemp: number, maxTemp: number) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!name) return { ok: false, error: "Name required." };
  if (!(maxTemp > minTemp)) return { ok: false, error: "Max must be greater than min." };
  const { error } = await supabase.from("temp_units").insert({
    branch_id: branchId, name, kind: kind || "fridge", min_temp: minTemp, max_temp: maxTemp, is_active: true,
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
export async function logTemp(unitId: string, temp: number, note: string, correctiveAction: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!unitId || temp === null || temp === undefined || Number.isNaN(temp)) return { ok: false, error: "Enter a temperature." };

  const { data: unit } = await supabase
    .from("temp_units").select("min_temp, max_temp").eq("id", unitId).maybeSingle();
  if (!unit) return { ok: false, error: "Unit not found." };

  const inRange = temp >= Number(unit.min_temp) && temp <= Number(unit.max_temp);
  if (!inRange && !(correctiveAction && correctiveAction.trim())) {
    return { ok: false, error: "Out of range — please record a corrective action.", needsAction: true };
  }

  const { error } = await supabase.from("temp_logs").insert({
    branch_id: branchId, unit_id: unitId, temp, in_range: inRange,
    note: note || null, corrective_action: !inRange ? correctiveAction : null,
    recorded_by: user.id, recorded_by_name: profile?.full_name || null, work_date: berlinToday(),
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
  const { data: units } = await supabase
    .from("temp_units").select("id").eq("branch_id", branchId).eq("is_active", true);
  const { data: logs } = await supabase
    .from("temp_logs").select("unit_id, in_range").eq("branch_id", branchId).eq("work_date", today);

  const logged = new Set((logs || []).map((l: any) => l.unit_id));
  const breaches = (logs || []).filter((l: any) => !l.in_range).length;
  const total = (units || []).length;
  return {
    ok: true,
    totalUnits: total,
    loggedUnits: logged.size,
    pending: Math.max(0, total - logged.size),
    breachesToday: breaches,
  };
}