import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { account, admin, authenticatedPage, BASE_URL, BRANCH, openContexts, unique } from "./local";
import { berlinToday } from "../src/lib/time/berlinDate";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});
test("manual production resumes empty drafts, consumes batches once and creates linked finished stock",async({browser},info)=>{
  test.setTimeout(900_000);
  const db=admin(),raw=randomUUID(),finished=randomUUID(),batch=randomUUID(),rawName=unique("Production ingredient"),finishedName=unique("Prepared food");
  const day=(offset:number)=>new Date(Date.parse(berlinToday()+"T12:00:00Z")+offset*86400000).toISOString().slice(0,10);
  const products=await db.from("inventory_master").insert([{id:raw,branch_id:BRANCH.A,product:rawName,category:"E2E",unit:"kg",soll:5,is_active:true},{id:finished,branch_id:BRANCH.A,product:finishedName,category:"E2E",unit:"kg",soll:5,is_active:true}]);expect(products.error).toBeNull();
  const input=await db.from("stock_batches").insert({id:batch,branch_id:BRANCH.A,product:rawName,category:"E2E",unit:"kg",qty:5,expiry_date:day(7),received_date:day(0),note:"E2E verified existing ingredient stock",status:"active"});expect(input.error).toBeNull();
  try{
    const page=await authenticatedPage(browser,account("manager"));
    await page.goto("/inventory/production");await page.getByRole("button",{name:"New production draft",exact:true}).click();
    await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page.getByRole("heading",{name:"Saved production draft",exact:true})).toBeVisible();
    const run=new URL(page.url()).searchParams.get("run");expect(run).toBeTruthy();
    expect(Number((await db.from("stock_batches").select("remaining_qty").eq("id",batch).single()).data!.remaining_qty)).toBe(5);
    await page.reload();await expect(page.getByRole("heading",{name:"Saved production draft",exact:true})).toBeVisible();
    await expect(page.getByRole("button",{name:"Post production & stock movements",exact:true})).toBeDisabled();
    await page.getByRole("combobox",{name:"Finished-stock product",exact:true}).selectOption(finished);
    await page.getByLabel("Actual finished quantity (kg)",{exact:true}).fill("2");await page.getByLabel("Expected finished quantity (optional) (kg)",{exact:true}).fill("2.5");
    await page.getByLabel("Verified finished-batch expiry",{exact:true}).fill(day(5));await page.getByLabel("Finished-batch lot number (optional)",{exact:true}).fill("KITCHEN-TEST");
    await page.getByRole("button",{name:"Add ingredient batch",exact:true}).click();await page.getByRole("combobox",{name:"Ingredient batch 1",exact:true}).selectOption(batch);
    await page.getByLabel("Quantity withdrawn 1 (kg)",{exact:true}).fill("3");await page.getByLabel("Production review note",{exact:true}).fill("Actual weights and labels verified in kitchen");
    await page.getByRole("button",{name:"Save draft",exact:true}).click();await expect(page.getByRole("checkbox")).toBeEnabled();
    await page.setViewportSize({width:375,height:812});
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await info.attach("manual-production-draft-mobile",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
    await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Post production & stock movements",exact:true}).click();
    await expect(page.getByRole("heading",{name:`${finishedName} · Posted`,exact:true})).toBeVisible();
    await expect(page.getByText("-0.5 kg (-20%)",{exact:false})).toBeVisible();
    const balance=await db.from("stock_batches").select("remaining_qty").eq("id",batch).single();expect(balance.error).toBeNull();expect(Number(balance.data!.remaining_qty)).toBe(2);
    const output=await db.from("stock_batches").select("id,qty,purchase_id").eq("production_id",run!);expect(output.error).toBeNull();expect(output.data).toHaveLength(1);expect(Number(output.data![0].qty)).toBe(2);expect(output.data![0].purchase_id).toBeNull();
    const lines=await db.from("inventory_production_inputs").select("qty,batch_id,stock_action_id").eq("run_id",run!);expect(lines.error).toBeNull();expect(lines.data).toHaveLength(1);expect(Number(lines.data![0].qty)).toBe(3);expect(lines.data![0].batch_id).toBe(batch);expect(lines.data![0].stock_action_id).toBeTruthy();
    expect((await db.from("inventory_counts").select("id").eq("branch_id",BRANCH.A).in("product",[rawName,finishedName])).data).toHaveLength(0);
    await page.reload();await expect(page.getByRole("heading",{name:`${finishedName} · Posted`,exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Post production & stock movements",exact:true})).toHaveCount(0);
    const other=await authenticatedPage(browser,account("manager","B"));await other.goto(`/inventory/production?run=${run}`);await expect(other.getByRole("alert").filter({hasText:"Production data could not be loaded"})).toBeVisible();await expect(other.getByText(finishedName,{exact:true})).toHaveCount(0);
    const staff=await authenticatedPage(browser,account("staff"));await staff.goto(`/inventory/production?run=${run}`);await expect(staff.getByRole("alert").filter({hasText:"Production data could not be loaded"})).toBeVisible();
    const owner=await authenticatedPage(browser,account("brand_owner"));await owner.goto(`/inventory/production?run=${run}`);await expect(owner.getByRole("heading",{name:`${finishedName} · Posted`,exact:true})).toBeVisible();
    await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});await page.goto(`/inventory/production?run=${run}`);
    await expect(page.getByRole("heading",{name:`${finishedName} · Gebucht`,exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
    await info.attach("manual-production-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
    await page.getByRole("link",{name:"Fertigcharge ansehen",exact:true}).click();await expect(page.locator(`[data-batch="${output.data![0].id}"]`)).toBeVisible();
    await page.getByRole("link",{name:"Produktionsprotokoll",exact:true}).click();await expect(page.getByRole("heading",{name:`${finishedName} · Gebucht`,exact:true})).toBeVisible();
  }finally{
    // Immutable synthetic production and batch evidence remains in local staging.
    expect((await db.from("inventory_master").update({is_active:false}).in("id",[raw,finished])).error).toBeNull();
  }
});
