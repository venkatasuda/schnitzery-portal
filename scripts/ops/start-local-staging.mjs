// Starts the isolated source snapshot, never the production-configured workspace.
import { existsSync, readFileSync, mkdirSync, copyFileSync, cpSync, symlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { uiReviewFingerprint } from "./ui-review-source.mjs";

const root = fileURLToPath(new URL("../../", import.meta.url));
const snapshot = resolve(root, ".audit-db/local-staging/app");
const reviewCurrent = process.argv.includes("--ui-review");
const port = reviewCurrent ? "3117" : "3100";
// Keep the fresh source mirror on the dependency drive: Windows cannot relativize cross-drive webpack entries.
// No environment or credential file is copied into this source mirror.
const app = reviewCurrent ? resolve(root, "..", `schnitzery-ui-review-${Date.now().toString(36)}`) : snapshot;
const envFile = resolve(snapshot, ".env.local");
if (!existsSync(envFile)) throw Error("Local staging is not configured: missing isolated app/.env.local.");
const config = parseEnv(readFileSync(envFile, "utf8"));
const api = new URL(config.NEXT_PUBLIC_SUPABASE_URL);
if (api.origin !== "http://127.0.0.1:55321" || api.username || api.password
    || api.pathname !== "/" || api.search || api.hash)
  throw Error("Refusing staging startup: Supabase must target http://127.0.0.1:55321 only.");
for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!config[key]) throw Error(`Missing local ${key}.`);
if (reviewCurrent && !process.argv.includes("--check")) {
  mkdirSync(app, { recursive: true });
  for (const name of ["src", "public"]) cpSync(resolve(root, name), resolve(app, name), { recursive: true });
  for (const name of ["package.json", "package-lock.json", "next.config.ts", "postcss.config.mjs", "tsconfig.json", "next-env.d.ts", "sentry.server.config.ts", "sentry.edge.config.ts"])
    if (existsSync(resolve(root, name))) copyFileSync(resolve(root, name), resolve(app, name));
  symlinkSync(resolve(root, "node_modules"), resolve(app, "node_modules"), "junction");
  writeFileSync(resolve(app, "public/ui-review-marker.json"), JSON.stringify({ kind: "schnitzery-ui-review", fingerprint: uiReviewFingerprint(root) }));
  console.log(`Current-code UI review mirror: ${app}`);
}
if (!reviewCurrent && !existsSync(resolve(app, "package.json"))) throw Error("Missing isolated source snapshot.");
console.log(`Local staging: http://[::1]:${port} — database API on port 55321.`);
if (!process.argv.includes("--check")) {
  // --fast: production build + start. Dev mode compiles every page on first visit
  // (a minute or more each on a busy laptop), which makes UI walkthroughs crawl.
  const next = resolve(root, "node_modules/next/dist/bin/next");
  const fast = process.argv.includes("--fast"), ai = process.argv.includes("--ai");
  const args = fast ? ["start", "--hostname", "::1", "--port", port] : ["dev", "--webpack", "--hostname", "::1", "--port", port];
  if (fast) {
    console.log("Building the staging copy (one-off, a few minutes)…");
    const build = spawnSync(process.execPath, [next, "build", "--webpack"], { cwd: app, stdio: "inherit", env: { ...process.env, ...config, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1", SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "" } });
    if (build.status !== 0) { process.exitCode = build.status ?? 1; throw Error("Staging build failed."); }
  }
  const child = spawn(process.execPath, [next, ...args], {
    cwd: app, stdio: "inherit", env: {
      ...process.env, ...config, NODE_ENV: fast ? "production" : "development", AGENT_CHAT_ENABLED: "false",
      // AI stays off on staging unless started with --ai (then the key and flag from app/.env.local are used).
      ANTHROPIC_API_KEY: ai ? (config.ANTHROPIC_API_KEY ?? "") : "", DELIVERY_NOTE_AI_ENABLED: ai ? "true" : "false", SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "",
      VAPID_PRIVATE_KEY: "", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
