import { test, expect } from "@playwright/test";
import { account, addCatalogProduct, admin, BRANCH, openContexts, signIn, unique } from "./local";

// Multi-branch (docs/MULTI-BRANCH.md): a manager linked to a second branch switches
// with the header picker, and data entered there lands in THAT branch only.
test.afterEach(async () => { for (const c of openContexts.splice(0)) await c.close(); });

test("linked manager switches branch and works in it", async ({ browser }) => {
  const db = admin(), mgr = account("manager", "A"), product = unique("Branch");
  await db.from("user_branches").upsert({ user_id: mgr.user_id, branch_id: BRANCH.B }, { onConflict: "user_id,branch_id" });
  try {
    const page = await signIn(browser, mgr);
    const picker = page.getByRole("combobox", { name: "Branch" });
    await expect(picker).toBeVisible(); // only shown with 2+ branches

    // Overview lists both branches.
    await picker.selectOption({ label: "All my branches" });
    await expect(page).toHaveURL(/\/my-branches/);
    const overview = page.getByRole("region", { name: "All my branches" }); // the comparison table repeats the names
    await expect(overview.getByRole("rowheader", { name: "LOCAL TEST Branch A" })).toBeVisible();
    await expect(overview.getByRole("rowheader", { name: "LOCAL TEST Branch B" })).toBeVisible();

    // Open branch B, add a catalogue product, and check where it was stored.
    await page.getByRole("button", { name: "Open: LOCAL TEST Branch B" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("combobox", { name: "Branch" })).toHaveValue(BRANCH.B);
    await addCatalogProduct(page,product);
    const { data } = await db.from("inventory_master").select("branch_id").eq("product", product);
    expect(data?.map((r) => r.branch_id)).toEqual([BRANCH.B]);
  } finally {
    await db.from("inventory_master").update({ is_active: false }).eq("product", product);
    await db.from("user_branches").delete().eq("user_id", mgr.user_id).eq("branch_id", BRANCH.B);
  }
});

test("a forged branch cookie falls back to the home branch", async ({ browser }) => {
  const page = await signIn(browser, account("manager", "B")); // not linked to A
  await page.context().addCookies([{ name: "sch_branch", value: BRANCH.A, url: page.url() }]);
  await page.goto("/inventory");
  const product = unique("Forged");
  await addCatalogProduct(page,product);
  const db = admin();
  const { data } = await db.from("inventory_master").select("branch_id").eq("product", product);
  expect(data?.map((r) => r.branch_id)).toEqual([BRANCH.B]); // never branch A
  await db.from("inventory_master").update({ is_active: false }).eq("product", product);
});
