"use server";
// Staff tier for the smart scheduler: 1 = senior/ace, 2 = mid, 3 = junior. Managers only (RLS on staff_tiers);
// employees never see tiers. The tier is stored for the employee's home branch.
import { createClient } from "@/lib/supabase/server";

const MGR = ["manager", "branch_owner", "brand_owner", "super_admin"];
async function ctx() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from("users").select("role").eq("id", user.id).single();
  return me && MGR.includes(me.role) ? { db: db as any, uid: user.id } : null;
}

export async function getStaffTier(userId: string) {
  const c = await ctx(); if (!c) return { ok: false as const, error: "Managers only." };
  const { data, error } = await c.db.from("staff_tiers").select("tier").eq("user_id", userId).maybeSingle();
  return error ? { ok: false as const, error: error.message } : { ok: true as const, tier: (data?.tier ?? null) as number | null };
}

// tier null = remove (unrated).
export async function setStaffTier(userId: string, tier: number | null) {
  if (tier !== null && ![1, 2, 3].includes(tier)) return { ok: false as const, error: "Invalid tier." };
  const c = await ctx(); if (!c) return { ok: false as const, error: "Managers only." };
  const { data: u } = await c.db.from("users").select("branch_id").eq("id", userId).maybeSingle();
  if (!u?.branch_id) return { ok: false as const, error: "Not in your branch." };
  const { error } = tier === null
    ? await c.db.from("staff_tiers").delete().eq("user_id", userId)
    : await c.db.from("staff_tiers").upsert({ user_id: userId, branch_id: u.branch_id, tier, updated_by: c.uid, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  return error ? { ok: false as const, error: error.message } : { ok: true as const };
}
