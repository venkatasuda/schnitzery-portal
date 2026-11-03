import type { RecipeIngredient } from "./recipes";
export type RecipeYield={id:string;recipe_id:string;output_qty:number;output_unit:string;losses:number[];confirmed:boolean;note:string;created_at:string};
export type PreparationPlan={id:string;yield_id:string;plan_date:string;target_qty:number;reserve_qty:number;usable_qty:number;incoming_qty:number;created_at:string};
export function preparationNeeds(yieldInfo:Pick<RecipeYield,"output_qty"|"confirmed"|"losses">,ingredients:RecipeIngredient[],target:number,reserve:number,usable:number,incoming:number){
 if(!yieldInfo.confirmed||!Number.isFinite(yieldInfo.output_qty)||yieldInfo.output_qty<=0||![target,reserve,usable,incoming].every(n=>Number.isFinite(n)&&n>=0&&n<1e9)||yieldInfo.losses.length!==ingredients.length||!ingredients.length||!ingredients.every((i,index)=>Number.isFinite(i.qty)&&i.qty>0&&Number.isFinite(yieldInfo.losses[index])&&yieldInfo.losses[index]>=0&&yieldInfo.losses[index]<=i.qty))return null;
 const required=Math.max(0,target+reserve-usable-incoming),ratio=required/yieldInfo.output_qty;
 // Absorb floating-point arithmetic noise only; do not round real partial batches down.
 const nearest=Math.round(ratio),batches=Math.ceil(nearest>=1&&Math.abs(ratio-nearest)<=Number.EPSILON*Math.max(1,ratio)*4?nearest:ratio);
 if(!Number.isFinite(batches)||batches>1e6)return null;
 return{required,batches,prepared:batches*yieldInfo.output_qty,excess:Math.max(0,batches*yieldInfo.output_qty-required),ingredients:ingredients.map((i,index)=>({...i,raw:i.qty*batches,trim:yieldInfo.losses[index]*batches,usable:(i.qty-yieldInfo.losses[index])*batches}))};
}
