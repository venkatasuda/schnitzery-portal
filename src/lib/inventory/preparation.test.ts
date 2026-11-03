import { expect,it } from "vitest";
import { preparationNeeds } from "./preparation";
const ingredient={product_id:"p",product:"Parmesan",category:"Dairy",qty:2.4,unit:"kg",entered_qty:2.4,entered_unit:"kg"};
const yieldInfo={output_qty:2,confirmed:true,losses:[.4]};
it("plans Parmesan from usable output, carries reserve once and keeps trim separate",()=>{
 const result=preparationNeeds(yieldInfo,[ingredient],4,2,1,1)!;
 expect(result.required).toBe(4);expect(result.batches).toBe(2);expect(result.prepared).toBe(4);
 expect(result.ingredients[0].raw).toBe(4.8);expect(result.ingredients[0].trim).toBe(.8);expect(result.ingredients[0].usable).toBe(4);
 expect(preparationNeeds(yieldInfo,[ingredient],4,2,6,0)?.batches).toBe(0);
 expect(preparationNeeds(yieldInfo,[ingredient],5,0,0,0)?.excess).toBe(1);
 expect(preparationNeeds({...yieldInfo,output_qty:.1},[ingredient],.1,.2,0,0)?.batches).toBe(3);
 expect(preparationNeeds({...yieldInfo,output_qty:.1},[ingredient],.300001,0,0,0)?.batches).toBe(4);
 expect(preparationNeeds({...yieldInfo,output_qty:1e8},[ingredient],1e-10,0,0,0)?.batches).toBe(1);
});
it("withholds unconfirmed, invalid or excessive plans and rejects impossible trimming",()=>{
 expect(preparationNeeds({...yieldInfo,confirmed:false},[ingredient],4,0,0,0)).toBeNull();
 for(const n of [NaN,Infinity,-1,1e9])expect(preparationNeeds(yieldInfo,[ingredient],n,0,0,0)).toBeNull();
 for(const losses of [[],[3],[-1],[NaN]])expect(preparationNeeds({...yieldInfo,losses},[ingredient],4,0,0,0)).toBeNull();
 expect(preparationNeeds({...yieldInfo,output_qty:.000001},[ingredient],100,0,0,0)).toBeNull();
});
