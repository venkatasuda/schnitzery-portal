import {inventoryKey} from "./identity";
export type CostBatch={id:string;product:string;category:string|null;unit:string|null;qty:number;remaining_qty:number;purchase_id:string|null;production_id:string|null;transfer_lot_id?:string|null;expiry_date:string|null;lot_number:string;receipt_reference:string;status:string};
export type CostTransfer={id:string;transfer_id:string;source_batch_id:string;destination_batch_id:string|null;received_qty:number|null;unit_cost:number|null;unit:string|null};
export type CostInput={id:string;run_id:string;batch_id:string;product:string;category:string|null;unit:string;qty:number;planned_qty:number|null;unit_cost:number|null;cost_source:unknown};
export type CostRun={id:string;output_batch_id:string|null;product:string|null;unit:string|null;qty:number|null;expected_qty:number|null;status:string;reversed_at:string|null;production_date:string|null};
export type CostPurchase={id:string;product:string;category:string|null;unit:string|null;qty:number;cost:number|null;supplier:string;purchase_date:string};
export function batchCostReport(batches:CostBatch[],inputs:CostInput[],runs:CostRun[],purchases:CostPurchase[],transfers:CostTransfer[]=[]){
 const purchaseMap=new Map(purchases.map(p=>[p.id,p])),byRun=new Map<string,CostInput[]>();
 for(const i of inputs)byRun.set(i.run_id,[...(byRun.get(i.run_id)??[]),i]);
 const runMap=new Map(runs.map(r=>[r.id,r]));
 const transferMap=new Map(transfers.map(t=>[t.id,t]));
 const rows=batches.filter(b=>b.status==="active"&&Number(b.remaining_qty)>0).map(b=>{
  let price:number|null=null,source:"receipt"|"production"|"transfer"|"unknown"="unknown";
  const purchase=b.purchase_id?purchaseMap.get(b.purchase_id):null,run=b.production_id?runMap.get(b.production_id):null;
  if(purchase&&inventoryKey(purchase)===inventoryKey(b)&&Number.isFinite(Number(purchase.qty))&&Number(purchase.qty)>0&&purchase.cost!=null){price=Number(purchase.cost)/Number(purchase.qty);source="receipt";}
  else if(run&&run.status==="posted"&&!run.reversed_at&&Number(run.qty)>0){const lines=byRun.get(run.id)??[];if(lines.length&&lines.every(i=>i.unit_cost!=null&&Number.isFinite(Number(i.unit_cost))&&Number(i.unit_cost)>=0)){price=lines.reduce((n,i)=>n+Number(i.qty)*Number(i.unit_cost),0)/Number(run.qty);source="production";}}
  else if(b.transfer_lot_id){const lot=transferMap.get(b.transfer_lot_id);if(lot?.destination_batch_id===b.id&&lot.unit_cost!=null){price=Number(lot.unit_cost);source="transfer";}}
  if(price!=null&&(!Number.isFinite(price)||price<0)){price=null;source="unknown";}
  return{...b,price,source,value:price==null?null:price*Number(b.remaining_qty)};
 });
 return{rows,knownValue:rows.reduce((n,r)=>n+(r.value??0),0),unpriced:rows.filter(r=>r.value==null).length};
}
// Lot links are evidence, not a guess based on product names. Transfer links retain the source identifier even when that branch is outside this view.
export function batchTrace(id:string,batches:CostBatch[],inputs:CostInput[],runs:CostRun[],transfers:CostTransfer[]=[]){
 const runMap=new Map(runs.map(r=>[r.id,r]));
 const edges=[...inputs.flatMap(i=>{const run=runMap.get(i.run_id);return run?.output_batch_id&&!run.reversed_at?[{from:i.batch_id,to:run.output_batch_id,run:i.run_id,qty:i.qty,unit:i.unit}]:[];}),...transfers.flatMap(t=>t.destination_batch_id&&Number(t.received_qty)>0?[{from:t.source_batch_id,to:t.destination_batch_id,run:t.transfer_id,qty:Number(t.received_qty),unit:t.unit??""}]:[])];
 const walk=(direction:"from"|"to")=>{const links=new Map<string,string[]>();for(const e of edges){const from=e[direction],to=e[direction==="from"?"to":"from"];links.set(from,[...(links.get(from)??[]),to]);}const seen=new Set([id]),queue=[id];for(let at=0;at<queue.length;at++)for(const next of links.get(queue[at])??[])if(!seen.has(next)){seen.add(next);queue.push(next);}return seen;};
 const ancestors=walk("to"),descendants=walk("from"),known=new Set(batches.map(b=>b.id));
 return{ancestors:batches.filter(b=>b.id!==id&&ancestors.has(b.id)),descendants:batches.filter(b=>b.id!==id&&descendants.has(b.id)),ancestorRefs:[...ancestors].filter(x=>x!==id&&!known.has(x)),descendantRefs:[...descendants].filter(x=>x!==id&&!known.has(x)),edges:edges.filter(e=>e.from===id||e.to===id)};
}
