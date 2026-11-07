import { test, expect } from "@playwright/test";
import { account, addCatalogProduct, removeCatalogProduct, admin, BASE_URL, BRANCH, openContexts, authenticatedPage as signIn, unique } from "./local";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

test("saved order, partial receiving, role isolation and mobile German layout",async({browser},info)=>{
 test.setTimeout(600_000); // Four authenticated contexts and receipt writes on the local disk-backed candidate.
 const page=await signIn(browser,account("manager","A")),product=unique("Purchase"),supplier=unique("Supplier");
 page.on("dialog",dialog=>dialog.accept()); // ordinary confirmations on disposable local fixtures only
 await addCatalogProduct(page,product);
 try{
  await page.getByRole("row").filter({hasText:product}).getByRole("button",{name:"Purchase packs",exact:true}).click();
  const packDialog=page.getByRole("dialog",{name:"Purchase packs",exact:true});
  await packDialog.getByLabel("Pack name",{exact:true}).fill("Bag");
  await packDialog.getByLabel("Stock quantity per pack (kg)",{exact:true}).fill("2");
  await packDialog.getByRole("checkbox").check();
  await packDialog.getByRole("button",{name:"Save pack version",exact:true}).click();await expect(packDialog).toBeHidden();
  await page.goto("/inventory/purchasing");
  await page.getByRole("link",{name:"Suppliers",exact:true}).click();
  await page.getByRole("button",{name:"Add supplier",exact:true}).click();
  let dialog=page.getByRole("dialog",{name:"Supplier",exact:true});
  await dialog.getByLabel("Name",{exact:true}).fill(supplier);
  await dialog.getByLabel("Email",{exact:true}).fill("orders@example.invalid");
  await dialog.getByLabel("Lead time (days)").fill("3");
  await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  await page.getByRole("link",{name:"Purchase orders",exact:true}).click(); // order actions live only on the Orders task
  await page.getByRole("button",{name:"New purchase order",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Saved order draft"});
  await dialog.getByRole("combobox",{name:"Supplier",exact:true}).selectOption({label:supplier});
  const p=await admin().from("inventory_master").select("id").eq("branch_id",BRANCH.A).eq("product",product).single();
  expect(p.error).toBeNull();
  await dialog.getByLabel("Product 1",{exact:true}).selectOption(p.data!.id);
  await dialog.getByLabel("Order unit 1",{exact:true}).selectOption({label:"Bag · 2 kg"});
  await dialog.getByLabel("Ordered quantity 1",{exact:true}).fill("1");
  await dialog.getByLabel("Unit price (€) 1",{exact:true}).fill("0.01");
  await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  // Saving the draft opens the saved order directly.
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
   await dialog.getByLabel(`Accepted line cost (€): ${product}`,{exact:true}).fill(index===1?"":"2");
   await dialog.getByLabel(`Expiry date 1: ${product}`,{exact:true}).fill("2030-12-01");
   if(explanation)await dialog.getByLabel(`Note: ${product}`,{exact:true}).fill(explanation);
   await dialog.getByRole("checkbox",{name:/I checked the delivery reference/}).check();
   await dialog.getByRole("button",{name:"Post receipt",exact:true}).click();await expect(dialog).toBeHidden();
   await expect(page.getByRole("heading",{name:index===1?/PO-.*Partially received/:/PO-.*Closed/})).toBeVisible();
  }
  const receipts=await admin().from("inventory_receipts").select("id").eq("order_id",orderId!);expect(receipts.error).toBeNull();expect(receipts.data).toHaveLength(2);
  const purchases=await admin().from("inventory_purchases").select("qty,cost").in("receipt_id",receipts.data!.map(r=>r.id));
  expect(purchases.data?.reduce((s,r)=>s+Number(r.qty),0)).toBe(2);expect(purchases.data?.filter(r=>r.cost==null)).toHaveLength(1);expect(purchases.data?.reduce((s,r)=>s+Number(r.cost),0)).toBe(2);
  await page.getByRole("link",{name:"Returns & credits",exact:true}).click();
  await page.getByRole("button",{name:"Record goods sent back",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Record goods sent back",exact:true});
  const batch=await admin().from("stock_batches").select("id").eq("branch_id",BRANCH.A).eq("product",product).order("id").limit(1).single();expect(batch.error).toBeNull();
  await dialog.getByLabel("Receipt-linked batch",{exact:true}).selectOption(batch.data!.id);
  await dialog.getByLabel("Quantity sent back (kg)",{exact:true}).fill("0.25");
  await dialog.getByLabel("Document reference",{exact:true}).fill(`${supplier}-RETURN`);
  await dialog.getByLabel("Reason / evidence",{exact:true}).fill("Supplier accepted packaging return");
  await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  const returnCard=page.locator("details.inventory-receipt").filter({hasText:`${supplier}-RETURN`});await returnCard.locator("summary").click();
  await returnCard.getByRole("button",{name:"Record supplier credit",exact:true}).click();
  dialog=page.getByRole("dialog",{name:"Record supplier credit",exact:true});
  await dialog.getByLabel("Credit amount (€)",{exact:true}).fill("0.50");await dialog.getByLabel("Document reference",{exact:true}).fill(`${supplier}-CREDIT`);
  await dialog.getByLabel("Tax basis on credit document",{exact:true}).selectOption("net");await dialog.getByLabel("Reason / evidence",{exact:true}).fill("Credit note checked against supplier document");
  await dialog.getByRole("checkbox").check();await dialog.getByRole("button",{name:"Save",exact:true}).click();await expect(dialog).toBeHidden();
  expect(Number((await admin().from("stock_batches").select("remaining_qty").eq("id",batch.data!.id).single()).data!.remaining_qty)).toBe(0.75);
  expect((await admin().from("inventory_supplier_credits").select("id").eq("reference",`${supplier}-CREDIT`)).data).toHaveLength(1);
  const other=await signIn(browser,account("manager","B"));await other.goto(orderURL);await expect(other.getByRole("alert").filter({hasText:"Inventory data could not be loaded"})).toBeVisible();await expect(other.getByText(supplier,{exact:true})).toHaveCount(0);
  const staff=await signIn(browser,account("staff","A"));await staff.goto(orderURL);await expect(staff.getByRole("alert").filter({hasText:"Active manager access"})).toBeVisible();
  const owner=await signIn(browser,account("brand_owner","A"));await owner.goto(orderURL);await expect(owner.getByRole("heading",{name:/PO-.*Closed/})).toBeVisible();
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:390,height:844});await page.goto("/inventory/purchasing");
  await expect(page.getByRole("heading",{name:"Einkauf",exact:true})).toBeVisible();await expect(page.locator(".inventory-area-nav a")).toHaveCount(6);
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
 await expect(page.locator(".inventory-area-nav a")).toHaveCount(6);
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
