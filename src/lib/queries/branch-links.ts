"use server";

import { createClient } from "@/lib/supabase/server";

// Brand owners link managers / branch owners to extra branches (user_branches).
// accessible_branch_ids() then lets that person work in those branches, and the
// header picker appears for them. Staff stay single-branch in this version.
const HQ = ["brand_owner", "super_admin"];
const LINKABLE = ["manager", "branch_owner"];

async function ctx(userId: string) {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { error: "Not logged in." } as const;
  const { data: me } = await db.from("users").select("role").eq("id", user.id).single();
  if (!HQ.includes(me?.role ?? "")) return { error: "Owners only." } as const;
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId)) return { error: "Staff member not found." } as const;
  const { data: target } = await db.from("users").select("id, role, branch_id").eq("id", userId).maybeSingle();
  if (!target) return { error: "Staff member not found." } as const;
  return { db, target } as const;
}

export async function getBranchLinks(userId: string) {
  const c = await ctx(userId);
  if ("error" in c) return { ok: false as const, error: c.error };
  const [branches, links] = await Promise.all([
    c.db.from("branches").select("id, name").eq("is_active", true).order("name"),
    c.db.from("user_branches").select("branch_id").eq("user_id", userId),
  ]);
  if (branches.error || links.error) return { ok: false as const, error: (branches.error || links.error)!.message };
  return {
    ok: true as const, linkable: LINKABLE.includes(c.target.role), home: c.target.branch_id as string | null,
    branches: branches.data || [], linked: (links.data || []).map((l) => l.branch_id as string),
  };
}

export async function setBranchLink(userId: string, branchId: string, linked: boolean) {
  const c = await ctx(userId);
  if ("error" in c) return { ok: false as const, error: c.error };
  if (!LINKABLE.includes(c.target.role)) return { ok: false as const, error: "Not allowed." };
  if (typeof branchId !== "string" || !/^[0-9a-f-]{36}$/i.test(branchId) || branchId === c.target.branch_id || typeof linked !== "boolean") return { ok: false as const, error: "Invalid decision." };
  const q = linked
    ? c.db.from("user_branches").upsert({ user_id: userId, branch_id: branchId }, { onConflict: "user_id,branch_id", ignoreDuplicates: true })
    : c.db.from("user_branches").delete().eq("user_id", userId).eq("branch_id", branchId);
  const { error } = await q;
  if (error) return { ok: false as const, error: error.message };
  return { ok: true as const };
}
