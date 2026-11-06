"use server";
import {inventoryScope} from "@/lib/inventory/scope";
import {uuid} from "@/lib/inventory/operations";
import type {ValuationSnapshot} from "@/lib/inventory/valuation-close";
export async function getInventoryValuation(){
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const [preview,closes,branch]=await Promise.all([ctx.db.rpc("inventory_valuation_preview",{p_branch:ctx.branch}),ctx.db.from("inventory_valuation_closes").select("id,snapshot,note,created_at").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).limit(50),ctx.db.from("branches").select("name").eq("id",ctx.branch).single()]);
 if(preview.error||closes.error||branch.error)return {ok:false as const};
 return {ok:true as const,branch:ctx.branch,branchName:branch.data!.name,preview:preview.data as ValuationSnapshot,closes:closes.data as {id:string;snapshot:ValuationSnapshot;note:string;created_at:string}[]};
}
export async function reviewBatchNetCost(id:string,batch:string,expected:number,cost:number,reference:string,note:string,reviewed:boolean){
 if(!uuid(id)||!uuid(batch)||!Number.isInteger(expected)||expected<0||!Number.isFinite(cost)||cost<0||cost>=1e9||typeof reference!=="string"||reference.trim().length<3||reference.length>300||typeof note!=="string"||note.trim().length<3||note.length>1000||reviewed!==true)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("review_batch_net_cost",{p_branch:ctx.branch,p_id:id,p_batch:batch,p_expected:expected,p_cost:cost,p_reference:reference,p_note:note,p_reviewed:reviewed});return {ok:!error};
}
export async function closeInventoryValuation(id:string,note:string,reviewed:boolean){
 if(!uuid(id)||typeof note!=="string"||note.trim().length<3||note.length>1000||reviewed!==true)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("close_inventory_valuation",{p_branch:ctx.branch,p_id:id,p_note:note,p_reviewed:reviewed});return {ok:!error};
}
