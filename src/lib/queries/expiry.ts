"use server";

import { validInventoryItem } from "@/lib/inventory/identity";
import { createClient } from "@/lib/supabase/server";
import { berlinToday, isCalendarDate } from "@/lib/time/berlinDate";
import { activeBranchFor,MULTI_BRANCH_ROLES } from "@/lib/activeBranch";
import { uuid } from "@/lib/inventory/operations";
import { readAll } from "@/lib/supabase/readAll";
import { batchFlag,type StockBatch } from "@/lib/inventory/batches";

async function getMe() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, branchId: null, profile: null };
  const { data: profile } = await supabase
    .from("users").select("id, full_name, role, branch_id,status").eq("id", user.id).single();
  return { supabase, user, branchId: await activeBranchFor(supabase, profile), homeBranchId: profile?.branch_id ?? null, profile };
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b + "T12:00:00Z").getTime() - new Date(a + "T12:00:00Z").getTime()) / 86400000);

// products for the picker
export async function getBatchProducts() {
  const { supabase, user, branchId,profile } = await getMe();
  if (!user||profile?.status!=="active") return { ok: false, error: "Active account required.", products: [] };
  const { data, error } = await readAll(supabase
    .from("inventory_master").select("product, category, unit, is_active")
    .eq("branch_id", branchId).eq("is_active", true).order("product").order("id"));
  if (error) return { ok: false, error: error.message, products: [] };
  return { ok: true, products: data || [] };
}

export async function addBatch(product: string, category: string, qty: number, unit: string, expiryDate: string, note: string,extra?:{command:string;lot:string;expiry_note:string}) {
  const { supabase, user, branchId, profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  if (!branchId || !validInventoryItem({ product, category, unit })) return { ok: false, error: "Pick a product." };
  if (!Number.isFinite(qty) || !(qty > 0) || qty>=1e9 || typeof note!=="string"||note.length>1000) return { ok: false, error: "Check quantity and note." };
  if(extra&&(!uuid(extra.command)||typeof extra.lot!=="string"||extra.lot.length>160||typeof extra.expiry_note!=="string"||extra.expiry_note.length>500))return{ok:false,error:"Invalid batch reference."};
  if (!(isCalendarDate(expiryDate)||expiryDate===""&&extra&&extra.expiry_note.trim().length>=3)) return { ok: false, error: "Pick an expiry date or explain why unavailable." };
  const body={
    branch_id: branchId, product, category: category || null, qty, unit: unit || null,
    received_date: berlinToday(), expiry_date: expiryDate||null, note: note || null,
    status: "active", logged_by: user.id, logged_by_name: profile?.full_name || null,
    ...(extra?{id:extra.command,lot_number:extra.lot,expiry_note:expiryDate?"":extra.expiry_note}:{}),
  };
  const { error } = await supabase.from("stock_batches").insert(body);
  if(error?.code==="23505"&&extra){const existing=await supabase.from("stock_batches").select("branch_id,product,category,unit,qty,expiry_date,note,logged_by,lot_number,expiry_note").eq("id",extra.command).single();if(!existing.error&&existing.data&&Object.entries(existing.data).every(([k,v])=>String(v??"")===String(body[k as keyof typeof body]??"")))return{ok:true};}
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// active batches, soonest expiry first (FIFO), with days-to-expiry + flag
export async function getBatches(includeClosed=false) {
  const { supabase, user, branchId,profile } = await getMe();
  if (!user||profile?.status!=="active") return { ok: false, error: "Active account required.", batches: [] };
  const today = berlinToday();
  let query=supabase.from("stock_batches").select("id,product,category,unit,qty,remaining_qty,expiry_date,received_date,status,note,lot_number,expiry_note,receipt_reference,receipt_line_id,purchase_id").eq("branch_id",branchId);
  if(!includeClosed)query=query.eq("status","active");
  const [result,branch]=await Promise.all([readAll(query.order("expiry_date",{ascending:true,nullsFirst:false}).order("id")),supabase.from("branches").select("name").eq("id",branchId).single()]);
  const {data,error}=result;
  if (error||branch.error) return { ok: false, error: error?.message??"Branch unavailable", batches: [] };
  const batches = (data || []).map(b => {
    return { ...b,qty:Number(b.qty),remaining_qty:Number(b.remaining_qty),...batchFlag(b.expiry_date,today) } as StockBatch;
  });
  return { ok: true, batches,canReceive:MULTI_BRANCH_ROLES.includes(profile.role),branchName:branch.data!.name as string };
}

export async function getExpirySummary() {
  const { supabase, user, branchId,profile } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const today = berlinToday();
  const { data, error } = await readAll(supabase
    .from("stock_batches").select("expiry_date")
    .eq("branch_id", branchId).eq("status", "active").order("id"));
  if (error) return { ok: false, error: error.message, expired: 0, soon: 0, active: 0 };
  let expired = 0, soon = 0, unknown=0;
  for (const b of data || []) {
    if(!b.expiry_date){unknown++;continue;}
    const d = daysBetween(today, b.expiry_date);
    if (d < 0) expired++; else if (d <= 3) soon++;
  }
  return { ok: true, expired, soon, unknown, active: (data || []).length };
}

export async function consumeBatch(id:string,command:string,action:"used"|"discarded",qty:number,note:string){
 if(!uuid(id)||!uuid(command)||!["used","discarded"].includes(action)||!Number.isFinite(qty)||qty<=0||qty>=1e9||typeof note!=="string"||note.length>1000||(action==="discarded"&&note.trim().length<3))return{ok:false,error:"Check quantity and reason."};
 const {supabase,user,branchId}=await getMe();if(!user||!branchId)return{ok:false,error:"Batch access denied."};
 const {error}=await supabase.rpc("consume_stock_batch",{p_branch:branchId,p_id:id,p_command:command,p_action:action,p_qty:qty,p_note:note});
 return error?{ok:false,error:error.code==="23505"?"Batch changed. Reload before trying again.":"Batch action failed; reload to verify before retrying."}:{ok:true};
}
export async function getBatchHistory(id:string){
 if(!uuid(id))return{ok:false as const,events:[]};
 const {supabase,user,branchId}=await getMe();if(!user||!branchId)return{ok:false as const,events:[]};
 const r=await readAll(supabase.from("stock_batch_actions").select("id,action,qty,note,actor_id,recorded_at").eq("branch_id",branchId).eq("batch_id",id).order("recorded_at",{ascending:false}).order("id"));
 return{ok:!r.error,events:r.data??[]};
}
export async function resolveBatchExpiry(id:string,command:string,expiry:string,note:string){
 if(!uuid(id)||!uuid(command)||!isCalendarDate(expiry)||typeof note!=="string"||note.trim().length<3||note.length>1000)return{ok:false,error:"Enter the label date and evidence."};
 const {supabase,user,branchId,profile}=await getMe();if(!user||!branchId||profile?.status!=="active"||!MULTI_BRANCH_ROLES.includes(profile.role))return{ok:false,error:"Manager access required."};
 const {error}=await supabase.rpc("resolve_stock_batch_expiry",{p_branch:branchId,p_id:id,p_command:command,p_expiry:expiry,p_note:note});
 return error?{ok:false,error:error.code==="23505"?"Expiry already recorded or batch changed. Reload.":"Could not confirm expiry evidence. Reload before retrying."}:{ok:true};
}

export async function markBatchUsed(id: string) {
  if (!uuid(id)) return { ok: false, error: "Pick a batch." };
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.rpc("use_batch_atomic", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

// discard a batch → mark discarded AND record it in the waste log (reason = expired)
export async function discardBatch(id: string) {
  if (!uuid(id)) return { ok: false, error: "Pick a batch." };
  const { supabase, user } = await getMe();
  if (!user) return { ok: false, error: "Not logged in." };
  const { error } = await supabase.rpc("discard_batch_atomic", { p_id: id });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
