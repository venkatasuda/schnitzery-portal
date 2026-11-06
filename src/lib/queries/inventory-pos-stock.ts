"use server";
import {inventoryScope} from "@/lib/inventory/scope";
import {uuid} from "@/lib/inventory/operations";
import {readAll} from "@/lib/supabase/readAll";
import {validPosDaily,type PosDailyPayload} from "@/lib/sales/pos-ingest";
import {berlinToday} from "@/lib/time/berlinDate";
import type {RecipeVersion} from "@/lib/inventory/recipes";
export async function getPosStock(){
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const [connections,mappings,recipes,imports,posts,reversals,branch]=await Promise.all([
  ctx.db.from("pos_connections").select("id,name,enabled").eq("branch_id",ctx.branch).order("name"),
  readAll(ctx.db.from("pos_recipe_mappings").select("id,connection_id,sku,recipe_id,revision,note,created_at").eq("branch_id",ctx.branch).order("revision",{ascending:false}).order("created_at",{ascending:false}).order("id",{ascending:false})),
  readAll(ctx.db.from("inventory_recipe_versions").select("id,name,portions,net_price,ingredients,created_at").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).order("id")),
  ctx.db.from("pos_imports").select("id,connection_id,external_id,payload,status").eq("branch_id",ctx.branch).order("received_at",{ascending:false}).limit(50),
  ctx.db.from("pos_stock_posts").select("id,import_id,note,posted_at").eq("branch_id",ctx.branch).order("posted_at",{ascending:false}).limit(50),
  readAll(ctx.db.from("pos_stock_reversals").select("id,post_id,note,created_at").eq("branch_id",ctx.branch).order("id")),
  ctx.db.from("branches").select("name").eq("id",ctx.branch).single(),
 ]);
 if([connections,mappings,recipes,imports,posts,reversals,branch].some(r=>r.error))return {ok:false as const};
 return {ok:true as const,branch:ctx.branch,branchName:branch.data!.name,connections:connections.data!,mappings:mappings.data as {id:string;connection_id:string;sku:string;recipe_id:string|null;revision:number;note:string;created_at:string}[],recipes:recipes.data as RecipeVersion[],imports:imports.data as {id:string;connection_id:string;external_id:string;payload:PosDailyPayload;status:string}[],posts:posts.data as {id:string;import_id:string;note:string;posted_at:string}[],reversals:reversals.data as {id:string;post_id:string;note:string;created_at:string}[]};
}
export async function importPosExport(connection:string,text:string){
 if(!uuid(connection)||typeof text!=="string"||text.length>1_000_000)return {ok:false as const};
 let payload:unknown;try{payload=JSON.parse(text);}catch{return {ok:false as const};}
 if(!validPosDaily(payload,berlinToday()))return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("import_pos_export",{p_branch:ctx.branch,p_connection:connection,p_payload:payload});return {ok:!error};
}
export async function savePosRecipeMapping(id:string,connection:string,sku:string,recipe:string,note:string){
 if(!uuid(id)||!uuid(connection)||(recipe!=="no_stock"&&!uuid(recipe))||typeof sku!=="string"||!sku.trim()||sku.length>160||typeof note!=="string"||note.trim().length<3||note.length>1000)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("save_pos_recipe_mapping",{p_branch:ctx.branch,p_id:id,p_connection:connection,p_sku:sku,p_recipe:recipe==="no_stock"?null:recipe,p_note:note});return {ok:!error};
}
export async function postPosStock(id:string,command:string,mappings:Record<string,string>,note:string,reviewed:boolean){
 if(!uuid(id)||!uuid(command)||typeof mappings!=="object"||!mappings||Array.isArray(mappings)||Object.keys(mappings).length>2000||!Object.entries(mappings).every(([key,value])=>key.length>0&&key.length<=160&&uuid(value))||typeof note!=="string"||note.trim().length<3||note.length>1000||reviewed!==true)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("post_pos_stock",{p_branch:ctx.branch,p_import:id,p_command:command,p_mappings:mappings,p_note:note,p_reviewed:reviewed});return {ok:!error};
}
export async function reversePosStock(post:string,command:string,note:string,reviewed:boolean){
 if(!uuid(post)||!uuid(command)||typeof note!=="string"||note.trim().length<3||note.length>1000||reviewed!==true)return {ok:false as const};
 const ctx=await inventoryScope();if(!ctx)return {ok:false as const};
 const {error}=await ctx.db.rpc("reverse_pos_stock",{p_branch:ctx.branch,p_post:post,p_command:command,p_note:note,p_reviewed:reviewed});return {ok:!error};
}
