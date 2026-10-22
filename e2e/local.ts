import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { expect, type Browser, type Page } from "@playwright/test";

// Safety: these tests create and delete records. They may only ever touch the
// local staging stack, never Vercel or the production Supabase project.
const STAGING = resolve(__dirname, "../.audit-db/local-staging");
const LOCAL = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+\.localhost)$/;

export const BASE_URL = process.env.E2E_BASE_URL || "http://[::1]:3100";
const base = new URL(BASE_URL);
if (!LOCAL.test(base.hostname)) throw new Error(`E2E refuses non-local host ${base.hostname}`);

type Role = "staff" | "manager" | "branch_owner" | "brand_owner";
type Account = { role: Role; branch: "A" | "B"; email: string; password: string; user_id: string };
let accounts: Account[] | null = null;
export function account(role: Role, branch: "A" | "B" = "A") {
  accounts ??= JSON.parse(readFileSync(resolve(STAGING, "test-accounts.passwords.txt"), "utf8")) as Account[];
  const a = accounts.find((x) => x.role === role && x.branch === branch);
  if (!a) throw new Error(`No synthetic ${role} account for branch ${branch}`);
  return a;
}

// Service-role client for seeding/cleanup, read from the staging snapshot's own env.
function stagingEnv() {
  const env: Record<string, string> = {};
  for (const line of readFileSync(resolve(STAGING, "app/.env.local"), "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].replace(/^"|"$/g, "");
  }
  return env;
}
/* eslint-disable @typescript-eslint/no-explicit-any -- seeding uses untyped tables */
let adminClient: SupabaseClient<any> | null = null;
export function admin() {
  if (adminClient) return adminClient;
  const env = stagingEnv(), url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  if (!/^http:\/\/(127\.0\.0\.1|localhost):55321\/?$/.test(url)) throw new Error("Staging env does not point at the local Supabase stack.");
  adminClient = createClient<any>(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
  return adminClient;
}

export const BRANCH = { A: "10000000-0000-4000-8000-000000000001", B: "10000000-0000-4000-8000-000000000002" };
export const unique = (label: string) => `E2E ${label} ${Date.now().toString(36)}`;

// Signed-in page in its own context (separate cookies per person), English UI.
export async function signIn(browser: Browser, who: Account, opts: { geo?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext(opts.geo ? { permissions: ["geolocation"], geolocation: { latitude: 48.7758, longitude: 9.1829 } } : {});
  await context.addCookies([{ name: "lang", value: "en", url: BASE_URL }]);
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Email").fill(who.email);
  await page.getByLabel("Password", { exact: true }).fill(who.password);
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page).not.toHaveURL(/\/login/);
  return page;
}

// Toasts confirm every write; wait for the success text, fail fast on an error toast.
export async function expectToast(page: Page, text: string | RegExp) {
  await expect(page.getByText(text).first()).toBeVisible();
}
