"use server";

import { createClient } from "@/lib/supabase/server";

export async function getStockHistory(source = "all", before?: number) {
  if (!["all", "inventory_counts", "inventory_purchases", "waste_log", "stock_transfers"].includes(source)
    || (before !== undefined && (!Number.isSafeInteger(before) || before < 1))) {
    return { ok: false as const, error: "Invalid history filter." };
  }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: profile, error: profileError } = await db.from("users").select("role,branch_id").eq("id", user.id).single();
  if (profileError || !profile?.branch_id || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile.role)) {
    return { ok: false as const, error: "Manager access with a branch is required." };
  }
  let query = db.from("stock_events").select("id,source_table,source_id,operation,before_row,after_row,actor_id,recorded_at")
    .contains("branch_ids", [profile.branch_id]).order("id", { ascending: false }).limit(101);
  if (source !== "all") query = query.eq("source_table", source);
  if (before !== undefined) query = query.lt("id", before);
  const { data, error } = await query;
  if (error) return { ok: false as const, error: "Stock history could not be loaded. Try again." };
  const rows = (data || []).slice(0, 100);
  return { ok: true as const, rows, next: data && data.length > 100 ? rows.at(-1)?.id as number : undefined };
}
