"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor } from "@/lib/activeBranch";
import { isCalendarDate } from "@/lib/time/berlinDate";

export async function getStockHistory(source = "all", before?: number, filters: {product?:string;from?:string;to?:string}={}) {
  if (!filters || typeof filters!=="object" || Array.isArray(filters) || !["all", "inventory_counts", "inventory_purchases", "waste_log", "stock_transfers"].includes(source)
    || (before !== undefined && (!Number.isSafeInteger(before) || before < 1)) || (filters.product!==undefined&&(typeof filters.product!=="string"||filters.product.length>160))
    || (filters.from && !isCalendarDate(filters.from)) || (filters.to && !isCalendarDate(filters.to)) || (filters.from&&filters.to&&filters.from>filters.to)) {
    return { ok: false as const, error: "Invalid history filter." };
  }
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return { ok: false as const, error: "Not logged in." };
  const { data: profile, error: profileError } = await db.from("users").select("role,branch_id").eq("id", user.id).single();
  if (profileError || !profile || !["manager", "branch_owner", "brand_owner", "super_admin"].includes(profile.role)) {
    return { ok: false as const, error: "Manager access with a branch is required." };
  }
  const branch = await activeBranchFor(db, profile);
  if(!branch)return{ok:false as const,error:"Select a branch."};
  let query = db.from("stock_events").select("id,source_table,source_id,operation,before_row,after_row,actor_id,recorded_at")
    .contains("branch_ids", [branch]).order("id", { ascending: false }).limit(101);
  if (source !== "all") query = query.eq("source_table", source);
  if (before !== undefined) query = query.lt("id", before);
  const { data, error } = filters.product||filters.from||filters.to ? await db.rpc("read_inventory_history",{p_branch:branch,p_source:source,p_before:before??null,p_product:filters.product?.trim()||"",p_from:filters.from||null,p_to:filters.to||null}) : await query;
  if (error) return { ok: false as const, error: "Stock history could not be loaded. Try again." };
  const rows = (data || []).slice(0, 100);
  const actors=[...new Set(rows.map((r:{actor_id:string|null})=>r.actor_id).filter(Boolean))] as string[];
  const names:Record<string,string>={};
  if(actors.length){const people=await db.from("users").select("id,full_name").in("id",actors);for(const p of people.data||[])names[p.id]=p.full_name;}
  const named=rows.map((r:{actor_id:string|null})=>({...r,actor_name:r.actor_id?names[r.actor_id]??null:null}));
  return { ok: true as const, rows:named, next: data && data.length > 100 ? rows.at(-1)?.id as number : undefined };
}
