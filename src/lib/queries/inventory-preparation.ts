"use server";
import { inventoryScope } from "@/lib/inventory/scope";
import { readAll } from "@/lib/supabase/readAll";
import { uuid } from "@/lib/inventory/operations";
import { isCalendarDate } from "@/lib/time/berlinDate";
import type { RecipeVersion } from "@/lib/inventory/recipes";
import type { RecipeYield,PreparationPlan } from "@/lib/inventory/preparation";
const quantity=(v:number)=>typeof v==="number"&&Number.isFinite(v)&&v>=0&&v<1e9;
export async function getInventoryPreparation(day:string){
 if(!isCalendarDate(day)||day<"2000-01-01"||day>"2100-12-31")return{ok:false as const,error:"date"};
 const ctx=await inventoryScope();if(!ctx)return{ok:false as const,error:"access"};
 const [branch,recipes,yields,plans]=await Promise.all([
  ctx.db.from("branches").select("id,name").eq("id",ctx.branch).single(),
  readAll(ctx.db.from("inventory_recipe_versions").select("id,name,portions,net_price,ingredients,created_at").eq("branch_id",ctx.branch).order("id")),
  readAll(ctx.db.from("inventory_recipe_yields").select("id,recipe_id,output_qty,output_unit,losses,confirmed,note,created_at").eq("branch_id",ctx.branch).order("id")),
  readAll(ctx.db.from("inventory_preparation_plans").select("id,yield_id,plan_date,target_qty,reserve_qty,usable_qty,incoming_qty,created_at").eq("branch_id",ctx.branch).eq("plan_date",day).order("id")),
 ]);
 if(branch.error||recipes.error||yields.error||plans.error)return{ok:false as const,error:"load"};
 return{ok:true as const,branch:branch.data!,recipes:(recipes.data??[]) as RecipeVersion[],yields:(yields.data??[]) as RecipeYield[],plans:(plans.data??[]) as PreparationPlan[]};
}
export async function saveInventoryYield(branch:string,id:string,recipe:string,output:number,unit:string,losses:number[],confirmed:boolean,note:string){
 if(!uuid(branch)||!uuid(id)||!uuid(recipe)||!quantity(output)||output<=0||!["kg","l","pcs"].includes(unit)||!Array.isArray(losses)||losses.length<1||losses.length>100||!losses.every(quantity)||typeof confirmed!=="boolean"||typeof note!=="string"||note.length>1000)return{ok:false as const,error:"invalid"};
 const ctx=await inventoryScope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
 const {error}=await ctx.db.rpc("save_inventory_recipe_yield",{p_branch:branch,p_id:id,p_recipe:recipe,p_output:output,p_unit:unit,p_losses:losses,p_confirmed:confirmed,p_note:note});
 return error?{ok:false as const,error:error.code==="23505"?"conflict":"save"}:{ok:true as const};
}
export async function saveInventoryPreparation(branch:string,id:string,yieldId:string,day:string,target:number,reserve:number,usable:number,incoming:number){
 if(!uuid(branch)||!uuid(id)||!uuid(yieldId)||!isCalendarDate(day)||day<"2000-01-01"||day>"2100-12-31"||![target,reserve,usable,incoming].every(quantity))return{ok:false as const,error:"invalid"};
 const ctx=await inventoryScope();if(!ctx||ctx.branch!==branch)return{ok:false as const,error:"access"};
 const {error}=await ctx.db.rpc("save_inventory_preparation_plan",{p_branch:branch,p_id:id,p_yield:yieldId,p_date:day,p_target:target,p_reserve:reserve,p_usable:usable,p_incoming:incoming});
 return error?{ok:false as const,error:error.code==="23505"?"conflict":"save"}:{ok:true as const};
}
