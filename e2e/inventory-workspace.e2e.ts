import { test, expect } from "@playwright/test";
import { account, addCatalogProduct, removeCatalogProduct, admin, BASE_URL, BRANCH, openContexts, signIn, unique } from "./local";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

test("saved order, partial receiving, role isolation and mobile German layout",async({browser},info)=>{
 test.setTimeout(600_000); // Four authenticated contexts and receipt writes on the local disk-backed candidate.
 const page=await signIn(browser,account("manager","A")),product=unique("Purchase"),supplier=unique("Supplier");
 page.on("dialog",dialog=>dialog.accept()); // ordinary confirmations on disposable local fixtures only
 await addCatalogProduct(page,product);
 try{
  await page.goto("/inventory/purchasing");
  await page.getByRole("button",{name:"Suppliers",exact:true}).click();
  await page.getByRole("button",{name:"Add supplier",exact:true}).click();
  let dialog=page.getByRole("dialog",{name:"Supplier",exact:true});
  await dialog.getByLabel("Name",{exact:true}).fill(supplier);
  await dialog.getByLabel("Email",{exact:true}).fill("orders@example.invalid");
  await dialog.getByLabel("Lead time (days)").fill("3");
  await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole("button",{name:"New purchase order",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Saved order draft"});
  await dialog.getByRole("combobox",{name:"Supplier",exact:true}).selectOption({label:supplier});
  const p=await admin().from("inventory_master").select("id").eq("branch_id",BRANCH.A).eq("product",product).single();
  expect(p.error).toBeNull();
  await dialog.getByLabel("Product 1",{exact:true}).selectOption(p.data!.id);
  await dialog.getByLabel("Ordered quantity 1",{exact:true}).fill("2");
  await dialog.getByLabel("Unit price (€) 1",{exact:true}).fill("0.005");
  await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  // Open the saved order view after maintaining the supplier directory.
  await page.getByRole("button",{name:"Purchase orders",exact:true}).click();
  await expect(page.getByRole("heading",{name:/PO-.*Draft/})).toBeVisible();
  const orderURL=page.url(),orderId=new URL(orderURL).searchParams.get("order");expect(orderId).toBeTruthy();
  await page.getByRole("button",{name:"Approve order",exact:true}).click();
  await expect(page.getByRole("heading",{name:/PO-.*Approved/})).toBeVisible();
  await page.getByLabel("Sending reference / cancellation or short-close reason").fill("Synthetic supplier email reference");
  await page.getByRole("button",{name:"Mark sent",exact:true}).click();
  await expect(page.getByRole("heading",{name:/PO-.*Sent/})).toBeVisible();
  for(const [index,explanation] of [[1,"Partial delivery"],[2,""]] as const){
   await page.getByRole("button",{name:"Receive goods",exact:true}).click();dialog=page.getByRole("dialog",{name:"Receive goods"});
   await dialog.getByLabel("Unique invoice / delivery reference for this order").fill(`${supplier}-${index}`);
   await dialog.getByLabel(`Accepted: ${product}`,{exact:true}).fill("1");
   await dialog.getByLabel(`Accepted line cost (€): ${product}`,{exact:true}).fill("2");
   if(explanation)await dialog.getByLabel(`Note: ${product}`,{exact:true}).fill(explanation);
   await dialog.getByRole("checkbox",{name:/I checked the delivery reference/}).check();
   await dialog.getByRole("button",{name:"Post receipt",exact:true}).click();await expect(dialog).toBeHidden();
   await expect(page.getByRole("heading",{name:index===1?/PO-.*Partially received/:/PO-.*Closed/})).toBeVisible();
  }
  const receipts=await admin().from("inventory_receipts").select("id").eq("order_id",orderId!);expect(receipts.error).toBeNull();expect(receipts.data).toHaveLength(2);
  const purchases=await admin().from("inventory_purchases").select("qty,cost").in("receipt_id",receipts.data!.map(r=>r.id));
  expect(purchases.data?.reduce((s,r)=>s+Number(r.qty),0)).toBe(2);expect(purchases.data?.reduce((s,r)=>s+Number(r.cost),0)).toBe(4);
  const other=await signIn(browser,account("manager","B"));await other.goto(orderURL);await expect(other.getByRole("alert").filter({hasText:"Inventory data could not be loaded"})).toBeVisible();await expect(other.getByText(supplier,{exact:true})).toHaveCount(0);
  const staff=await signIn(browser,account("staff","A"));await staff.goto(orderURL);await expect(staff.getByRole("alert").filter({hasText:"Active manager access"})).toBeVisible();
  const owner=await signIn(browser,account("brand_owner","A"));await owner.goto(orderURL);await expect(owner.getByRole("heading",{name:/PO-.*Closed/})).toBeVisible();
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:390,height:844});await page.goto("/inventory/purchasing");
  await expect(page.getByRole("heading",{name:"Einkauf",exact:true})).toBeVisible();await expect(page.locator(".inventory-area-nav a")).toHaveCount(5);
  await expect(page.getByRole("button",{name:"Neue Bestellung",exact:true})).toBeEnabled();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
  await info.attach("purchasing-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 }finally{await page.context().addCookies([{name:"lang",value:"en",url:BASE_URL}]);await removeCatalogProduct(page,product);}
 // Audited synthetic orders/receipts are intentionally retained, tagged E2E, for inspection.
});

test("loaded purchasing mobile German layout",async({browser},info)=>{
 const page=await signIn(browser,account("manager","A"));
 await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);
 await page.setViewportSize({width:390,height:844});await page.goto("/inventory/purchasing");
 await expect(page.getByRole("heading",{name:"Einkauf",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Neue Bestellung",exact:true})).toBeEnabled();
 await expect(page.locator(".inventory-area-nav a")).toHaveCount(5);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
 await info.attach("purchasing-mobile-de-loaded",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("saved count progress survives reload without publishing stock",async({browser})=>{
 const existing=await admin().from("inventory_count_sessions").select("id").eq("branch_id",BRANCH.A).eq("status","draft").maybeSingle();
 expect(existing.error).toBeNull();test.skip(!!existing.data,"Do not overwrite an existing staging count draft");
 const page=await signIn(browser,account("manager","A")),product=unique("Saved count");await addCatalogProduct(page,product);
 try{
  await page.goto("/inventory/counts");await page.getByRole("button",{name:"Start / resume branch count",exact:true}).click();
  const quantity=page.getByLabel(`Count: ${product} (kg)`,{exact:true});await quantity.fill("7");
  await page.getByRole("button",{name:"Save progress",exact:true}).click();await expect(page.getByText("Unsaved quantities",{exact:false})).toHaveCount(0);
  await page.reload();await expect(quantity).toHaveValue("7");
  const recorded=await admin().from("inventory_counts").select("id").eq("branch_id",BRANCH.A).eq("product",product);expect(recorded.data).toHaveLength(0);
  page.once("dialog",dialog=>dialog.accept());await page.getByRole("button",{name:"Cancel draft",exact:true}).click();await expect(page.getByRole("heading",{name:/Cancelled/})).toBeVisible();
 }finally{await removeCatalogProduct(page,product);}
});
