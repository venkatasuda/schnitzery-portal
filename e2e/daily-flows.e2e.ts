import { test, expect, type Page } from "@playwright/test";
import { account, admin, BRANCH, expectToast, signIn, unique } from "./local";

// The five flows the restaurants run every day. Each test cleans up what it creates.

async function addCatalogProduct(page: Page, product: string) {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Catalog" }).click();
  await page.getByRole("button", { name: /Add Product to Catalog/ }).click();
  await page.getByLabel("Category", { exact: true }).fill("E2E");
  await page.getByLabel("Product", { exact: true }).fill(product);
  await page.getByLabel(/^Target/).fill("10");
  await page.getByLabel("Unit", { exact: true }).fill("kg");
  await page.getByRole("button", { name: "Add Product", exact: true }).click();
  await expectToast(page, "Product added");
}

async function removeCatalogProduct(page: Page, product: string) {
  await page.goto("/inventory");
  await page.getByRole("button", { name: "Catalog" }).click();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: `Remove product: ${product}` }).click();
  await expectToast(page, "Product removed");
}

test("staff clock in and clock out", async ({ browser }) => {
  const page = await signIn(browser, account("staff"), { geo: true });
  await page.goto("/attendance");
  const clockOut = page.getByRole("button", { name: /Clock Out/ });
  // A previous failed run may have left the shift open; close it first.
  if (await clockOut.isVisible().catch(() => false)) { await clockOut.click(); await expectToast(page, /Clocked out/); }
  await page.getByRole("button", { name: /Clock In Now/ }).click();
  await expectToast(page, /Clocked in/);
  await expect(clockOut).toBeEnabled();
  await clockOut.click();
  await expectToast(page, /Clocked out/);
  await expect(page.getByRole("button", { name: /Clock In Now/ })).toBeVisible();
});

test("manager counts stock", async ({ browser }) => {
  const page = await signIn(browser, account("manager"));
  const product = unique("Count");
  await addCatalogProduct(page, product);
  try {
    await page.getByRole("button", { name: "Stock Count" }).click();
    await page.getByLabel(`Count: ${product} (kg)`).fill("7");
    await page.getByRole("button", { name: `Count: ${product}` }).click();
    await expectToast(page, `${product} counted`);
    const row = page.getByRole("row").filter({ hasText: product });
    await expect(row).toContainText("7 kg");
    await expect(row).toContainText("Below target");
  } finally {
    await removeCatalogProduct(page, product);
  }
});

test("manager saves the roster", async ({ browser }) => {
  const page = await signIn(browser, account("manager"));
  const staffName = "LOCAL TEST staff A", staffId = account("staff").user_id;
  await page.goto("/roster");
  await page.getByRole("button", { name: /Next/ }).click(); // next week: never today's live plan
  const save = page.getByRole("button", { name: "Save roster" });
  await expect(save).toBeEnabled();
  await page.getByRole("button", { name: "+ Add" }).first().click();
  await page.getByLabel("Staff", { exact: true }).selectOption(staffId);
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await save.click();
  await expectToast(page, "Roster saved");

  await page.reload();
  await page.getByRole("button", { name: /Next/ }).click();
  const remove = page.getByRole("button", { name: `Remove shift for ${staffName}` }).first();
  await expect(remove).toBeVisible(); // persisted after reload
  await remove.click();
  await page.getByRole("button", { name: "Save roster" }).click();
  await expectToast(page, "Roster saved");
});

test("transfer between branches: request, send, receive", async ({ browser }) => {
  const supplier = await signIn(browser, account("manager", "B"));
  const requester = await signIn(browser, account("manager", "A"));
  const product = unique("Transfer");
  await addCatalogProduct(supplier, product);
  try {
    await requester.goto("/transfers");
    await requester.getByRole("button", { name: /New request/ }).click();
    await requester.getByLabel("Request from branch").selectOption({ label: "LOCAL TEST Branch B" });
    await requester.getByLabel("Search product…").fill(product);
    await requester.getByRole("button", { name: new RegExp(product) }).click();
    await requester.getByLabel("Qty", { exact: true }).fill("2");
    await requester.getByRole("button", { name: "Send request" }).click();
    const mine = requester.locator(".card, li, tr").filter({ hasText: product }).first();
    await expect(mine).toContainText("Requested");

    await supplier.goto("/transfers");
    await supplier.getByRole("button", { name: /Requests to me/ }).click();
    const incoming = supplier.locator(".card, li, tr").filter({ hasText: product }).first();
    await incoming.getByRole("button", { name: "Mark sent" }).click();
    await expect(incoming).toContainText("Sent");

    await requester.reload();
    const sent = requester.locator(".card, li, tr").filter({ hasText: product }).first();
    await sent.getByRole("button", { name: "Confirm received" }).click();
    await expect(sent).toContainText("Received");
  } finally {
    await removeCatalogProduct(supplier, product);
  }
});

test("manager approves and reopens payroll", async ({ browser }) => {
  // Seed one approved, complete shift in a closed month far in the past, plus a wage
  // effective before it. Synthetic local data only.
  const db = admin(), staff = account("staff"), month = "2020-01";
  await db.from("attendance_logs").delete().eq("user_id", staff.user_id).gte("work_date", `${month}-01`).lte("work_date", `${month}-31`);
  const { data: wage } = await db.from("wage_history").insert({ user_id: staff.user_id, branch_id: BRANCH.A, hourly_wage: 15, effective_from: "2000-01-01" }).select("id").single();
  const { data: log, error } = await db.from("attendance_logs").insert({
    user_id: staff.user_id, branch_id: BRANCH.A, work_date: `${month}-15`, status: "complete", approval_status: "approved",
    clock_in: `${month}-15T07:00:00Z`, clock_out: `${month}-15T15:00:00Z`, duration_mins: 480, source: "online",
  }).select("id").single();
  expect(error, error?.message).toBeNull();
  try {
    const page = await signIn(browser, account("manager"));
    await page.goto("/export");
    await page.locator("#payroll-month").fill(month);
    const approve = page.getByRole("button", { name: "Approve month" });
    await expect(approve).toBeEnabled();
    await approve.click();
    await expectToast(page, "Month approved");
    await page.getByRole("button", { name: "Reopen" }).click();
    await expectToast(page, "Reopened for editing");
    await expect(page.getByRole("button", { name: "Approve month" })).toBeVisible();
  } finally {
    if (log) await db.from("attendance_logs").delete().eq("id", log.id);
    if (wage) await db.from("wage_history").delete().eq("id", wage.id);
  }
});
