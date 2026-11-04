"use server";
import { inventoryScope } from "@/lib/inventory/scope";
import { readAll } from "@/lib/supabase/readAll";
import { uuid } from "@/lib/inventory/operations";
import type { ProductionRun, ProductionBatch, ProductionInput } from "@/lib/inventory/production";

export async function getInventoryProduction(selected?: string) {
  if (selected && !uuid(selected)) return {ok:false as const,error:"invalid"};
  const ctx = await inventoryScope();
  if (!ctx) return {ok:false as const,error:"access"};
  const [branch, products, batches, runs] = await Promise.all([
    ctx.db.from("branches").select("id,name").eq("id",ctx.branch).single(),
    readAll(ctx.db.from("inventory_master").select("id,product,category,unit").eq("branch_id",ctx.branch).eq("is_active",true).order("product").order("id")),
    readAll(ctx.db.from("stock_batches").select("id,product,category,unit,remaining_qty,expiry_date,received_date,lot_number").eq("branch_id",ctx.branch).eq("status","active").order("expiry_date",{ascending:true,nullsFirst:false}).order("id")),
    ctx.db.from("inventory_production_runs").select("*").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).order("id").limit(40),
  ]);
  if (branch.error || products.error || batches.error || runs.error) return {ok:false as const,error:"load"};
  let run: ProductionRun|null = null;
  let inputs: ProductionInput[] = [];
  if (selected) {
    const [record, lines] = await Promise.all([
      ctx.db.from("inventory_production_runs").select("*").eq("id",selected).eq("branch_id",ctx.branch).single(),
      readAll(ctx.db.from("inventory_production_inputs").select("id,batch_id,stock_action_id,product,category,unit,qty,planned_qty,unit_cost,cost_source").eq("run_id",selected).eq("branch_id",ctx.branch).order("id")),
    ]);
    if (record.error || lines.error) return {ok:false as const,error:"load"};
    run = record.data as ProductionRun; inputs = lines.data as ProductionInput[];
  }
  return {ok:true as const,branch:branch.data!,products:products.data as {id:string;product:string;category:string;unit:string|null}[],batches:batches.data as ProductionBatch[],runs:runs.data as ProductionRun[],run,inputs};
}

export async function reverseInventoryProduction(branch:string,run:string,command:string,reason:string,reviewed:boolean){
 if(!uuid(branch)||!uuid(run)||!uuid(command)||typeof reason!=="string"||reason.trim().length<3||reason.length>1000||reviewed!==true)return{ok:false as const,error:"invalid"};
 const ctx=await inventoryScope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
 const {error}=await ctx.db.rpc("reverse_inventory_production",{p_branch:branch,p_id:run,p_command:command,p_reason:reason,p_reviewed:reviewed});
 return error?{ok:false as const,error:"blocked"}:{ok:true as const};
}
