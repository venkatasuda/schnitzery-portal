import { expect,it } from "vitest";
import { convertIngredient,recipeCost, type RecipeVersion } from "./recipes";
it("converts only explicit compatible units",()=>{
 expect(convertIngredient(250,"g","kg")).toBe(.25);expect(convertIngredient(500,"ml","l")).toBe(.5);expect(convertIngredient(2,"Stk.","pcs")).toBe(2);
 expect(convertIngredient(2,"kg","l")).toBeNull();expect(convertIngredient(1,"case","kg")).toBeNull();expect(convertIngredient(0,"g","kg")).toBeNull();expect(convertIngredient(Infinity,"g","kg")).toBeNull();
 expect(convertIngredient(1,"constructor","__proto__")).toBeNull();
});
const recipe:RecipeVersion={id:"r",name:"Dish",portions:2,net_price:10,prices_net_confirmed:true,created_at:"2026-11-01T12:00:00Z",ingredients:[{product_id:"p",product:"Flour",category:"Dry",unit:"kg",qty:.5,entered_qty:500,entered_unit:"g"}]};
it("prices the saved base-unit snapshot and separates ingredient contribution from profit",()=>{
 const r=recipeCost(recipe,[{product:"Flour",category:"Dry",unit:"kg",price:4}]);expect(r.total.value).toBe(2);expect(r.perPortion).toBe(1);expect(r.contribution).toBe(9);expect(r.ingredientPct).toBe(10);
});
it("withholds margins when a price or compatible identity is missing",()=>{
 const r=recipeCost(recipe,[{product:"Flour",category:"Dry",unit:"case",price:4}]);expect(r.total.complete).toBe(false);expect(r.perPortion).toBeNull();expect(r.contribution).toBeNull();
 expect(recipeCost({...recipe,portions:0},[]).perPortion).toBeNull();
});
it("retains sub-cent ingredient precision until display",()=>{
 const r=recipeCost(recipe,[{product:"Flour",category:"Dry",unit:"kg",price:.0125}]);expect(r.perPortion).toBe(.003125);
});
it("withholds contribution when the purchase-price VAT basis is unconfirmed",()=>{
 expect(recipeCost({...recipe,prices_net_confirmed:false},[{product:"Flour",category:"Dry",unit:"kg",price:4}]).contribution).toBeNull();
});
