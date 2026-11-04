import {randomUUID} from "node:crypto";
import {writeFile} from "node:fs/promises";
import {test,expect} from "@playwright/test";
import {account,admin,authenticatedPage,BASE_URL,BRANCH,openContexts,unique} from "./local";
import {berlinToday} from "../src/lib/time/berlinDate";
test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

test("private reference review, dated price updates and recipe estimates preserve old evidence",async({browser},info)=>{
 test.setTimeout(900_000);
 const db=admin(),product=randomUUID(),name=unique("Priced ingredient"),source=unique("Supplier reference");
 expect((await db.from("inventory_master").insert({id:product,branch_id:BRANCH.A,product:name,category:"E2E",unit:"kg",soll:1,is_active:true})).error).toBeNull();
 const row={item:name,source,article_no:"SYNTHETIC",pack_size:"2 kg",bought_quantity:"",quote_qty:2,quote_unit:"kg",price:10,basis:"net",vat_pct:7,observed_date:berlinToday(),kind:"supplier_quote",line_total:null,notes:"Synthetic reference for private local acceptance"};
 const file=info.outputPath("synthetic-price-references.json");await writeFile(file,JSON.stringify({format:"schnitzery-price-reference-v1",rows:[row,{...row,item:"Unconfirmed example",price:null,observed_date:null,basis:null}]}));
 try{
  const page=await authenticatedPage(browser,account("manager"));await page.goto("/inventory/prices");
  await page.getByLabel("Price-reference file (.json)",{exact:true}).setInputFiles(file);await page.getByRole("button",{name:"Import for review",exact:true}).click();
  const imported=page.locator("details.inventory-receipt").filter({has:page.locator("summary",{hasText:"synthetic-price-references.json"})}).filter({hasText:source});
  await expect(imported).toHaveCount(1);expect((await db.from("inventory_price_versions").select("id").eq("product_id",product)).data).toHaveLength(0);
  await imported.locator("summary").first().click();await imported.locator("article").filter({has:page.getByText(name,{exact:true})}).getByRole("button",{name:"Review and map product",exact:true}).click();
  await page.getByRole("combobox",{name:"Catalog product",exact:true}).selectOption(product);
  await expect(page.getByLabel("Stock quantity covered by this price (kg)",{exact:true})).toHaveValue("2");
  await page.getByLabel("Review / change reason",{exact:true}).fill("Verified product, quantity and net supplier basis");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Save reviewed price",exact:true}).click();
  await expect(page.getByText("Reviewed price version saved. Earlier versions and receipts are preserved.",{exact:true})).toBeVisible();
  let versions=await db.from("inventory_price_versions").select("revision,net_unit_price").eq("product_id",product).order("revision");expect(versions.error).toBeNull();expect(versions.data).toHaveLength(1);expect(Number(versions.data![0].net_unit_price)).toBe(5);
  const recipeCost=async(expected:string)=>{
   await page.goto("/inventory/recipes");await page.getByLabel("Dish name",{exact:true}).fill("Synthetic recipe estimate");
   await page.getByRole("combobox",{name:"Product",exact:true}).selectOption(product);await page.getByLabel("Quantity for the whole batch",{exact:true}).fill("1");
   await expect(page.locator(".business-kpi").filter({hasText:"Ingredient cost per portion"})).toContainText(expected);
  };
  await recipeCost("€5.00");await page.goto("/inventory/prices");
  const history=page.locator("details.inventory-receipt").filter({has:page.locator("summary",{hasText:name})});await expect(history).toHaveCount(1);await history.locator("summary").first().click();
  await history.getByRole("button",{name:"Update with new version",exact:true}).click();await page.getByLabel("Price for that quantity (€)",{exact:true}).fill("14");
  await page.getByLabel("Supplier / invoice / quote source",{exact:true}).fill(`${source} revised`);await page.getByLabel("Review / change reason",{exact:true}).fill("New supplier price verified; preserve earlier version");
  await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Save reviewed price",exact:true}).click();await expect(page.getByText("Reviewed price version saved. Earlier versions and receipts are preserved.",{exact:true})).toBeVisible();
  versions=await db.from("inventory_price_versions").select("revision,net_unit_price").eq("product_id",product).order("revision");expect(versions.data).toHaveLength(2);expect(versions.data!.map(v=>Number(v.net_unit_price))).toEqual([5,7]);
  await recipeCost("€7.00");
  expect((await db.from("inventory_purchases").select("id").eq("branch_id",BRANCH.A).eq("product",name)).data).toHaveLength(0);
  expect((await db.from("stock_batches").select("id").eq("branch_id",BRANCH.A).eq("product",name)).data).toHaveLength(0);
  const other=await authenticatedPage(browser,account("manager","B"));await other.goto("/inventory/prices");await expect(other.getByRole("button",{name:"Add / update price",exact:true})).toBeEnabled();await expect(other.getByText(source,{exact:false})).toHaveCount(0);
  const staff=await authenticatedPage(browser,account("staff"));await staff.goto("/inventory/prices");await expect(staff.getByRole("alert").filter({hasText:"Prices could not be loaded"})).toBeVisible();
  const owner=await authenticatedPage(browser,account("brand_owner"));await owner.goto("/inventory/prices");await expect(owner.locator("details.inventory-receipt").filter({has:owner.locator("summary",{hasText:name})})).toHaveCount(2);
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});await page.goto("/inventory/prices");
  await page.getByRole("button",{name:"Preis hinzufügen / aktualisieren",exact:true}).click();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await info.attach("ingredient-price-editor-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 }finally{expect((await db.from("inventory_master").update({is_active:false}).eq("id",product)).error).toBeNull();}
});
