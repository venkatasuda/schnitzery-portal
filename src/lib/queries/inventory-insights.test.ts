import { beforeEach, expect, it, vi } from "vitest";

const state=vi.hoisted(()=>({role:"manager",status:"active",branch:"branch-a" as string|null,fail:"",calls:[] as {table:string;column:string;value:unknown}[]}));
vi.mock("@/lib/supabase/server",()=>({createClient:async()=>({
 auth:{getUser:async()=>({data:{user:{id:"u"}}})},
 from:(table:string)=>{
  const q={select:()=>q,eq:(column:string,value:unknown)=>{state.calls.push({table,column,value});return q;},gte:()=>q,lte:()=>q,or:()=>q,order:()=>q,in:()=>q,
   single:async()=>table==="users"?{data:{role:state.role,status:state.status,branch_id:"home"},error:null}:{data:{id:"branch-a",name:"Branch A"},error:null},
   range:async()=>({data:[],error:state.fail===table?{message:"database unavailable"}:null})};return q;
 },
})}));
vi.mock("@/lib/activeBranch",()=>({MULTI_BRANCH_ROLES:["manager","branch_owner","brand_owner","super_admin"],activeBranchFor:async()=>state.branch}));
vi.mock("@/lib/queries/inventory",()=>({getInventoryAnalytics:async()=>({ok:true,totalUsageEur:null,usageComplete:false,cogsPct:null,usageSpan:null,totalSales:0,missingSalesDays:0,salesDays:0})}));
import { getInventoryInsights } from "./inventory-insights";

beforeEach(()=>{state.role="manager";state.status="active";state.branch="branch-a";state.fail="";state.calls=[];});
it("rejects invalid periods before touching data",async()=>{expect(await getInventoryInsights(365)).toEqual({ok:false,error:"period"});expect(state.calls).toHaveLength(0);});
it("denies staff and inactive managers",async()=>{
 state.role="staff";expect(await getInventoryInsights()).toEqual({ok:false,error:"access"});expect(state.calls.every(c=>c.table==="users")).toBe(true);
 state.role="manager";state.status="inactive";expect(await getInventoryInsights()).toEqual({ok:false,error:"access"});
});
it("requires a validated active branch",async()=>{state.branch=null;expect(await getInventoryInsights()).toEqual({ok:false,error:"branch"});expect(state.calls.every(c=>c.table==="users")).toBe(true);});
it("scopes every root dataset to the validated branch and keeps empty input explicit",async()=>{
 const r=await getInventoryInsights();expect(r.ok).toBe(true);
 for(const table of ["inventory_master","inventory_counts","inventory_purchases","waste_log","stock_batches","inventory_orders"]){expect(state.calls).toContainEqual({table,column:"branch_id",value:"branch-a"});}
 if(r.ok){expect(r.report.coverage.products).toBe(0);expect(r.consumption.value).toBeNull();expect(r.sales.enteredDays).toBe(0);}
});
it("returns an error when a source fails rather than replacing it with zero",async()=>{state.fail="waste_log";expect(await getInventoryInsights()).toEqual({ok:false,error:"load"});});
