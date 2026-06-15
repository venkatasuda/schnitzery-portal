"use server";

import { createClient } from "@/lib/supabase/server";

// ============================================================
// GEOFENCE QUERIES — branch location, radius, mode, and the
// manager override. The branch already stores gps_lat/gps_lng/
// gps_radius_m; gps_mode lives in branch_settings.
// Enforcement happens in clock_in() (SECURITY DEFINER).
// ============================================================

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, role: null as string | null, branchId: null as string | null };
  const { data: p } = await supabase.from("users").select("role, branch_id").eq("id", user.id).single();
  return { supabase, role: p?.role ?? null, branchId: p?.branch_id ?? null };
}

export type GeofenceMode = "off" | "warn" | "required";

export async function getGeofence() {
  const { supabase, role, branchId } = await getMe();
  if (!branchId) return { ok: false as const, error: "No branch assigned." };
  const { data: b } = await supabase
    .from("branches").select("name, gps_lat, gps_lng, gps_radius_m").eq("id", branchId).single();
  const { data: s } = await supabase
    .from("branch_settings").select("gps_mode").eq("branch_id", branchId).single();
  return {
    ok: true as const,
    canEdit: MGR.includes(role ?? ""),
    branchName: b?.name ?? "",
    lat: (b?.gps_lat ?? null) as number | null,
    lng: (b?.gps_lng ?? null) as number | null,
    radius: (b?.gps_radius_m ?? 150) as number,
    mode: ((s?.gps_mode ?? "off") as GeofenceMode),
  };
}

export async function setGeofence(input: { lat: number | null; lng: number | null; radius: number; mode: GeofenceMode }) {
  const { supabase, role, branchId } = await getMe();
  if (!branchId || !MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only." };
  const radius = Math.max(10, Math.min(5000, Math.round(input.radius || 150)));

  const { error: e1 } = await supabase.from("branches")
    .update({ gps_lat: input.lat, gps_lng: input.lng, gps_radius_m: radius })
    .eq("id", branchId);
  if (e1) return { ok: false as const, error: e1.message };

  const { error: e2 } = await supabase.from("branch_settings")
    .upsert({ branch_id: branchId, gps_mode: input.mode }, { onConflict: "branch_id" });
  if (e2) return { ok: false as const, error: e2.message };

  return { ok: true as const };
}

export async function listBranchStaff() {
  const { supabase, role, branchId } = await getMe();
  if (!branchId || !MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only.", staff: [] };
  const { data } = await supabase.from("users")
    .select("id, full_name, role").eq("branch_id", branchId).neq("role", "kiosk").order("full_name");
  return { ok: true as const, staff: (data ?? []) as { id: string; full_name: string; role: string }[] };
}

export async function grantOverride(userId: string, minutes = 15) {
  const { supabase, role } = await getMe();
  if (!MGR.includes(role ?? "")) return { ok: false as const, error: "Managers only." };
  const { data, error } = await supabase.rpc("grant_clock_override", { p_user: userId, p_minutes: minutes });
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const, expiresInMin: (data?.expiresInMin ?? minutes) as number };
}