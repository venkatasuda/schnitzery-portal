import { defineConfig } from "@playwright/test";
import { BASE_URL } from "./local";

// Browser tests for the daily flows. They run ONLY against local staging
// (see docs/ops/E2E.md) — local.ts refuses any other host.
export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  workers: 1, // flows share one synthetic branch; run them in order
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  reporter: [["list"], ["html", { open: "never", outputFolder: "../.audit-db/e2e-report" }]],
  outputDir: "../.audit-db/e2e-results",
  use: {
    baseURL: BASE_URL,
    locale: "en-GB",
    timezoneId: "Europe/Berlin",
    // Uses the installed Chrome; set E2E_CHANNEL="" to use Playwright's own Chromium.
    channel: process.env.E2E_CHANNEL ?? "chrome",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
