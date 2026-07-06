"use server";

import { createClient } from "@/lib/supabase/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";

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
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// list of OTHER active branches (names only) for the source picker — managers only
export async function getTransferBranches() {
  const { user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", branches: [], isManager: false };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only.", branches: [], isManager: false };
  const { data } = await admin().from("branches").select("id, name, is_active").eq("is_active", true).order("name");
  const branches = (data || []).filter((b: any) => b.id !== branchId).map((b: any) => ({ id: b.id, name: b.name }));
  return { ok: true, branches, isManager: true };
}

// products for the picker (own catalog)
export async function getTransferProducts() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", products: [] };
  const { data } = await supabase
    .from("inventory_master").select("product, category, unit, is_active")
    .eq("branch_id", branchId).eq("is_active", true).order("product");
  return { ok: true, products: data || [] };
}

async function branchNames(ids: string[]) {
  const { data } = await admin().from("branches").select("id, name").in("id", ids);
  const map: Record<string, string> = {};
  for (const b of data || []) map[b.id] = b.name;
  return map;
}

export async function requestTransfer(sourceBranchId: string, product: string, category: string, qty: number, unit: string, note: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  if (!sourceBranchId || sourceBranchId === branchId) return { ok: false, error: "Pick another branch." };
  if (!product) return { ok: false, error: "Pick a product." };
  if (!(qty > 0)) return { ok: false, error: "Enter a quantity." };

  const names = await branchNames([sourceBranchId, branchId!]);
  const { error } = await supabase.from("stock_transfers").insert({
    from_branch_id: sourceBranchId, from_branch_name: names[sourceBranchId] || null,
    to_branch_id: branchId, to_branch_name: names[branchId!] || null,
    product, category: category || null, qty, unit: unit || null, note: note || null,
    status: "requested", requested_by: user.id, requested_by_name: profile?.full_name || null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// transfers my branch requested FROM other branches
export async function getMyRequests() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", requests: [] };
  const { data } = await supabase
    .from("stock_transfers").select("*").eq("to_branch_id", branchId).order("created_at", { ascending: false }).limit(60);
  return { ok: true, requests: data || [] };
}

// requests OTHER branches made to my branch (I'm the source and must send/reject)
export async function getFulfillQueue() {
  const { supabase, user, branchId } = await getMe();
  if (!user) return { ok: false, error: "Not logged in.", requests: [] };
  const { data } = await supabase
    .from("stock_transfers").select("*").eq("from_branch_id", branchId).in("status", ["requested", "sent"]).order("created_at", { ascending: false }).limit(60);
  return { ok: true, requests: data || [] };
}

async function transition(id: string, side: "from" | "to", allowedFrom: string[], next: string) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!isManager(profile?.role)) return { ok: false, error: "Managers only." };
  const { data: row } = await supabase.from("stock_transfers").select("*").eq("id", id).maybeSingle();
  if (!row) return { ok: false, error: "Not found." };
  const mySide = side === "from" ? row.from_branch_id : row.to_branch_id;
  if (mySide !== branchId) return { ok: false, error: "Not your transfer." };
  if (!allowedFrom.includes(row.status)) return { ok: false, error: "Already actioned." };
  const { error } = await supabase.from("stock_transfers").update({ status: next, updated_at: new Date().toISOString() }).eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function sendTransfer(id: string) { return transition(id, "from", ["requested"], "sent"); }
export async function rejectTransfer(id: string) { return transition(id, "from", ["requested"], "rejected"); }
export async function cancelTransfer(id: string) { return transition(id, "to", ["requested"], "cancelled"); }
export async function receiveTransfer(id: string) { return transition(id, "to", ["sent"], "received"); }