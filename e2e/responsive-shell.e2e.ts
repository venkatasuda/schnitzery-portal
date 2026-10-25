import { test, expect } from "@playwright/test";
import { account, authenticatedPage, openContexts } from "./local";

test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

test("phone purchase cards keep row actions in view",async({browser},info)=>{
 const page=await authenticatedPage(browser,account("manager","A"));
 await page.setViewportSize({width:390,height:844});await page.goto("/inventory/purchasing");
 await expect(page.getByRole("button",{name:"New purchase order",exact:true})).toBeEnabled();
 const open=page.locator(".inventory-order-list tbody").getByRole("button",{name:"Open",exact:true}).first();
 await expect(open).toBeVisible();
 for(const width of [320,390]){
  await page.setViewportSize({width,height:844});
  const bounds=await open.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(width);
  expect(await page.locator(".inventory-order-list").evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 }
 await info.attach("purchasing-phone-cards",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 await open.click();await expect(page.getByRole("button",{name:"Back to orders",exact:true})).toBeVisible();
});

test("manager toolbar adapts without overlap and keeps preferences and navigation usable",async({browser},info)=>{
 test.setTimeout(600_000);
 const page=await authenticatedPage(browser,account("manager","A"));
 await page.goto("/inventory/purchasing");
 await expect(page.getByRole("button",{name:"New purchase order",exact:true})).toBeEnabled();
 for(const width of [320,390,768,1024,1440,1920]){
  await page.setViewportSize({width,height:900});
  const header=page.locator(".app-header"),leading=header.locator(".header-leading"),tools=header.locator(".header-right");
  const left=await leading.boundingBox(),right=await tools.boundingBox();
  expect(left).not.toBeNull();expect(right).not.toBeNull();
  expect(left!.x+left!.width).toBeLessThanOrEqual(right!.x+1);
  expect(right!.x+right!.width).toBeLessThanOrEqual(width);
  expect(await header.evaluate(el=>el.getBoundingClientRect().height)).toBeLessThanOrEqual(126);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  for(const control of await tools.locator(":scope > a, :scope > button, :scope > div > button").all()){
   if(!await control.isVisible())continue;
   const bounds=await control.boundingBox();expect(bounds!.height).toBeGreaterThanOrEqual(44);expect(bounds!.width).toBeGreaterThanOrEqual(44);
  }
  await page.getByRole("button",{name:"Language and appearance",exact:true}).click();
  await expect(page.locator("#display-preferences")).toBeVisible();
  const popup=await page.locator("#display-preferences").boundingBox();
  expect(popup!.x).toBeGreaterThanOrEqual(0);expect(popup!.x+popup!.width).toBeLessThanOrEqual(width);
  await expect(page.getByRole("button",{name:"English",exact:true})).toBeVisible();
  await page.keyboard.press("Escape");await expect(page.locator("#display-preferences")).toBeHidden();
  if(width===390||width===1440)await info.attach(`toolbar-${width}`,{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
 }
 await page.setViewportSize({width:390,height:844});
 await page.getByRole("button",{name:"Notifications",exact:true}).click();
 await expect(page.locator("#portal-notifications")).toBeVisible();
 const notifications=await page.locator("#portal-notifications").boundingBox();
 expect(notifications!.x).toBeGreaterThanOrEqual(0);expect(notifications!.x+notifications!.width).toBeLessThanOrEqual(390);
 await page.keyboard.press("Escape");await expect(page.locator("#portal-notifications")).toBeHidden();
 await page.locator(".management-mobile-nav button").click();await expect(page.locator("#management-menu")).toBeVisible();
 await expect(page.locator('#management-menu a[href="/inventory"]')).toBeVisible();
 await page.keyboard.press("Escape");await expect(page.locator("#management-menu")).toBeHidden();
 await page.getByRole("button",{name:"Language and appearance",exact:true}).click();
 await page.getByRole("button",{name:"Deutsch",exact:true}).click();
 await expect(page.getByRole("heading",{name:"Einkauf",exact:true})).toBeVisible();
 await expect(page.getByRole("button",{name:"Neue Bestellung",exact:true})).toBeEnabled();
 await page.keyboard.press("Escape");
 await page.getByRole("button",{name:"Sprache und Darstellung",exact:true}).click();
 const theme=page.locator("#display-preferences .theme-btn"),before=await theme.getAttribute("aria-pressed");
 await theme.click();await expect(theme).toHaveAttribute("aria-pressed",before==="true"?"false":"true");
 await page.keyboard.press("Escape");
 await info.attach("toolbar-mobile-de",{body:await page.screenshot({fullPage:true}),contentType:"image/png"});
});

test("employee and owner toolbars retain their controls at phone width",async({browser})=>{
 test.setTimeout(300_000);
 for(const role of ["staff","brand_owner"] as const){
  const page=await authenticatedPage(browser,account(role,"A"));await page.setViewportSize({width:320,height:844});
  await page.goto(role==="staff"?"/profile":"/inventory/purchasing");
  await expect(page.locator(".app-header")).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
  await page.getByRole("button",{name:"Language and appearance",exact:true}).click();
  await expect(page.getByRole("button",{name:"Deutsch",exact:true})).toBeVisible();await page.keyboard.press("Escape");
  if(role==="brand_owner"){
   const picker=page.locator(".header-branch select");await expect(picker).toBeVisible();
   const bounds=await picker.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(320);
  }else await expect(page.locator(".bottom-nav")).toBeVisible();
 }
});
