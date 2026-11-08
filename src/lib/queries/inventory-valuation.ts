"use server";
import {inventoryScope} from "@/lib/inventory/scope";
import {uuid} from "@/lib/inventory/operations";
import type {ValuationSnapshot} from "@/lib/inventory/valuation-close";
export async function getInventoryValuation(){
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const [preview,closes,branch]=await Promise.all([ctx.db.rpc("inventory_valuation_preview",{p_branch:ctx.branch}),ctx.db.from("inventory_valuation_closes").select("id,snapshot,note,created_at").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).limit(50),ctx.db.from("branches").select("name").eq("id",ctx.branch).single()]);
 if(preview.error||closes.error||branch.error)return {ok:false as const};
 // Suggested net cost per stock unit = delivery cost ÷ delivered quantity (Metro bills are net). Only a
 // suggestion: the manager still confirms it as a reviewed cost version. Unknown delivery cost → no suggestion.
 const snap=preview.data as ValuationSnapshot,ids=[...new Set(snap.lines.map(l=>l.batch_id))].slice(0,1000);
 const suggestions:Record<string,{cost:number;reference:string}>={};
 if(ids.length){
  const batches=await ctx.db.from("stock_batches").select("id,purchase_id,receipt_reference").eq("branch_id",ctx.branch).in("id",ids);
  const pids=[...new Set((batches.data??[]).map(b=>b.purchase_id).filter(Boolean))] as string[];
  const purchases=pids.length?await ctx.db.from("inventory_purchases").select("id,cost,qty").eq("branch_id",ctx.branch).in("id",pids):{data:[],error:null};
  const byId=new Map((purchases.data??[]).map(p=>[p.id as string,p]));
  for(const b of batches.data??[]){const p=b.purchase_id?byId.get(b.purchase_id):undefined;
   if(p&&p.cost!=null&&Number(p.qty)>0)suggestions[b.id]={cost:Math.round(Number(p.cost)/Number(p.qty)*10000)/10000,reference:String(b.receipt_reference??"")};}
 }
 return {ok:true as const,branch:ctx.branch,branchName:branch.data!.name,preview:snap,suggestions,closes:closes.data as {id:string;snapshot:ValuationSnapshot;note:string;created_at:string}[]};
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
