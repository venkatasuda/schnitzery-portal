"use server";

import { createClient } from "@/lib/supabase/server";
import { activeBranchFor, MULTI_BRANCH_ROLES } from "@/lib/activeBranch";
import { readAll } from "@/lib/supabase/readAll";
import { berlinToday } from "@/lib/time/berlinDate";
import { inventoryInsights, type InsightLine, type InsightReceipt, type InsightReceiptLine } from "@/lib/inventory/insights";
import { getInventoryAnalytics } from "@/lib/queries/inventory";

export async function getInventoryInsights(days: number = 30) {
  if (![7,30,90].includes(days)) return {ok:false as const,error:"period"};
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  if(!user)return{ok:false as const,error:"access"};
  const {data:me,error:profileError}=await db.from("users").select("role,branch_id,status").eq("id",user.id).single();
  if(profileError||!me||me.status!=="active"||!MULTI_BRANCH_ROLES.includes(me.role))return{ok:false as const,error:"access"};
  const branch=await activeBranchFor(db,me);
  if(!branch)return{ok:false as const,error:"branch"};
  const today=berlinToday(),at=(n:number)=>new Date(Date.parse(`${today}T12:00:00Z`)-n*86400000).toISOString().slice(0,10);
  const from=at(days-1),previousFrom=at(2*days-1),historyFrom=at(365);
  const [name,products,counts,purchases,waste,batches,orders,analytics]=await Promise.all([
    db.from("branches").select("id,name").eq("id",branch).single(),
    readAll(db.from("inventory_master").select("id,product,category,unit,soll,reorder_point,reorder_qty").eq("branch_id",branch).eq("is_active",true).order("id")),
    readAll(db.from("inventory_counts").select("product,category,unit,ist,count_date").eq("branch_id",branch).gte("count_date",historyFrom).lte("count_date",today).order("count_date").order("created_at").order("id")),
    readAll(db.from("inventory_purchases").select("product,category,unit,qty,cost,purchase_date,supplier").eq("branch_id",branch).gte("purchase_date",historyFrom).lte("purchase_date",today).order("id")),
    readAll(db.from("waste_log").select("product,category,unit,qty,work_date,reason").eq("branch_id",branch).gte("work_date",previousFrom).lte("work_date",today).order("id")),
    readAll(db.from("stock_batches").select("id,product,category,unit,qty,remaining_qty,expiry_date").eq("branch_id",branch).eq("status","active").order("id")),
    readAll(db.from("inventory_orders").select("id,supplier_id,supplier_name,reference,status,expected_date,created_at").eq("branch_id",branch).or(`status.in.(sent,partial),created_at.gte.${from}`).order("id")),
    getInventoryAnalytics(days-1),
  ]);
  if(name.error||products.error||counts.error||purchases.error||waste.error||batches.error||orders.error||!analytics.ok||!("totalUsageEur" in analytics))return{ok:false as const,error:"load"};
  // Chunk identifiers to stay below Data API URL limits. readAll prevents silent 1,000-row truncation.
  const lines:InsightLine[]=[],receipts:InsightReceipt[]=[],receiptLines:InsightReceiptLine[]=[];
  const ids=(orders.data??[]).map(o=>o.id);
  for(let offset=0;offset<ids.length;offset+=100){
    const part=ids.slice(offset,offset+100);
    const [l,r]=await Promise.all([
      readAll(db.from("inventory_order_lines").select("id,order_id,qty,received_qty,unit_price").in("order_id",part).order("id")),
      readAll(db.from("inventory_receipts").select("id,order_id,received_at").in("order_id",part).order("id")),
    ]);
    if(l.error||r.error)return{ok:false as const,error:"load"};
    lines.push(...(l.data??[]));receipts.push(...(r.data??[]));
  }
  for(let offset=0;offset<receipts.length;offset+=100){
    const rows=await readAll(db.from("inventory_receipt_lines").select("receipt_id,order_line_id,accepted,rejected").in("receipt_id",receipts.slice(offset,offset+100).map(r=>r.id)).order("id"));
    if(rows.error)return{ok:false as const,error:"load"};receiptLines.push(...(rows.data??[]));
  }
  return {ok:true as const,branch:name.data!,from,today,previousFrom,days,generatedAt:new Date().toISOString(),
    report:inventoryInsights({productionCostingIncomplete:analytics.productionCostingIncomplete,today,from,previousFrom,products:products.data??[],counts:counts.data??[],purchases:purchases.data??[],waste:waste.data??[],batches:batches.data??[],orders:orders.data??[],lines,receipts,receiptLines}),
    productionCostingIncomplete:analytics.productionCostingIncomplete??false,
    consumption:{value:analytics.totalUsageEur??null,complete:analytics.usageComplete??false,pct:analytics.cogsPct??null,span:analytics.usageSpan},
    sales:{value:analytics.totalSales??0,missingDays:analytics.missingSalesDays??0,enteredDays:analytics.salesDays},
  };
}
