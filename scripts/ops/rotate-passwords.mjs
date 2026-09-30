// ============================================================================
// Rotate the seeded shared password.
//
// `[REDACTED-PASSWORD]` was published in a public repo for 43 days (2026-06-05 to
// 2026-07-18). Every account that has not yet changed it is still using it.
// This gives each of those accounts its own random password.
//
// Only touches accounts where must_change_password = true — i.e. people who
// never signed in and changed it themselves. Anyone who already set their own
// password is left completely alone.
//
// RUN:
//   node rotate-passwords.mjs            → dry run, shows who would change
//   node rotate-passwords.mjs --apply    → actually rotates
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync } from "fs";
import { randomBytes } from "crypto";

const OUT_FILE = "rotated.passwords.txt";
const APPLY = process.argv.includes("--apply");

function loadEnv() {
  const env = {};
  try {
    const txt = readFileSync(".env.local", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch (e) {
    console.error("Could not read .env.local:", e.message);
    process.exit(1);
  }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const makePassword = () => randomBytes(12).toString("base64url");

async function run() {
  const { data: users, error } = await admin
    .from("users")
    .select("id, full_name, email, employee_code, role, must_change_password")
    .eq("must_change_password", true)
    .order("role")
    .order("full_name");

  if (error) { console.error("Query failed:", error.message); process.exit(1); }

  if (!users || users.length === 0) {
    console.log("Nothing to do — every account has already set its own password.");
    return;
  }

  console.log(`${users.length} account(s) still on the seeded password:\n`);
  for (const u of users) {
    const flag = ["manager", "branch_owner", "brand_owner", "super_admin"].includes(u.role) ? "  <-- MANAGER" : "";
    console.log(`  ${(u.full_name || "?").padEnd(18)} ${(u.employee_code || "").padEnd(9)} ${u.role.padEnd(13)} ${u.email}${flag}`);
  }

  if (!APPLY) {
    console.log(`\nDRY RUN — nothing changed.`);
    console.log(`Re-run with --apply to rotate these ${users.length} password(s):`);
    console.log(`  node rotate-passwords.mjs --apply`);
    return;
  }

  console.log("\nRotating...\n");
  const secrets = [];
  let done = 0, failed = 0;

  for (const u of users) {
    const password = makePassword();
    const { error: upErr } = await admin.auth.admin.updateUserById(u.id, { password });
    if (upErr) {
      console.log(`FAIL  ${u.full_name} — ${upErr.message}`);
      failed++;
      continue;
    }
    // must_change_password stays true — they still set their own on first login.
    console.log(`ok    ${(u.full_name || "?").padEnd(18)} ${u.email}`);
    secrets.push(`${u.full_name}\t${u.employee_code || ""}\t${u.email}\t${password}`);
    done++;
  }

  if (secrets.length) {
    writeFileSync(
      OUT_FILE,
      "Rotated " + new Date().toISOString() + "\n" +
      "Replaces the shared password that was public 2026-06-05 to 2026-07-18.\n" +
      "Hand these out individually, then DELETE THIS FILE.\n" +
      "Each person must still set their own on first sign-in.\n\n" +
      "name\tcode\temail\ttemporary password\n" + secrets.join("\n") + "\n",
      "utf8",
    );
  }

  console.log(`\n========================================`);
  console.log(`Rotated: ${done} | Failed: ${failed}`);
  console.log(`Written to ${OUT_FILE} — hand out, then delete.`);
  console.log(`That file is gitignored but is still plaintext credentials on disk.`);
  console.log(`========================================`);
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
