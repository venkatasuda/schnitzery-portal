"use server";
import {inventoryScope} from "@/lib/inventory/scope";
import {readAll} from "@/lib/supabase/readAll";
import type {CostBatch,CostInput,CostPurchase,CostRun,CostTransfer} from "@/lib/inventory/batch-costs";
export async function getInventoryBatchReport(){
 const ctx=await inventoryScope();if(!ctx)return{ok:false as const,error:"access"};
 // ponytail: reads one branch history; replace with server-side paginated lineage queries when history size warrants it.
 const [branch,batches,inputs,runs,purchases,actions,reversals,transfers]=await Promise.all([
  ctx.db.from("branches").select("name").eq("id",ctx.branch).single(),
  readAll(ctx.db.from("stock_batches").select("id,product,category,unit,qty,remaining_qty,purchase_id,production_id,transfer_lot_id,expiry_date,lot_number,receipt_reference,status").eq("branch_id",ctx.branch).order("expiry_date",{nullsFirst:false}).order("id")),
  readAll(ctx.db.from("inventory_production_inputs").select("id,run_id,batch_id,product,category,unit,qty,planned_qty,unit_cost,cost_source").eq("branch_id",ctx.branch).order("id")),
  readAll(ctx.db.from("inventory_production_runs").select("id,output_batch_id,product,unit,qty,expected_qty,status,reversed_at,production_date").eq("branch_id",ctx.branch).order("production_date",{ascending:false}).order("id")),
  readAll(ctx.db.from("inventory_purchases").select("id,product,category,unit,qty,cost,supplier,purchase_date").eq("branch_id",ctx.branch).order("id")),
  readAll(ctx.db.from("stock_batch_actions").select("id,batch_id,action,qty,note,recorded_at").eq("branch_id",ctx.branch).order("recorded_at",{ascending:false}).order("id")),
  readAll(ctx.db.from("inventory_production_reversals").select("id,run_id,reason,recorded_at").eq("branch_id",ctx.branch).order("recorded_at",{ascending:false}).order("id")),
  readAll(ctx.db.from("inventory_transfer_lots").select("id,transfer_id,source_batch_id,destination_batch_id,received_qty,unit_cost,unit").or(`from_branch_id.eq.${ctx.branch},to_branch_id.eq.${ctx.branch}`).order("id")),
 ]);
 if([branch,batches,inputs,runs,purchases,actions,reversals,transfers].some(r=>r.error))return{ok:false as const,error:"load"};
 return{ok:true as const,branchId:ctx.branch,branch:branch.data!.name,batches:batches.data as CostBatch[],inputs:inputs.data as CostInput[],runs:runs.data as CostRun[],purchases:purchases.data as CostPurchase[],actions:actions.data as {id:string;batch_id:string;action:string;qty:number;note:string;recorded_at:string}[],reversals:reversals.data as {id:string;run_id:string;reason:string;recorded_at:string}[],transfers:transfers.data as CostTransfer[],loadedAt:new Date().toISOString()};
}
