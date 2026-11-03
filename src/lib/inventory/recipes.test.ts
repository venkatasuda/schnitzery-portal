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
 const unknownPrice=recipeCost({...recipe,net_price:null},[{product:"Flour",category:"Dry",unit:"kg",price:4}]);
 expect(unknownPrice.perPortion).toBe(1);expect(unknownPrice.contribution).toBeNull();expect(unknownPrice.ingredientPct).toBeNull();
});
it("costs the supplied Metro salad examples without forcing rounded sheet totals or unconfirmed margins",()=>{
 const common:[string,number,string,number][]=[
  ["Carrots",700,"g",.90],["Vinegar",150,"ml",2.71],["Salt",100,"g",.54],
  ["Quark",2,"kg",2.26],["Yoghurt",2,"kg",2.12],["Mayonnaise",2,"kg",1.46],["Cream powder",40,"g",13.93],
 ];
 for(const red of [false,true]){
  const rows:[string,number,string,number][]=[["Cabbage",15,"kg",red?.82:.70],...common,...(red?[["Sugar",100,"g",1.39] as [string,number,string,number]]:[])];
  const ingredients=rows.map(([product,qty,unit])=>({product_id:product,product,category:"Example",unit:unit==="ml"?"l":"kg",qty:convertIngredient(qty,unit,unit==="ml"?"l":"kg")!,entered_qty:qty,entered_unit:unit}));
  const prices=rows.map(([product,,,price],i)=>({product,category:"Example",unit:ingredients[i].unit,price}));
  const result=recipeCost({...recipe,ingredients,portions:1,prices_net_confirmed:false},prices);
  expect(result.total.value).toBe(red?25.77:23.83);
  expect(result.contribution).toBeNull();
  const incomplete=recipeCost({...recipe,ingredients},prices.slice(1));
  expect(incomplete.total.complete).toBe(false);expect(incomplete.perPortion).toBeNull();expect(incomplete.contribution).toBeNull();
 }
});
