import { randomUUID } from "node:crypto";
import { test,expect } from "@playwright/test";
import { account,admin,authenticatedPage,BASE_URL,BRANCH,openContexts,unique } from "./local";
import { berlinToday } from "../src/lib/time/berlinDate";
test.afterEach(async()=>{for(const c of openContexts.splice(0))await c.close();});
test("direct delivery creates expiry splits once, tracks partial use/waste and resolves missing label evidence",async({browser},info)=>{
 test.setTimeout(900_000);
 const db=admin(),product=randomUUID(),name=unique("Received milk"),invoice=unique("Delivery"),secondInvoice=unique("Unknown expiry");
 const day=(add:number)=>new Date(Date.parse(berlinToday()+"T12:00:00Z")+add*86400000).toISOString().slice(0,10);
 const seeded=await db.from("inventory_master").insert({id:product,branch_id:BRANCH.A,product:name,category:"E2E",unit:"kg",soll:10,is_active:true});expect(seeded.error).toBeNull();
 try{
  const page=await authenticatedPage(browser,account("manager"));
  await page.goto("/inventory/purchasing?receive=1");let dialog=page.getByRole("dialog",{name:"Receive a delivery",exact:true});
  await dialog.getByRole("combobox",{name:"Supplier",exact:true}).fill("E2E Metro");
  await dialog.getByLabel("Invoice / delivery reference",{exact:true}).fill(invoice);
  await dialog.getByRole("combobox",{name:"Product 1",exact:true}).selectOption(product);
  await dialog.getByLabel("Accepted quantity 1 (kg)",{exact:true}).fill("5");
  await dialog.getByLabel("Rejected quantity 1",{exact:true}).fill("1");await dialog.getByLabel("Rejection reason / note 1",{exact:true}).fill("Damaged on arrival");
  await dialog.getByLabel("Accepted line cost (€) 1",{exact:true}).fill("10");
  await dialog.getByLabel(`Batch quantity 1: ${name} (kg)`,{exact:true}).fill("2");
  await dialog.getByLabel(`Expiry date 1: ${name}`,{exact:true}).fill(day(1));await dialog.getByLabel(`Lot number (if shown) 1: ${name}`,{exact:true}).fill("EARLY");
  await dialog.getByRole("button",{name:"Add another expiry batch",exact:true}).click();
  await dialog.getByLabel(`Expiry date 2: ${name}`,{exact:true}).fill(day(10));await dialog.getByLabel(`Lot number (if shown) 2: ${name}`,{exact:true}).fill("LATER");
  await dialog.getByRole("checkbox",{name:/I checked quantities, label dates/}).check();await dialog.getByRole("button",{name:"Post delivery",exact:true}).click();await expect(dialog).toBeHidden({timeout:120_000});
  const purchases=await db.from("inventory_purchases").select("id,qty,cost").eq("branch_id",BRANCH.A).eq("product",name);expect(purchases.error).toBeNull();expect(purchases.data).toHaveLength(1);expect(Number(purchases.data![0].qty)).toBe(5);
  const batches=await db.from("stock_batches").select("id,qty,remaining_qty,lot_number").eq("purchase_id",purchases.data![0].id).order("expiry_date");expect(batches.error).toBeNull();expect(batches.data).toHaveLength(2);expect(batches.data!.map(b=>Number(b.qty))).toEqual([2,3]);
  const counts=await db.from("inventory_counts").select("id").eq("branch_id",BRANCH.A).eq("product",name);expect(counts.error).toBeNull();expect(counts.data).toHaveLength(0);
  await page.goto(`/expiry?search=${encodeURIComponent(invoice)}`);await expect(page.locator("[data-batch]")).toHaveCount(2,{timeout:120_000});
  expect(await page.locator("[data-batch]").first().getAttribute("data-batch")).toBe(batches.data![0].id);
  const first=page.locator(`[data-batch="${batches.data![0].id}"]`);
  await first.getByRole("button",{name:"Record use",exact:true}).click();dialog=page.getByRole("dialog",{name:"Record use",exact:true});await dialog.getByLabel("Quantity (kg)",{exact:true}).fill("0.5");await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();await expect(first).toContainText("1.5 kg remaining");
  await first.getByRole("button",{name:"Record waste",exact:true}).click();dialog=page.getByRole("dialog",{name:"Record waste",exact:true});await dialog.getByLabel("Quantity (kg)",{exact:true}).fill("0.5");await dialog.getByLabel("Reason / note",{exact:true}).fill("Damaged packaging");await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();await expect(first).toContainText("1 kg remaining");
  const waste=await db.from("waste_log").select("qty").eq("branch_id",BRANCH.A).eq("product",name);expect(waste.error).toBeNull();expect(waste.data).toHaveLength(1);expect(Number(waste.data![0].qty)).toBe(.5);
  await page.goto("/inventory/purchasing?receive=1");dialog=page.getByRole("dialog",{name:"Receive a delivery",exact:true});await dialog.getByRole("combobox",{name:"Supplier",exact:true}).fill("E2E Metro");await dialog.getByLabel("Invoice / delivery reference",{exact:true}).fill(secondInvoice);await dialog.getByRole("combobox",{name:"Product 1",exact:true}).selectOption(product);await dialog.getByLabel("Accepted quantity 1 (kg)",{exact:true}).fill("1");await dialog.getByLabel(`Reason expiry is unavailable / not applicable 1: ${name}`,{exact:true}).fill("Label unreadable; awaiting confirmation");await dialog.getByRole("checkbox",{name:/I checked quantities, label dates/}).check();await dialog.getByRole("button",{name:"Post delivery",exact:true}).click();await expect(dialog).toBeHidden({timeout:120_000});
  await page.goto(`/expiry?search=${encodeURIComponent(secondInvoice)}`);await expect(page.locator("[data-batch]")).toHaveCount(1,{timeout:120_000});await expect(page.getByText("Expiry unknown — check label",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Record labelled expiry",exact:true}).click();dialog=page.getByRole("dialog",{name:"Record labelled expiry",exact:true});await dialog.getByLabel("Label expiry date",{exact:true}).fill(day(5));await dialog.getByLabel("Evidence / reason",{exact:true}).fill("Confirmed label on physical packaging");await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();await expect(page.getByRole("button",{name:"Record labelled expiry",exact:true})).toHaveCount(0);await expect(page.getByText("1 kg remaining",{exact:true})).toBeVisible();
  const unknownCost=await db.from("inventory_purchases").select("cost").eq("branch_id",BRANCH.A).eq("product",name).is("cost",null);expect(unknownCost.error).toBeNull();expect(unknownCost.data).toHaveLength(1);
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});await page.goto(`/expiry?search=${encodeURIComponent(invoice)}`);await expect(page.locator("[data-batch]")).toHaveCount(2,{timeout:120_000});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);await info.attach("receiving-batches-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  const other=await authenticatedPage(browser,account("manager","B"));await other.goto(`/expiry?search=${encodeURIComponent(invoice)}`);await expect(other.getByRole("button",{name:"Refresh",exact:true})).toBeEnabled();await expect(other.getByText("No batches match. An empty register does not prove there is no physical stock.",{exact:true})).toBeVisible();await expect(other.locator("[data-batch]")).toHaveCount(0);
 }finally{
  // Audited receipt/purchase/waste evidence is retained in local staging, tagged E2E.
  expect((await db.from("inventory_master").update({is_active:false}).eq("id",product)).error).toBeNull();
 }
});
