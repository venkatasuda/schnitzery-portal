"use server";
import {inventoryScope} from "@/lib/inventory/scope";
import {uuid} from "@/lib/inventory/operations";
import type {PosDailyPayload} from "@/lib/sales/pos-ingest";
export async function getPosPipeline(){
 const ctx=await inventoryScope();if(!ctx)return{ok:false as const,error:"access"};
 const [branch,connections,imports]=await Promise.all([ctx.db.from("branches").select("name").eq("id",ctx.branch).single(),ctx.db.from("pos_connections").select("id,name,enabled").eq("branch_id",ctx.branch).order("created_at",{ascending:false}),ctx.db.from("pos_imports").select("id,connection_id,external_id,payload,status,received_at,review_note").eq("branch_id",ctx.branch).order("received_at",{ascending:false}).limit(50)]);
 if(branch.error||connections.error||imports.error)return{ok:false as const,error:"load"};
 let keys:Record<string,unknown>={};try{keys=JSON.parse(process.env.POS_INGEST_KEYS??"{}");if(!keys||typeof keys!=="object")keys={};}catch{/* A missing connector secret leaves ingestion disabled. */}
 return{ok:true as const,branchId:ctx.branch,branch:branch.data!.name,connections:connections.data!.map(c=>({...c,credentialsConfigured:typeof keys[c.id]==="string"&&(keys[c.id] as string).length>=32})),imports:imports.data as {id:string;connection_id:string;external_id:string;payload:PosDailyPayload;status:string;received_at:string;review_note:string|null}[]};
}
export async function configurePosConnection(id:string,name:string,enabled:boolean){
 if(!uuid(id)||typeof name!=="string"||!name.trim()||name.length>160||typeof enabled!=="boolean")return{ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return{ok:false as const};
 const {error}=await ctx.db.rpc("configure_pos_connection",{p_branch:ctx.branch,p_id:id,p_name:name,p_enabled:enabled});return{ok:!error};
}
export async function reviewPosImport(id:string,approve:boolean,note:string){
 if(!uuid(id)||typeof approve!=="boolean"||typeof note!=="string"||note.trim().length<3||note.length>1000)return{ok:false as const,error:"invalid"};
 const ctx=await inventoryScope();if(!ctx)return{ok:false as const,error:"access"};
 const {error}=await ctx.db.rpc("review_pos_import",{p_branch:ctx.branch,p_id:id,p_approve:approve,p_note:note});return error?{ok:false as const,error:error.code==="23505"?"conflict":"save"}:{ok:true as const};
}
