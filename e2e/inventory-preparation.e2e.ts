import { randomUUID } from "node:crypto";
import { test,expect } from "@playwright/test";
import { account,admin,authenticatedPage,BASE_URL,BRANCH,openContexts,unique } from "./local";
test.afterEach(async()=>{for(const c of openContexts.splice(0))await c.close();});
test("confirmed yield scales a saved daily plan without posting stock movements",async({browser},info)=>{
 test.setTimeout(600_000);
 const db=admin(),recipe=randomUUID(),product=randomUUID(),name=unique("Prep Parmesan");
 const inserted=await db.from("inventory_master").insert({id:product,branch_id:BRANCH.A,product:name,category:"Acceptance",unit:"kg",soll:10,is_active:true});expect(inserted.error).toBeNull();
 try{
  const created=await db.from("inventory_recipe_versions").insert({id:recipe,branch_id:BRANCH.A,name,portions:1,net_price:null,ingredients:[{product_id:product,product:name,category:"Acceptance",unit:"kg",qty:2.4,entered_qty:2.4,entered_unit:"kg"}],request:{test:true},created_by:account("manager").user_id});expect(created.error).toBeNull();
  const page=await authenticatedPage(browser,account("manager"));await page.goto("/inventory/preparation");
  await page.getByLabel("Preparation date",{exact:true}).fill("2050-01-01");
  await page.getByRole("combobox",{name:"Recipe version",exact:true}).selectOption(recipe);
  await page.getByLabel("Usable output per batch",{exact:true}).fill("2");
  await page.getByLabel("Expected trimming 1 (kg)",{exact:true}).fill("0.4");
  await page.getByLabel("Yield evidence / notes",{exact:true}).fill("Synthetic measured batch: 2.4 kg raw, 0.4 kg rind, 2 kg usable");
  await page.getByRole("checkbox",{name:"I verified the usable batch output and trimming quantities.",exact:true}).check();
  await page.getByRole("button",{name:"Save yield version",exact:true}).click();
  await expect(page.getByText("Yield version saved.",{exact:true})).toBeVisible({timeout:120_000});
  await page.getByLabel("Service demand (kg)",{exact:true}).fill("4");
  await page.getByLabel("Reserve target (kg)",{exact:true}).fill("2");
  await page.getByLabel("Usable prepared stock (kg)",{exact:true}).fill("1");
  await page.getByLabel("Incoming prepared stock (kg)",{exact:true}).fill("1");
  await expect(page.getByText("2 whole batches",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save daily plan version",exact:true}).click();
  await expect(page.getByText("Preparation plan saved.",{exact:true})).toBeVisible({timeout:120_000});
  await page.reload();await page.getByLabel("Preparation date",{exact:true}).fill("2050-01-01");
  const saved=page.locator(".inventory-prep-plan").filter({hasText:name});await expect(saved).toHaveCount(1,{timeout:120_000});
  await expect(saved).toContainText("2 whole batches");await expect(saved).toContainText("4.8 kg");await expect(saved).toContainText("0.8 kg");
  const movements=await db.from("inventory_purchases").select("id").eq("branch_id",BRANCH.A).eq("product",name);expect(movements.error).toBeNull();expect(movements.data).toHaveLength(0);
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});await page.reload();
  await page.getByLabel("Vorbereitungsdatum",{exact:true}).fill("2050-01-01");
  await expect(page.getByRole("combobox",{name:"Rezeptversion",exact:true})).toBeVisible({timeout:120_000});
  await expect(page.locator(".inventory-prep-plan").filter({hasText:name})).toHaveCount(1,{timeout:120_000});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await info.attach("preparation-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  const other=await authenticatedPage(browser,account("manager","B"));await other.goto("/inventory/preparation");
  await expect(other.getByRole("combobox",{name:"Recipe version",exact:true})).toBeVisible();await expect(other.getByRole("option",{name:new RegExp(name)})).toHaveCount(0);
  const staff=await authenticatedPage(browser,account("staff"));await staff.goto("/inventory/preparation");await expect(staff.getByRole("alert")).toBeVisible();await expect(staff.getByRole("button",{name:"Save yield version",exact:true})).toHaveCount(0);
 }finally{
  const yields=await db.from("inventory_recipe_yields").select("id").eq("recipe_id",recipe);expect(yields.error).toBeNull();
  if(yields.data?.length){expect((await db.from("inventory_preparation_plans").delete().in("yield_id",yields.data.map(y=>y.id))).error).toBeNull();expect((await db.from("inventory_recipe_yields").delete().eq("recipe_id",recipe)).error).toBeNull();}
  expect((await db.from("inventory_recipe_versions").delete().eq("id",recipe)).error).toBeNull();expect((await db.from("inventory_master").delete().eq("id",product)).error).toBeNull();
 }
});
