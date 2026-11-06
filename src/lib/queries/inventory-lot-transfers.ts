"use server";
import { inventoryScope } from "@/lib/inventory/scope";
import { uuid } from "@/lib/inventory/operations";
import { readAll } from "@/lib/supabase/readAll";
import {berlinToday} from "@/lib/time/berlinDate";

export type TransferLot = {id:string;source_batch_id:string;destination_batch_id:string|null;lot_number:string;expiry_date:string|null;sent_qty:number;received_qty:number|null;unit_cost:number|null};
export type TransferBatch = {id:string;lot_number:string;expiry_date:string|null;remaining_qty:number};
export async function getLotTransfer(id:string){
 if(!uuid(id))return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const row=await ctx.db.from("stock_transfers").select("id,from_branch_id,to_branch_id,product,category,unit,qty,status").eq("id",id).or(`from_branch_id.eq.${ctx.branch},to_branch_id.eq.${ctx.branch}`).single();
 if(row.error)return {ok:false as const};
 const lots=await ctx.db.from("inventory_transfer_lots").select("id,source_batch_id,destination_batch_id,lot_number,expiry_date,sent_qty,received_qty,unit_cost").eq("transfer_id",id).order("id");
 if(lots.error)return {ok:false as const};
 const batches=row.data.from_branch_id===ctx.branch&&row.data.status==="requested"?await readAll(ctx.db.from("stock_batches").select("id,lot_number,expiry_date,remaining_qty,category,unit").eq("branch_id",ctx.branch).eq("product",row.data.product).eq("status","active").or(`expiry_date.is.null,expiry_date.gte.${berlinToday()}`).order("expiry_date",{nullsFirst:false}).order("id")):{data:[],error:null};
 if(batches.error)return {ok:false as const};
 return {ok:true as const,branch:ctx.branch,transfer:row.data,lots:lots.data as TransferLot[],batches:(batches.data??[]).filter(b=>b.category===row.data.category&&String(b.unit??"").trim().toLowerCase()===String(row.data.unit??"").trim().toLowerCase()) as TransferBatch[]};
}
export async function postLotTransfer(id:string,command:string,action:"send"|"receive",lines:{id:string;qty:number}[],note:string){
 if(!uuid(id)||!uuid(command)||!["send","receive"].includes(action)||!Array.isArray(lines)||!lines.length||lines.length>100||new Set(lines.map(x=>x?.id)).size!==lines.length||!lines.every(x=>x&&uuid(x.id)&&Number.isFinite(x.qty)&&x.qty>=0&&x.qty<1e9)||typeof note!=="string"||note.trim().length<3||note.length>1000)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("post_lot_transfer",{p_branch:ctx.branch,p_transfer:id,p_command:command,p_action:action,p_lines:lines,p_note:note.trim()});
 return {ok:!error};
}
