import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { account, admin, authenticatedPage, BASE_URL, BRANCH, openContexts, unique } from "./local";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

test("recipe save survives reload; insights filter and export; responsive German and role isolation",async({browser},info)=>{
 test.setTimeout(900_000);
 // Dev Strict Mode repeats initial actions; local disk-backed staging is slow.
 const product=randomUUID(),name=unique("Metro recipe acceptance"),dish=unique("Recipe");
 const db=admin();
 const seeded=await db.from("inventory_master").insert({id:product,branch_id:BRANCH.A,product:name,category:"Acceptance",unit:"kg",soll:10,is_active:true});
 expect(seeded.error).toBeNull();
 try{
  const page=await authenticatedPage(browser,account("manager"));
  const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
  await page.setViewportSize({width:1440,height:1000});
  const response=await page.goto("/inventory/recipes");expect(response?.ok(),"recipe page responds successfully").toBe(true);
  await page.getByLabel("Dish name",{exact:true}).fill(dish);
  await page.getByLabel("Portions per batch",{exact:true}).fill("2");
  await page.getByLabel("Net selling price per portion (€)",{exact:true}).fill("10");
  await page.getByRole("combobox",{name:"Product",exact:true}).selectOption(product);
  await page.getByLabel("Quantity for the whole batch",{exact:true}).fill("500");
  await page.getByRole("combobox",{name:"Entered unit",exact:true}).selectOption("g");
  await expect(page.getByText("0.5 kg",{exact:true})).toBeVisible();
  await expect(page.getByText("Some delivery prices are missing. Contribution is withheld.",{exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Save new version",exact:true}).click();
  await expect(page.getByText("Recipe version saved.",{exact:true})).toBeVisible();
  await page.reload();const row=page.getByRole("row").filter({hasText:dish});await expect(row).toHaveCount(1);
  const saved=await db.from("inventory_recipe_versions").select("ingredients").eq("branch_id",BRANCH.A).eq("name",dish);
  expect(saved.error).toBeNull();expect(saved.data).toHaveLength(1);expect(saved.data![0].ingredients[0].qty).toBe(.5);
  await info.attach("recipes-desktop",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});

  await page.goto("/inventory/insights");await page.getByLabel("Search product or category",{exact:true}).fill(name);
  await expect(page.getByRole("row").filter({hasText:name})).toHaveCount(1);
  const download=page.waitForEvent("download");await page.getByRole("button",{name:"Export stock analysis",exact:true}).click();
  expect((await download).suggestedFilename()).toMatch(/^inventory-analysis-.*\.csv$/);
  await info.attach("insights-desktop",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});

  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});
  for(const [path,heading] of [["insights","Bestands- und Geschäftsauswertung"],["recipes","Rezeptkalkulation"]]){
   await page.goto(`/inventory/${path}`);
   if(path==="recipes")await expect(page.getByLabel("Gerichtname",{exact:true})).toBeVisible();
   else await expect(page.getByLabel("Produkt oder Kategorie suchen",{exact:true})).toBeVisible({timeout:120_000});
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),`${heading} fits phone`).toBe(true);
   await info.attach(`${path}-mobile-de`,{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
  }
  expect(errors).toEqual([]);
  for(const role of ["staff","brand_owner"] as const){
   const other=await authenticatedPage(browser,account(role));await other.goto("/inventory/recipes");
   if(role==="staff")await expect(other.getByText("Recipe planning is unavailable. Choose a branch or contact the administrator.",{exact:true})).toBeVisible();
   else await expect(other.getByRole("row").filter({hasText:dish})).toHaveCount(1);
  }
  const other=await authenticatedPage(browser,account("manager","B"));await other.goto("/inventory/recipes");
  await expect(other.getByLabel("Dish name",{exact:true})).toBeVisible();await expect(other.getByRole("row").filter({hasText:dish})).toHaveCount(0);
 }finally{
  const removed=await db.from("inventory_recipe_versions").delete().eq("branch_id",BRANCH.A).eq("name",dish);expect(removed.error).toBeNull();
  const removedProduct=await db.from("inventory_master").delete().eq("id",product);expect(removedProduct.error).toBeNull();
 }
});
