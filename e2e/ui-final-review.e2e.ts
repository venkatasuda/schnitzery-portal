import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { uiReviewFingerprint } from '../scripts/ops/ui-review-source.mjs';
import { account, authenticatedPage, openContexts, BASE_URL } from './local';

const output=join(homedir(),'Documents/Codex/schnitzery-signed-in-review-2026-11-14-verified/final');
test.beforeAll(async({browser})=>{
 const page=await authenticatedPage(browser,account('manager','A'));
 try {
  const response=await page.request.get('/ui-review-marker.json');expect(response.ok()).toBe(true);
  const marker=await response.json();expect(marker.kind).toBe('schnitzery-ui-review');
  expect(marker.fingerprint).toBe(uiReviewFingerprint(join(__dirname,'..')));
  mkdirSync(output,{recursive:true});
 }finally{await page.context().close();}
});
test.afterEach(async()=>{for(const context of openContexts.splice(0))await context.close();});

for(const plan of [
 {role:'staff',paths:['/']},
 {role:'manager',paths:['/inventory/prices','/labor','/schedule-hub','/schedule/compare','/team-today']},
 {role:'brand_owner',paths:['/my-branches']},
] as const) test(`final corrected screens: ${plan.role}`,async({browser})=>{
 test.setTimeout(300_000);
 for(const width of [375,1920]){
  const page=await authenticatedPage(browser,account(plan.role,'A'),{viewport:{width,height:960},hasTouch:width===375,reducedMotion:'reduce'});
  await page.context().addCookies([{name:'lang',value:'de',url:BASE_URL}]);
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  for(const path of plan.paths){
   errors.length=0;await page.goto(path,{waitUntil:'domcontentloaded'});
   await expect(page.locator('#main-content h1:visible')).toHaveCount(1);
   await page.waitForFunction(()=>![...document.querySelectorAll('#main-content [style*="schShimmer"],#main-content [aria-busy="true"]')].some(e=>e.checkVisibility()));
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`${path}: page overflow`).toBe(true);
   if(path==='/inventory/prices')expect(await page.locator('input[type=file]').evaluate(el=>el.getBoundingClientRect().right<=innerWidth)).toBe(true);
   expect(await page.locator('#main-content [role=alert]').allTextContents(),`${path}: load errors`).toEqual([]);
   expect(errors,`${path}: runtime errors`).toEqual([]);
   if(path==='/my-branches'){
    expect(await page.locator('.table-scroll').first().evaluate(el=>getComputedStyle(el).position)).toBe('relative');
    if(width===375){await page.locator('.table-scroll').first().evaluate(el=>{el.scrollLeft=el.scrollWidth;});await expect(page.locator('.table-scroll').first().getByRole('button').first()).toBeVisible();}
   }
   await page.screenshot({path:join(output,`${plan.role}-${width}-${path.replace(/[^a-z0-9]+/gi,'-')||'home'}.png`),fullPage:true,animations:'disabled'});
  }
  await page.context().close();
 }
});
