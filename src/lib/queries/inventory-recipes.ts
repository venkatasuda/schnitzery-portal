"use server";
import { inventoryScope as scope } from "@/lib/inventory/scope";
import { readAll } from "@/lib/supabase/readAll";
import { berlinToday } from "@/lib/time/berlinDate";
import { latestPrice } from "@/lib/analytics/coverage";
import { inventoryKey } from "@/lib/inventory/identity";
import { uuid } from "@/lib/inventory/operations";
import type { RecipeVersion } from "@/lib/inventory/recipes";
export async function getInventoryRecipes(){
 const ctx=await scope();if(!ctx)return{ok:false as const,error:"access"};
 const today=berlinToday(),from=new Date(Date.parse(`${today}T12:00:00Z`)-365*86400000).toISOString().slice(0,10);
 const [branch,products,recipes,purchases]=await Promise.all([
  ctx.db.from("branches").select("id,name").eq("id",ctx.branch).single(),
  readAll(ctx.db.from("inventory_master").select("id,product,category,unit").eq("branch_id",ctx.branch).eq("is_active",true).order("id")),
  ctx.db.from("inventory_recipe_versions").select("id,name,portions,net_price,ingredients,created_at,prices_net_confirmed").eq("branch_id",ctx.branch).order("created_at",{ascending:false}).limit(80),
  readAll(ctx.db.from("inventory_purchases").select("product,category,unit,qty,cost,purchase_date").eq("branch_id",ctx.branch).gte("purchase_date",from).lte("purchase_date",today).order("id")),
 ]);
 if(recipes.error?.code==="42P01"||recipes.error?.code==="PGRST205")return{ok:false as const,error:"migration"};
 if(branch.error||products.error||recipes.error||purchases.error)return{ok:false as const,error:"load"};
 const byKey=new Map<string,NonNullable<typeof purchases.data>>();
 for(const p of purchases.data??[]){const k=inventoryKey(p);byKey.set(k,[...(byKey.get(k)??[]),p]);}
 return{ok:true as const,branch:branch.data!,today,products:(products.data??[]).map(p=>({...p,price:latestPrice(byKey.get(inventoryKey(p))??[],today)})),recipes:(recipes.data??[]) as RecipeVersion[]};
}
export async function saveInventoryRecipe(branch:string,id:string,name:string,portions:number,netPrice:number|null,lines:{product_id:string;qty:number;unit:string}[],pricesNetConfirmed:boolean=false){
 if(typeof pricesNetConfirmed!=="boolean")return{ok:false as const,error:"invalid"};
 if(!uuid(branch)||!uuid(id)||typeof name!=="string"||!name.trim()||name.length>160||!Number.isFinite(portions)||portions<=0||portions>=1000000||(netPrice!==null&&(!Number.isFinite(netPrice)||netPrice<0||netPrice>=1000000))||!Array.isArray(lines)||!lines.length||lines.length>100||!lines.every(l=>l&&uuid(l.product_id)&&Number.isFinite(l.qty)&&l.qty>0&&typeof l.unit==="string"&&l.unit.trim().length>0&&l.unit.length<=30))return{ok:false as const,error:"invalid"};
 const ctx=await scope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
 const {error}=await ctx.db.rpc("save_inventory_recipe",{p_branch:branch,p_id:id,p_name:name,p_portions:portions,p_net_price:netPrice,p_lines:lines,p_prices_net_confirmed:pricesNetConfirmed});
 if(error)return{ok:false as const,error:(error.code==="23505"||error.code==="40001")?"conflict":"save"};
 return{ok:true as const};
}
