// Starts the isolated source snapshot, never the production-configured workspace.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { spawn } from "node:child_process";

const root = fileURLToPath(new URL("../../", import.meta.url));
const app = resolve(root, ".audit-db/local-staging/app");
const envFile = resolve(app, ".env.local");
if (!existsSync(envFile)) throw Error("Local staging is not configured: missing isolated app/.env.local.");
const config = parseEnv(readFileSync(envFile, "utf8"));
const api = new URL(config.NEXT_PUBLIC_SUPABASE_URL);
if (api.origin !== "http://127.0.0.1:55321" || api.username || api.password
    || api.pathname !== "/" || api.search || api.hash)
  throw Error("Refusing staging startup: Supabase must target http://127.0.0.1:55321 only.");
for (const key of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"])
  if (!config[key]) throw Error(`Missing local ${key}.`);
if (!existsSync(resolve(app, "package.json"))) throw Error("Missing isolated source snapshot.");
console.log("Local staging: http://schnitzery.localhost:3100 — database API on port 55321.");
if (!process.argv.includes("--check")) {
  const child = spawn(process.execPath, [resolve(root, "node_modules/next/dist/bin/next"), "dev", "--webpack", "--hostname", "::1", "--port", "3100"], {
    cwd: app, stdio: "inherit", env: {
      ...process.env, ...config, NODE_ENV: "development", AGENT_CHAT_ENABLED: "false",
      ANTHROPIC_API_KEY: "", SENTRY_DSN: "", NEXT_PUBLIC_SENTRY_DSN: "", SENTRY_AUTH_TOKEN: "",
      VAPID_PRIVATE_KEY: "", NEXT_PUBLIC_VAPID_PUBLIC_KEY: "", NEXT_TELEMETRY_DISABLED: "1",
    },
  });
  child.on("error", error => { console.error(error.message); process.exitCode = 1; });
  child.on("exit", code => { process.exitCode = code ?? 1; });
}
