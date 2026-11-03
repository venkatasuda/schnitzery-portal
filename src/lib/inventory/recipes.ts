import { inventoryKey } from "./identity";
import { figure } from "../analytics/coverage";
export type RecipeIngredient={product_id:string;product:string;category:string;unit:string;qty:number;entered_qty:number;entered_unit:string};
export type RecipeVersion={id:string;name:string;portions:number;net_price:number|null;ingredients:RecipeIngredient[];created_at:string;prices_net_confirmed?:boolean};
const units:Record<string,[string,number]>={g:["mass",1],kg:["mass",1000],ml:["volume",1],l:["volume",1000],pcs:["count",1],stk:["count",1],"stk.":["count",1],piece:["count",1]};
export function convertIngredient(qty:number,from:string,to:string):number|null{
 const f=from.trim().toLowerCase(),t=to.trim().toLowerCase();if(!Number.isFinite(qty)||qty<=0||!f||!t)return null;
 if(f===t)return qty;
 const a=Object.hasOwn(units,f)?units[f]:null,b=Object.hasOwn(units,t)?units[t]:null;return a&&b&&a[0]===b[0]?qty*a[1]/b[1]:null;
}
export function recipeCost(recipe:RecipeVersion,prices:{product:string;category?:string|null;unit?:string|null;price:number|null}[]){
 const map=new Map(prices.map(p=>[inventoryKey(p),p.price]));
 const lines=recipe.ingredients.map(i=>{const price=map.get(inventoryKey(i));return{...i,cost:price!=null&&Number.isFinite(price)&&price>=0&&Number.isFinite(i.qty)&&i.qty>0?i.qty*price:null};});
 const rawTotal=lines.reduce((n,l)=>n+(l.cost??0),0);
 const total=figure(rawTotal,{prices:lines.filter(l=>l.cost==null).length});
 const validPortions=Number.isFinite(recipe.portions)&&recipe.portions>0;
 const perPortion=total.complete&&validPortions?rawTotal/recipe.portions:null;
 return{lines,total,perPortion,contribution:recipe.prices_net_confirmed&&perPortion!=null&&recipe.net_price!=null&&Number.isFinite(recipe.net_price)&&recipe.net_price>=0?recipe.net_price-perPortion:null,ingredientPct:recipe.prices_net_confirmed&&perPortion!=null&&recipe.net_price!=null&&recipe.net_price>0?perPortion/recipe.net_price*100:null};
}
