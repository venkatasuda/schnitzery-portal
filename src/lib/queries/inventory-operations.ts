"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor, MULTI_BRANCH_ROLES } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";
import { uuid, validOperation, type InventoryAction, type Product, type Supplier, type PurchaseOrder, type PurchaseLine, type Receipt, type ReceiptLine } from "@/lib/inventory/operations";

async function scope() {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;
  const { data: me } = await db.from("users").select("role,branch_id,status").eq("id", user.id).single();
  if (!me || me.status !== "active" || !MULTI_BRANCH_ROLES.includes(me.role)) return null;
  const branch = await activeBranchFor(db, me);
  return branch ? { db, branch } : null;
}

export async function inventoryOperation(branch: string, command: string, action: InventoryAction, body: unknown) {
  if (!uuid(branch) || !uuid(command) || !validOperation(action,body)) return { ok: false as const, error: "invalid" };
  const ctx = await scope();
  if (!ctx || ctx.branch !== branch) return { ok: false as const, error: "access" };
  const { data, error } = await ctx.db.rpc("inventory_operation",{p_branch:branch,p_command:command,p_action:action,p_body:body});
  if (error) return { ok: false as const, error: ["40001","23505"].includes(error.code) ? "conflict" : "save" };
  return { ok: true as const, result: data as { id: string; revision?: number; status?: string } };
}

export async function getInventoryOperations(mode: "catalog" | "purchasing", selected?: string) {
  if (!["catalog","purchasing"].includes(mode) || (selected && !uuid(selected))) return {ok:false as const,error:"invalid"};
  const ctx = await scope();
  if (!ctx) return {ok:false as const,error:"access"};
  const [branch,products,suppliers,orders] = await Promise.all([
    ctx.db.from("branches").select("id,name").eq("id",ctx.branch).single(),
    readAll(ctx.db.from("inventory_master").select("*").eq("branch_id",ctx.branch).eq("is_active",true).order("category").order("product").order("id")),
    readAll(ctx.db.from("inventory_suppliers").select("*").eq("branch_id",ctx.branch).order("name").order("id")),
    mode==="purchasing" ? ctx.db.from("inventory_orders").select("*").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).limit(80) : Promise.resolve({data:[],error:null}),
  ]);
  if(branch.error||products.error||suppliers.error||orders.error) return {ok:false as const,error:"load"};
  let order: PurchaseOrder|null=null;
  let lines: PurchaseLine[]=[],receipts:Receipt[]=[],receiptLines:ReceiptLine[]=[],orderEvents:{id:string;action:string;request:Record<string,unknown>;actor_id:string;recorded_at:string}[]=[];
  if(selected){
    const found=await ctx.db.from("inventory_orders").select("*").eq("id",selected).eq("branch_id",ctx.branch).single();
    if(found.error)return{ok:false as const,error:"load"};
    order=found.data as PurchaseOrder;
    const [l,r]=await Promise.all([
      readAll(ctx.db.from("inventory_order_lines").select("*").eq("order_id",selected).order("product").order("id")),
      readAll(ctx.db.from("inventory_receipts").select("*").eq("order_id",selected).order("received_at",{ascending:false}).order("id")),
    ]);
    if(l.error||r.error)return{ok:false as const,error:"load"};
    lines=l.data as PurchaseLine[];receipts=r.data as Receipt[];
    const events=await readAll(ctx.db.from("inventory_operation_events").select("id,action,request,actor_id,recorded_at").eq("branch_id",ctx.branch).eq("result->>id",selected).in("action",["po_save","po_approve","po_send","po_cancel","po_close","receive"]).order("recorded_at").order("id"));
    if(events.error)return{ok:false as const,error:"load"};orderEvents=events.data as typeof orderEvents;
    if(receipts.length){const rl=await readAll(ctx.db.from("inventory_receipt_lines").select("*").in("receipt_id",receipts.map(r=>r.id)).order("id"));if(rl.error)return{ok:false as const,error:"load"};receiptLines=rl.data as ReceiptLine[];}
  }
  return {ok:true as const,branch:branch.data!,products:products.data as Product[],suppliers:suppliers.data as Supplier[],orders:orders.data as PurchaseOrder[],order,lines,receipts,receiptLines,orderEvents};
}

export async function getInventoryEntry(id: string, kind: "waste" | "transfer") {
  if(!uuid(id)||!["waste","transfer"].includes(kind))return{ok:false as const,error:"invalid"};
  const ctx=await scope();if(!ctx)return{ok:false as const,error:"access"};
  let query=ctx.db.from(kind==="waste"?"waste_log":"stock_transfers").select("*").eq("id",id);
  query=kind==="waste"?query.eq("branch_id",ctx.branch):query.or(`from_branch_id.eq.${ctx.branch},to_branch_id.eq.${ctx.branch}`);
  const [row,audit]=await Promise.all([query.single(),ctx.db.from("inventory_operation_events").select("id,action,request,before_data,result,recorded_at").eq("branch_id",ctx.branch).eq("request->>id",id).order("recorded_at",{ascending:false}).limit(50)]);
  if(audit.error)return{ok:false as const,error:"load"};
  const original=kind==="waste"&&audit.data?.find(e=>e.action==="waste_correct")?.before_data;
  if(row.error&&!original)return{ok:false as const,error:"load"};
  return{ok:true as const,branch:ctx.branch,row:(row.data??{...original,voided:true}) as Record<string,unknown>,events:audit.data};
}
