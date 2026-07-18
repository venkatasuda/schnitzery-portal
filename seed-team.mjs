// ============================================================================
// Bulk staff creation from an UNTRACKED roster file.
//
// Replaces seed-stuttgart-team.mjs, which hard-coded ~30 real employees'
// names, contract details and mobile numbers directly in the source — and was
// pushed to a public repository. See PRODUCTION-AUDIT.md item 5.
//
// TWO THINGS CHANGED, both deliberate:
//   1. The roster lives in team.roster.csv, which is gitignored. Personal data
//      never enters version control again.
//   2. Every person gets their OWN random password instead of one shared value
//      hard-coded in the script. A shared password means any employee can sign
//      in as any colleague who hasn't logged in yet — including a manager.
//
// SETUP
//   1. Create team.roster.csv next to this file (see format below).
//   2. Ensure .env.local has NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
//   3. node seed-team.mjs
//   4. Passwords print ONCE to a file. Hand them out, then delete it.
//
// CSV FORMAT — header row required:
//   first_name,team,role,contract_type,contract_hours,phone
//   Example,Kitchen,staff,Working Student,80,PHONE_NUMBER_HERE
//   NoPhone,Preparation,staff,Working Student,80,
//
//   role must be one of: staff manager branch_owner brand_owner super_admin kiosk
//   phone may be blank.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomBytes } from "crypto";

const ROSTER_FILE = "team.roster.csv";
const SECRETS_FILE = "team.passwords.txt";

// --- config you must set for your branch ---
const BRANCH_ID = process.env.SEED_BRANCH_ID || "";
const EMAIL_DOMAIN = process.env.SEED_EMAIL_DOMAIN || "schnitzery-stuttgart.de";
const PREFIX = { Kitchen: "KIT", Preparation: "PREP", Cashier: "CASH", Manager: "MGR", Dishwashing: "DISH" };
const VALID_ROLES = ["staff", "manager", "branch_owner", "brand_owner", "super_admin", "kiosk"];

// --- load .env.local manually (simple parser) ---
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
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const branchId = BRANCH_ID || env.SEED_BRANCH_ID;
if (!branchId) {
  console.error("Set SEED_BRANCH_ID (env var or .env.local) to the target branch UUID.");
  process.exit(1);
}

if (!existsSync(ROSTER_FILE)) {
  console.error(`Missing ${ROSTER_FILE}. Create it — see the header of this file for the format.`);
  console.error("Do NOT commit it; .gitignore already excludes *.roster.csv");
  process.exit(1);
}

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Minimal CSV reader. Fields must not contain commas — keep the roster simple.
function readRoster() {
  const lines = readFileSync(ROSTER_FILE, "utf8").split(/\r?\n/).filter((l) => l.trim());
  const header = lines.shift().split(",").map((h) => h.trim());
  const need = ["first_name", "team", "role", "contract_type", "contract_hours", "phone"];
  for (const col of need) {
    if (!header.includes(col)) { console.error(`${ROSTER_FILE} is missing column: ${col}`); process.exit(1); }
  }
  return lines.map((line, i) => {
    const cells = line.split(",").map((c) => c.trim());
    const row = {};
    header.forEach((h, idx) => { row[h] = cells[idx] ?? ""; });
    if (!row.first_name) { console.error(`Row ${i + 2}: first_name is empty`); process.exit(1); }
    if (!VALID_ROLES.includes(row.role)) {
      console.error(`Row ${i + 2} (${row.first_name}): invalid role "${row.role}". Must be one of: ${VALID_ROLES.join(" ")}`);
      process.exit(1);
    }
    if (!PREFIX[row.team]) {
      console.error(`Row ${i + 2} (${row.first_name}): unknown team "${row.team}". Must be one of: ${Object.keys(PREFIX).join(" ")}`);
      process.exit(1);
    }
    return row;
  });
}

// 16 chars of url-safe randomness — unique per person, never reused, never in Git.
function makePassword() {
  return randomBytes(12).toString("base64url");
}

function slug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
}

async function run() {
  const roster = readRoster();
  const counters = {};
  let created = 0, skipped = 0, failed = 0;
  const secrets = [];

  console.log(`Seeding ${roster.length} people into branch ${branchId}\n`);

  for (const r of roster) {
    counters[r.team] = (counters[r.team] || 0) + 1;
    const code = `${PREFIX[r.team]}-${String(counters[r.team]).padStart(3, "0")}`;
    const email = `${slug(r.first_name)}.${code.toLowerCase()}@${EMAIL_DOMAIN}`;
    const password = makePassword();

    const { data: createdUser, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: r.first_name },
    });

    if (authErr) {
      if (authErr.message?.toLowerCase().includes("already")) {
        console.log(`skip    ${r.first_name} (${email}) — already exists`);
        skipped++;
      } else {
        console.log(`FAIL    ${r.first_name} (${email}) — ${authErr.message}`);
        failed++;
      }
      continue;
    }

    const hours = r.contract_hours === "" || Number.isNaN(Number(r.contract_hours))
      ? null : Number(r.contract_hours);

    const { error: rowErr } = await admin.from("users").upsert({
      id: createdUser.user?.id,
      full_name: r.first_name,
      email,
      team: r.team,
      role: r.role,
      employee_code: code,
      contract_type: r.contract_type || null,
      contract_hours: hours,
      phone: r.phone || null,
      branch_id: branchId,
      status: "active",
      must_change_password: true,   // they must set their own on first sign-in
    });

    if (rowErr) {
      console.log(`WARN    ${r.first_name} — auth created but row failed: ${rowErr.message}`);
      failed++;
    } else {
      console.log(`ok      ${r.first_name.padEnd(18)} ${code.padEnd(9)} ${email}`);
      secrets.push(`${r.first_name}\t${email}\t${password}`);
      created++;
    }
  }

  if (secrets.length) {
    writeFileSync(
      SECRETS_FILE,
      "DELETE THIS FILE once the passwords have been handed out.\n" +
      "Each person must change theirs on first sign-in (must_change_password is set).\n\n" +
      "name\temail\ttemporary password\n" + secrets.join("\n") + "\n",
      "utf8",
    );
  }

  console.log("\n========================================");
  console.log(`Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`);
  if (secrets.length) {
    console.log(`Passwords written to ${SECRETS_FILE} — hand them out, then DELETE that file.`);
    console.log("It is gitignored, but it is still plaintext credentials on your disk.");
  }
  console.log("========================================");
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
