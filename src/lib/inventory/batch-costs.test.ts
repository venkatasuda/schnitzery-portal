import {expect,it} from "vitest";
import {batchCostReport,batchTrace,type CostBatch,type CostInput,type CostRun} from "./batch-costs";
it("values only documented batches and traces transitive production without reversed runs",()=>{
 const batch=(id:string,production_id:string|null=null):CostBatch=>({id,product:id,category:"Food",unit:"kg",qty:10,remaining_qty:5,purchase_id:id==="raw"?"receipt":null,production_id,expiry_date:null,lot_number:id,receipt_reference:"",status:"active"});
 const batches=[batch("raw"),batch("prepared","run1"),batch("finished","run2"),batch("unknown")];
 const run=(id:string,output:string):CostRun=>({id,output_batch_id:output,product:output,unit:"kg",qty:10,expected_qty:10,status:"posted",reversed_at:null,production_date:"2026-01-01"});
 const runs=[run("run1","prepared"),run("run2","finished")];
 const line=(id:string,run_id:string,batch_id:string):CostInput=>({id,run_id,batch_id,product:batch_id,category:"Food",unit:"kg",qty:2,planned_qty:1,unit_cost:3,cost_source:{}});
 const inputs=[line("i1","run1","raw"),line("i2","run2","prepared")];
 const report=batchCostReport(batches,inputs,runs,[{id:"receipt",product:"raw",category:"Food",unit:"kg",qty:10,cost:20,supplier:"Example",purchase_date:"2026-01-01"}]);
 expect(report.knownValue).toBe(16);expect(report.unpriced).toBe(1);
 expect(batchTrace("raw",batches,inputs,runs).descendants.map(b=>b.id)).toEqual(["prepared","finished"]);
 expect(batchTrace("finished",batches,inputs,runs).ancestors.map(b=>b.id)).toEqual(["raw","prepared"]);
 runs[0].reversed_at="2026-01-02";expect(batchTrace("raw",batches,inputs,runs).descendants).toEqual([]);
 inputs[1].unit_cost=null;expect(batchCostReport(batches,inputs,runs,[]).rows.find(r=>r.id==="finished")?.value).toBeNull();
});
