"use server";

import { getMe } from "@/lib/queries/me";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];


export async function listKiosks() {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false, items: [] as any[] };
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only.", items: [] };
  const { data, error } = await supabase
    .from("kiosks").select("id, label, is_active, created_at")
    .eq("branch_id", branchId).order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message, items: [] };
  return { ok: true, items: data || [] };
}

export async function createKiosk(label: string) {
  const { supabase, user, role, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("kiosks").insert({ branch_id: branchId, label: (label || "").trim() || "Kiosk", is_active: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function renameKiosk(id: string, label: string) {
  const { supabase, role } = await getMe();
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("kiosks").update({ label: (label || "").trim() || "Kiosk" }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function setKioskActive(id: string, active: boolean) {
  const { supabase, role } = await getMe();
  if (!MGR.includes(role || "")) return { ok: false, error: "Managers only." };
  const { error } = await supabase.from("kiosks").update({ is_active: active }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}