"use server";
import { inventoryScope } from "@/lib/inventory/scope";
import { readAll } from "@/lib/supabase/readAll";
import { uuid } from "@/lib/inventory/operations";
import { validPriceBody, validPriceReference, type PriceVersion, type PriceReference } from "@/lib/inventory/prices";
export async function getInventoryPrices(){
  const ctx=await inventoryScope();if(!ctx)return{ok:false as const,error:"access"};
  const [branch,products,versions,imports]=await Promise.all([
    ctx.db.from("branches").select("id,name").eq("id",ctx.branch).single(),
    readAll(ctx.db.from("inventory_master").select("id,product,category,unit").eq("branch_id",ctx.branch).eq("is_active",true).order("product").order("id")),
    readAll(ctx.db.from("inventory_price_versions").select("*").eq("branch_id",ctx.branch).order("effective_date",{ascending:false}).order("revision",{ascending:false}).order("id")),
    readAll(ctx.db.from("inventory_price_imports").select("id,name,rows,created_at").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).order("id")),
  ]);
  if(branch.error||products.error||versions.error||imports.error)return{ok:false as const,error:"load"};
  return{ok:true as const,branch:branch.data!,products:products.data as {id:string;product:string;category:string;unit:string|null}[],versions:versions.data as PriceVersion[],imports:imports.data as {id:string;name:string;rows:PriceReference[];created_at:string}[]};
}
export async function importInventoryPrices(branch:string,id:string,name:string,rows:unknown){
  if(!uuid(branch)||!uuid(id)||typeof name!=="string"||!name.trim()||name.length>160||!Array.isArray(rows)||!rows.length||rows.length>500||!rows.every(validPriceReference)||JSON.stringify(rows).length>1_000_000)return{ok:false as const,error:"invalid"};
  const ctx=await inventoryScope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
  const {data,error}=await ctx.db.rpc("import_inventory_prices",{p_branch:branch,p_id:id,p_name:name,p_rows:rows});
  return error?{ok:false as const,error:error.code==="23505"?"conflict":"save"}:{ok:true as const,id:data as string};
}
export async function saveInventoryPrice(branch:string,id:string,product:string,expected:number,body:unknown){
  if(!uuid(branch)||!uuid(id)||!uuid(product)||!Number.isInteger(expected)||expected<0||!validPriceBody(body))return{ok:false as const,error:"invalid"};
  const ctx=await inventoryScope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
  const {data,error}=await ctx.db.rpc("save_inventory_price",{p_branch:branch,p_id:id,p_product:product,p_expected:expected,p_body:body});
  return error?{ok:false as const,error:error.code==="23505"?"conflict":"save"}:{ok:true as const,id:data as string};
}
