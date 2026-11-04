import {test,expect} from "@playwright/test";
import {account,admin,authenticatedPage,BASE_URL,BRANCH,openContexts,unique} from "./local";
test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});
test("till intake stays private until reviewed and never overwrites an existing day",async({browser,request},info)=>{
 test.setTimeout(900_000);const db=admin(),name=unique("Till connector"),external=unique("Till daily export");
 expect((await request.post(`${BASE_URL}/api/integrations/pos`,{data:{}})).status()).toBe(401);
 const page=await authenticatedPage(browser,account("manager"));await page.goto("/inventory/connections");await page.getByLabel("Connection name",{exact:true}).fill(name);await page.getByRole("button",{name:"Create disabled connection",exact:true}).click();
 const connection=page.locator("details.inventory-receipt").filter({has:page.locator("summary",{hasText:name})});await expect(connection).toHaveCount(1);await connection.locator("summary").click();await connection.getByRole("button",{name:"Enable signed intake",exact:true}).click();
 await expect(connection).toContainText("Enabled");
 const record=await db.from("pos_connections").select("id").eq("branch_id",BRANCH.A).eq("name",name).single();expect(record.error).toBeNull();
 const date="2001-04-12";expect((await db.from("daily_sales").select("id").eq("branch_id",BRANCH.A).eq("sale_date",date)).data).toHaveLength(0);
 try{
  const payload={format:"schnitzery-pos-daily-v1",external_id:external,currency:"EUR",days:[{date,gross_sales:123.45}]};const staged=await db.rpc("stage_pos_import",{p_connection:record.data!.id,p_payload:payload});expect(staged.error).toBeNull();
  expect((await db.from("daily_sales").select("id").eq("branch_id",BRANCH.A).eq("sale_date",date)).data).toHaveLength(0);
  await page.getByRole("button",{name:"Refresh",exact:true}).click();const imported=page.locator("details.inventory-receipt").filter({has:page.locator("summary",{hasText:external})});await expect(imported).toHaveCount(1);await imported.locator("summary").click();await imported.getByRole("button",{name:"Review this import",exact:true}).click();
  await page.getByLabel("Review note",{exact:true}).fill("Synthetic daily gross totals checked against source export");await page.getByRole("checkbox").check();await page.getByRole("button",{name:"Approve and save daily sales",exact:true}).click();await expect(imported).toContainText("Approved");
  expect(Number((await db.from("daily_sales").select("amount").eq("branch_id",BRANCH.A).eq("sale_date",date).single()).data!.amount)).toBe(123.45);
  const staff=await authenticatedPage(browser,account("staff"));await staff.goto("/inventory/connections");await expect(staff.getByRole("alert").filter({hasText:"Connection data could not be loaded"})).toBeVisible();
  const other=await authenticatedPage(browser,account("manager","B"));await other.goto("/inventory/connections");await expect(other.getByLabel("Connection name",{exact:true})).toBeVisible();await expect(other.getByText(name,{exact:false})).toHaveCount(0);
  await page.context().addCookies([{name:"lang",value:"de",url:BASE_URL}]);await page.setViewportSize({width:375,height:812});await page.goto("/inventory/connections");await expect(page.getByRole("heading",{name:"Kassenverbindungen und Importprüfung",exact:true})).toBeVisible();expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);await info.attach("pos-pipeline-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 }finally{await db.from("daily_sales").delete().eq("branch_id",BRANCH.A).eq("sale_date",date);await db.from("pos_connections").update({enabled:false}).eq("id",record.data!.id);}
});
