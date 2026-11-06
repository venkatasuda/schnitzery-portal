import {randomUUID} from "node:crypto";
import {test,expect} from "@playwright/test";
import {account,admin,authenticatedClient,authenticatedPage,openContexts,unique} from "./local";
import {berlinToday} from "../src/lib/time/berlinDate";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});
test("item consumption and reconciled net valuation survive reload on a fresh synthetic branch",async({browser},info)=>{
 test.setTimeout(900000);
 const db=admin(),branch=randomUUID(),product=randomUUID(),batch=randomUUID(),recipe=randomUUID(),connection=randomUUID();
 const name=unique("Advanced rice"),external=unique("Item export"),email=`advanced-${randomUUID()}@example.test`,password=randomUUID()+"aA!9";
 expect((await db.from("branches").insert({id:branch,name:unique("Advanced branch"),is_active:true})).error).toBeNull();
 const created=await db.auth.admin.createUser({email,password,email_confirm:true});expect(created.error).toBeNull();
 const user=created.data.user!.id,who={...account("manager"),email,password,user_id:user};
 try{
  expect((await db.from("users").upsert({id:user,email,branch_id:branch,role:"manager",status:"active",full_name:"E2E advanced manager",must_change_password:false,login_locked:false})).error).toBeNull();
  const client=await authenticatedClient(who);
  expect((await client.from("inventory_master").insert({id:product,branch_id:branch,product:name,category:"E2E",unit:"kg",soll:10,is_active:true})).error).toBeNull();
  expect((await client.from("stock_batches").insert({id:batch,branch_id:branch,product:name,category:"E2E",unit:"kg",qty:10,logged_by:user,received_date:berlinToday(),expiry_date:new Date(Date.now()+14*86400000).toISOString().slice(0,10),status:"active"})).error).toBeNull();
  expect((await client.rpc("save_inventory_recipe",{p_branch:branch,p_id:recipe,p_name:"Two rice portions",p_portions:2,p_net_price:null,p_lines:[{product_id:product,qty:1,unit:"kg"}],p_prices_net_confirmed:false})).error).toBeNull();
  expect((await client.rpc("configure_pos_connection",{p_branch:branch,p_id:connection,p_name:"Synthetic item export",p_enabled:true})).error).toBeNull();
  const page=await authenticatedPage(browser,who);
  await page.goto("/inventory/consumption");
  await page.getByLabel("Connection",{exact:true}).selectOption(connection);
  const payload={format:"schnitzery-pos-items-v1",external_id:external,currency:"EUR",days:[{date:berlinToday(),gross_sales:20}],items:[{date:berlinToday(),sku:"RICE",qty:4}]};
  await page.getByLabel("Normalized export JSON",{exact:true}).fill(JSON.stringify(payload));
  await page.getByRole("button",{name:"Import for review",exact:true}).click();
  await expect(page.getByLabel("Sales export",{exact:true}).locator("option").filter({hasText:external})).toHaveCount(1);
  await page.getByLabel("SKU",{exact:true}).fill("RICE");
  await page.getByLabel("Recipe version",{exact:true}).selectOption(recipe);
  await page.getByLabel("Mapping review note",{exact:true}).fill("Two portions use one kg; source unit verified");
  await page.getByRole("button",{name:"Save new mapping version",exact:true}).click();
  await expect(page.getByRole("button",{name:"Save new mapping version",exact:true})).toBeEnabled();
  const job=(await db.from("pos_imports").select("id").eq("connection_id",connection).eq("external_id",external).single()).data!;
  expect((await client.rpc("review_pos_import",{p_branch:branch,p_id:job.id,p_approve:true,p_note:"Source daily sales checked"})).error).toBeNull();
  await page.reload();await page.getByLabel("Sales export",{exact:true}).selectOption(job.id);
  await page.getByLabel("Consumption / reversal review note",{exact:true}).fill("Recipe mapping and current physical stock checked");
  await page.getByRole("checkbox").check();
  await page.getByRole("button",{name:"Post recipe consumption",exact:true}).click();
  await expect(page.getByText("Stock consumption posted once.",{exact:true})).toBeVisible();
  expect(Number((await db.from("stock_batches").select("remaining_qty").eq("id",batch).single()).data!.remaining_qty)).toBe(8);
  await page.goto("/inventory/counts");await page.getByRole("button",{name:"Start / resume branch count",exact:true}).click();
  const quantity=page.getByLabel(`Count: ${name} (kg)`,{exact:true});await quantity.fill("8");
  await page.getByRole("button",{name:"Save progress",exact:true}).click();await expect(page.getByRole("button",{name:"Save progress",exact:true})).toBeDisabled();
  await page.reload();await expect(quantity).toHaveValue("8");
  await page.getByRole("checkbox").check();page.once("dialog",d=>d.accept());await page.getByRole("button",{name:"Complete and publish",exact:true}).click();
  await expect(page.getByRole("heading",{name:/Completed/})).toBeVisible();
  await page.goto("/inventory/valuation");await expect(page.getByRole("button",{name:"Save immutable close",exact:true})).toBeDisabled();
  await page.getByLabel("Batch",{exact:true}).selectOption(batch);
  await page.getByLabel("Confirmed net cost per stock unit (€)",{exact:true}).fill("0.5");
  await page.getByLabel("Invoice / cost source reference",{exact:true}).fill("Synthetic invoice only");
  await page.getByLabel("Cost review note",{exact:true}).fill("Net kg price verified for test");
  await page.getByRole("checkbox",{name:/Net basis/}).check();
  await page.getByRole("button",{name:"Save cost review version",exact:true}).click();
  await expect(page.getByText("Reconciled and priced",{exact:false})).toBeVisible();
  await page.getByLabel("Close review note",{exact:true}).fill("All eight kg counted; cost and branch checked");
  await page.getByRole("checkbox",{name:/All stock, transit/}).check();
  await page.getByRole("button",{name:"Save immutable close",exact:true}).click();
  await expect(page.locator("details.inventory-receipt")).toHaveCount(1);await page.locator("details.inventory-receipt summary").click();await expect(page.getByRole("button",{name:"Export frozen CSV",exact:true})).toBeVisible();
  await page.reload();await expect(page.locator("details.inventory-receipt")).toHaveCount(1);await page.locator("details.inventory-receipt summary").click();await expect(page.getByRole("button",{name:"Export frozen CSV",exact:true})).toBeVisible();
  const close=await db.from("inventory_valuation_closes").select("snapshot").eq("branch_id",branch).single();expect(Number(close.data!.snapshot.total_net)).toBe(4);
  for(const width of [390,1440]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);await info.attach(`valuation-${width}`,{body:await page.screenshot({fullPage:true}),contentType:"image/png"});}
 }finally{
  // Preserve audited journals in local staging; disable only this test's new account and branch.
  await db.from("users").update({status:"inactive",login_locked:true}).eq("id",user);
  await db.from("branches").update({is_active:false}).eq("id",branch);
 }
});
