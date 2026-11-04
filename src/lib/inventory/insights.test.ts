import { describe, expect, it } from "vitest";
import { inventoryInsights, inventoryInsightsCsv, type InsightPurchase } from "./insights";

const product={id:"p",product:"Oil",category:"Dry",unit:"l",soll:10};
const buy=(purchase_date:string,qty:number,cost:number,unit="l"):InsightPurchase=>({...product,purchase_date,qty,cost,unit});
const base={today:"2026-11-01",from:"2026-10-26",previousFrom:"2026-10-19",products:[product],counts:[],purchases:[],waste:[],batches:[],orders:[],lines:[],receipts:[],receiptLines:[]};
describe("owner inventory insights",()=>{
 it("values remaining batch quantities and flags unknown dates instead of assuming zero expiry exposure",()=>{
  const r=inventoryInsights({...base,purchases:[buy("2026-11-01",10,20)],batches:[{...product,id:"b",qty:10,remaining_qty:3,expiry_date:"2026-11-04"},{...product,id:"u",qty:5,remaining_qty:5,expiry_date:null}]});
  expect(r.expiryValue.value).toBe(6);expect(r.expiryValue.complete).toBe(false);expect(r.expiryValue.missing.counts).toBe(1);
 });
 it("keeps absent counts and prices unknown, never a zero-stock claim",()=>{
  const r=inventoryInsights(base);expect(r.stock[0].qty).toBeNull();expect(r.stock[0].value).toBeNull();expect(r.stockValue.complete).toBe(false);expect(r.stock[0].suggested).toBeNull();
 });
 it("prices latest-day purchases by quantity and never mixes units or future prices",()=>{
  const r=inventoryInsights({...base,counts:[{...product,ist:3,count_date:"2026-11-01"}],purchases:[buy("2026-10-20",1,2),buy("2026-10-31",1,4),buy("2026-10-31",3,6),buy("2026-10-31",1,100,"case"),buy("2026-11-02",1,999)]});
  expect(r.stock[0].price).toBe(2.5);expect(r.stockValue.value).toBe(7.5);expect(r.stock[0].priceChange).toBe(25);expect(r.stock[0].suggested).toBe(7);
 });
 it("values waste at its own date, including real zero cost, and flags missing prices",()=>{
  const r=inventoryInsights({...base,purchases:[buy("2026-10-20",1,2),buy("2026-11-01",1,5)],waste:[{...product,qty:2,work_date:"2026-10-27",reason:"spoilage"},{...product,unit:"kg",qty:1,work_date:"2026-10-28",reason:"spoilage"}]});
  expect(r.waste.figure).toEqual({value:4,complete:false,missing:{prices:1}});expect(r.waste.reasons[0].unpriced).toBe(1);
 });
 it("does not offer reorder quantities from stale physical counts",()=>{
  const r=inventoryInsights({...base,counts:[{...product,ist:0,count_date:"2026-10-29"}]});expect(r.stockValue.value).toBe(0);expect(r.stockValue.complete).toBe(true);expect(r.stock[0].fresh).toBe(false);expect(r.stock[0].suggested).toBeNull();
 });
 it("counts missing expiry prices without presenting incomplete exposure as zero",()=>{
  const r=inventoryInsights({...base,batches:[{...product,id:"b",qty:2,expiry_date:"2026-10-31"}]});expect(r.expiryValue.complete).toBe(false);expect(r.actions[0].kind).toBe("expiry");expect(r.actions[0].value).toBeNull();
 });
 it("compares equal period boundaries without including a purchase twice",()=>{
  const r=inventoryInsights({...base,purchases:[buy("2026-10-25",1,2),buy("2026-10-26",1,4),buy("2026-11-02",1,8)]});expect(r.spend.value).toBe(4);expect(r.previousSpend.value).toBe(2);
 });
 it("uses accepted receipt evidence for punctuality and line ratios across different units",()=>{
  const r=inventoryInsights({...base,orders:[{id:"o",supplier_id:"s",supplier_name:"Supplier",reference:"PO1",status:"partial",expected_date:"2026-10-30",created_at:"2026-10-26T00:00:00Z"}],lines:[{id:"l1",order_id:"o",qty:10,received_qty:10,unit_price:2},{id:"l2",order_id:"o",qty:100,received_qty:50,unit_price:null}],receipts:[{id:"r",order_id:"o",received_at:"2026-10-30T12:00:00Z"}],receiptLines:[{receipt_id:"r",order_line_id:"l1",accepted:10,rejected:0},{receipt_id:"r",order_line_id:"l2",accepted:50,rejected:50}]});
  expect(r.suppliers[0].fillPct).toBe(75);expect(r.suppliers[0].onTimePct).toBe(0);expect(r.suppliers[0].rejectionPct).toBe(25);expect(r.outstanding.complete).toBe(false);expect(r.overdue).toBe(1);
 });
 it("does not penalize a delivery whose deadline is still today",()=>{
  const r=inventoryInsights({...base,orders:[{id:"o",supplier_id:"s",supplier_name:"Supplier",reference:"PO1",status:"sent",expected_date:"2026-11-01",created_at:"2026-10-26T00:00:00Z"}]});expect(r.suppliers[0].onTimePct).toBeNull();expect(r.overdue).toBe(0);
 });
 it("flags an open order with missing line evidence as an incomplete commitment",()=>{
  const r=inventoryInsights({...base,orders:[{id:"o",supplier_id:"s",supplier_name:"Supplier",reference:"PO1",status:"sent",expected_date:null,created_at:"2026-10-26T00:00:00Z"}]});expect(r.outstanding.complete).toBe(false);
 });
 it("escapes CSV text and neutralizes spreadsheet formula prefixes",()=>{
  const r=inventoryInsights({...base,products:[{...product,product:' =HYPERLINK("x")\nOil'}]});
  const csv=inventoryInsightsCsv("Branch",base.from,base.today,r.stock);
  expect(csv).toContain('"\' =HYPERLINK(""x"")\nOil"');expect(csv).toContain('"last_count_qty"');
 });
});
