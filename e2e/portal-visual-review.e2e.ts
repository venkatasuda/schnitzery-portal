import { test, expect } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";
import { uiReviewFingerprint } from "../scripts/ops/ui-review-source.mjs";
import { account, admin, authenticatedPage, BASE_URL, BRANCH, openContexts } from "./local";

// Read-only page review on the guarded local stack. Only the disposable staff A
// shift-leader designation may be inserted, and only a designation inserted here is removed.
const output = join(homedir(), "Documents/Codex/schnitzery-signed-in-review-2026-11-14");
test.beforeAll(async ({ request }) => {
  const marker = await request.get("/ui-review-marker.json");
  expect(marker.ok(), "This must be the isolated current-code review server").toBe(true);
  const actual = await marker.json();
  expect(actual.kind).toBe("schnitzery-ui-review");
  expect(actual.fingerprint, "Review source must match this checkout").toBe(uiReviewFingerprint(fileURLToPath(new URL("../", import.meta.url))));
});
const plans = [
 { name:"staff", role:"staff", branch:"B", paths:["/","/my-day","/my-day?tab=hours","/my-day?tab=timeoff","/schedule","/profile","/directory","/leave-calendar"] },
 { name:"manager", role:"manager", branch:"A", paths:["/","/inventory","/inventory/counts","/inventory/purchasing","/inventory/production","/inventory/preparation","/inventory/recipes","/inventory/prices","/inventory/consumption","/inventory/insights","/inventory/valuation","/inventory/batch-report","/expiry","/roster","/staff","/attendance-hub","/approvals","/analytics","/labor","/settings","/profile","/ops","/temp","/day-close","/inventory?view=catalog","/inventory?view=deliveries","/inventory?view=forecast","/inventory?view=history","/inventory?view=analytics","/inventory?view=reconcile","/inventory/connections","/schedule-hub","/schedule/compare","/schedule/shift-times","/people-hub","/waste","/transfers","/stock-alerts","/labels","/prep","/checklist","/checklist/templates","/checklist-status","/compliance","/compliance/logbook","/conflicts","/announcements","/audit","/incidents","/export","/summary","/timesheet","/notes","/noshow","/clock-display","/settings-hub","/settings/integrations","/geofence","/kiosks","/notifications","/search","/attendance","/attendance/corrections","/targets","/expiring-docs","/sales/imports","/schedule","/leave","/leave-calendar","/availability","/cover","/hours","/action","/dashboard","/inventory/order","/inventory?view=count"] },
 { name:"branch_owner", role:"branch_owner", branch:"A", paths:["/","/inventory","/roster","/staff","/analytics"] },
 { name:"brand_owner", role:"brand_owner", branch:"A", paths:["/","/overview","/branches","/analytics","/my-branches","/waste-branches","/simulator"] },
 { name:"shift_leader", role:"staff", branch:"A", paths:["/shift","/inventory/counts","/shift/delivery","/expiry","/prep/plan","/day-close"] },
] as const;

test("signed-in My Day retains unsaved availability through tab history",async({browser})=>{
 const page=await authenticatedPage(browser,account("staff","B"),{viewport:{width:390,height:844},hasTouch:true,reducedMotion:"reduce"});
 try {
  await page.goto("/my-day");
  const option=page.locator(".avail-shift").first();await expect(option).toBeVisible();
  const before=await option.getAttribute("aria-pressed"),changed=before==="true"?"false":"true";
  await option.click();await expect(option).toHaveAttribute("aria-pressed",changed);
  await page.locator(".hub-tabs .hub-tab").nth(2).click();await expect(page).toHaveURL(/tab=hours/);
  await page.goBack();await expect(option).toBeVisible();await expect(option).toHaveAttribute("aria-pressed",changed);
  // No Save click: closing this isolated context discards the local-only edit.
 }finally{for(const context of openContexts.splice(0))await context.close();}
});

test("signed-in optional action disclosures fit the phone and return focus on Escape",async({browser})=>{
 const page=await authenticatedPage(browser,account("manager","A"),{viewport:{width:390,height:844},hasTouch:true,reducedMotion:"reduce"});
 try {
  for(const route of ["/roster","/staff"]){
   await page.goto(route);const menu=page.locator(".ui-action-menu").first(),summary=menu.locator("summary");
   await expect(summary).toBeVisible();await summary.click();
   const items=menu.locator(".ui-action-menu-items");await expect(items).toBeVisible();
   const bounds=await items.boundingBox();expect(bounds!.x).toBeGreaterThanOrEqual(0);expect(bounds!.x+bounds!.width).toBeLessThanOrEqual(390);
   await page.keyboard.press("Escape");await expect(items).toBeHidden();await expect(summary).toBeFocused();
  }
 }finally{for(const context of openContexts.splice(0))await context.close();}
});

for (const plan of plans) test(`signed-in visual review: ${plan.name}`, async ({ browser }, info) => {
 test.setTimeout(900_000);
 mkdirSync(output,{recursive:true});
 const who=account(plan.role,plan.branch), failures:string[]=[], results:unknown[]=[];
 let insertedLeader=false;
 if(plan.name==="shift_leader"){
  const before=await admin().from("shift_leaders").select("user_id").eq("branch_id",BRANCH.A).eq("user_id",who.user_id).maybeSingle();
  test.skip(!!before.error,"Local staging shift-leader schema unavailable");
  if(!before.data){
   const inserted=await admin().from("shift_leaders").insert({branch_id:BRANCH.A,user_id:who.user_id});
   expect(inserted.error).toBeNull();insertedLeader=true;
  }
 }
 try {
  const routes: string[] = [...plan.paths];
  if(plan.name === "manager") routes.push(`/staff/${account("staff","A").user_id}`);
  if(plan.name === "brand_owner") routes.push(`/branches/${BRANCH.A}`);
  for(const width of [1440,390]){
   const locale=width===390?"de":"en";
   const page=await authenticatedPage(browser,who,{viewport:{width,height:960},hasTouch:width===390,reducedMotion:"reduce"});
   await page.context().addCookies([{name:"lang",value:locale,url:BASE_URL}]);
   const errors:string[]=[];page.on("pageerror",error=>errors.push(error.message));
   for(const route of routes){
    errors.length=0;const problems:string[]=[];let loaded=false;
    try {
     const response=await page.goto(route,{waitUntil:"domcontentloaded"});
     if(response&&response.status()>=400)problems.push(`HTTP ${response.status()}`);
     await expect(page.locator("#main-content")).toBeVisible({timeout:20000});
     await expect(page.locator("#main-content h1:visible")).toHaveCount(1,{timeout:20000});
     await page.waitForFunction(()=>{
      const main=document.querySelector("#main-content");if(!main)return false;
      const loading=[...main.querySelectorAll('[style*="schShimmer"],[aria-busy="true"]')].some(e=>e.checkVisibility());
      const status=[...main.querySelectorAll('[role="status"]')].some(e=>e.checkVisibility()&&/loading|wird geladen|werden geladen|lädt/i.test(e.textContent||""));
      return !loading&&!status;
     },undefined,{timeout:20000});
     loaded=true;
     await page.evaluate(()=>document.documentElement.classList.add("light"));
     const layout=await page.evaluate(()=>{
      const outside=[...document.querySelectorAll<HTMLElement>('#main-content button,#main-content input,#main-content select,.header-right a,.header-right button')]
       .filter(e=>e.checkVisibility()&&!e.closest('.table-scroll,.roster-days,.hub-tabs,.inventory-section-nav'))
       .filter(e=>{const r=e.getBoundingClientRect();return r.left<-.5||r.right>innerWidth+.5;}).length;
      const a=document.querySelector('.header-leading')?.getBoundingClientRect(),b=document.querySelector('.header-right')?.getBoundingClientRect();
      return {outside,overflow:document.documentElement.scrollWidth>innerWidth+1,headerOverlap:!!a&&!!b&&a.right>b.left+1};
     });
     if(layout.outside)problems.push(`${layout.outside} controls outside viewport`);
     if(layout.overflow)problems.push("page horizontal overflow");
     if(layout.headerOverlap)problems.push("header controls overlap");
     if(/\/login|\/no-access|\/change-password/.test(new URL(page.url()).pathname))problems.push("unexpected access redirect");
     const alerts=await page.locator('#main-content [role="alert"]').allTextContents();
     if(alerts.some(text=>/could not|couldn't|unavailable|failed|not available|nicht geladen|nicht verfügbar|fehlgeschlagen/i.test(text)))problems.push("visible data-load/access error");
     if(errors.length)problems.push(`${errors.length} browser runtime errors`);
     results.push({route,width,locale,loaded,layout,problems,alerts,errors:[...errors]});
    } catch(error){
     problems.push(error instanceof Error?error.message.split("\n")[0]:"navigation/loading failed");
     results.push({route,width,locale,loaded,problems});
    }
    const file=`${plan.name}-${width}-${route.replace(/[^a-zA-Z0-9]+/g,"-")||"home"}.png`;
    await page.screenshot({path:join(output,file),fullPage:true,animations:"disabled"}).catch(()=>{});
    if(problems.length)failures.push(`${route} @ ${width}: ${problems.join("; ")}`);
   }
   await page.context().close();
  }
 } finally {
  if(insertedLeader){const removed=await admin().from("shift_leaders").delete().eq("branch_id",BRANCH.A).eq("user_id",who.user_id);if(removed.error)failures.push("Synthetic shift-leader designation cleanup failed");}
  const report=JSON.stringify({role:plan.name,results,failures},null,2);
  writeFileSync(join(output,`${plan.name}.json`),report);
  await info.attach(`${plan.name}-review`,{body:report,contentType:"application/json"});
  for(const context of openContexts.splice(0))await context.close();
 }
 expect(failures,`${plan.name} visual review issues`).toEqual([]);
});
