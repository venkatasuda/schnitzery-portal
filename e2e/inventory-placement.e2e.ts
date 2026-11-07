import { test, expect } from "@playwright/test";
import { account, authenticatedPage, openContexts } from "./local";

test.afterEach(async () => { for (const context of openContexts.splice(0)) await context.close(); });

test("Purchasing task links survive reload and browser Back without duplicate order actions", async ({ browser }, info) => {
  test.setTimeout(600_000);
  const page = await authenticatedPage(browser, account("manager"));
  await page.goto("/inventory/purchasing?tab=suppliers");
  await expect(page.getByRole("heading", { level: 1, name: "Suppliers", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Receive a delivery", exact: true })).toHaveCount(0);
  await expect(page.getByText("Direct delivery receipts · latest 40",{exact:true})).toHaveCount(0);
  const tasks = page.getByRole("navigation", { name: "Tasks in this area", exact: true });
  await tasks.getByRole("link", { name: "Returns & credits", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Returns & credits", exact: true })).toBeVisible();
  await expect(page.getByText("Direct delivery receipts · latest 40",{exact:true})).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Returns & credits", exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Suppliers", exact: true })).toBeVisible();
  await tasks.getByRole("link", { name: "Purchase orders", exact: true }).click();
  await expect(page.getByRole("button", { name: "Receive a delivery", exact: true })).toBeVisible();
  await expect(page.getByText("Direct delivery receipts · latest 40",{exact:true})).toBeVisible();
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    await info.attach(`purchasing-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: "image/png" });
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto("/inventory/consumption");
  const current=page.locator('.inventory-section-nav a[aria-current="page"]');
  await expect.poll(()=>current.evaluate(element=>{const bounds=element.getBoundingClientRect(),parent=element.parentElement!.getBoundingClientRect();return bounds.left>=parent.left-1&&bounds.right<=parent.right+1;})).toBe(true);
});
