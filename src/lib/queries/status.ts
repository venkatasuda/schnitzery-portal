"use server";

import { createClient } from "@/lib/supabase/server";

// Kiosk online/offline counts for the status strip. RLS-scoped: a manager sees
// their branch's kiosks, an owner sees all. A kiosk is "online" if it fetched
// its codes (heartbeat) within the last 15 minutes.
const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];

export async function getKioskHealth() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, online: 0, offline: 0, total: 0 };
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).single();
  if (!MGR.includes(me?.role ?? "")) return { ok: false as const, online: 0, offline: 0, total: 0 };

  const { data } = await supabase.from("kiosks").select("is_active, last_seen");
  const now = Date.now();
  let online = 0, offline = 0;
  for (const k of data || []) {
    if (!k.is_active) continue;
    if (k.last_seen && new Date(k.last_seen).getTime() > now - 15 * 60000) online++;
    else offline++;
  }
  return { ok: true as const, online, offline, total: online + offline };
}