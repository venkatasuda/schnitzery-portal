// ============================================================================
// DEMO ACCOUNTS — one per role, for evaluation / a pitch.
//
// Creates four logins a reviewer can use to explore each portal themselves:
//   demo.owner@…    brand_owner   (HQ oversight + branch toggle)
//   demo.branch@…   branch_owner  (runs one branch)
//   demo.manager@…  manager       (branch toolkit)
//   demo.staff@…    staff         (employee view)
//
// They all share ONE known password (below) so you can hand them out, and
// must_change_password is set FALSE so the reviewer isn't forced to change it
// on first login. That is deliberate for demo accounts only — it is the exact
// opposite of the real staff policy, which is why these are clearly named
// "demo.*" and should be DELETED after the evaluation (see the cleanup note at
// the bottom).
//
// RUN:  node create-demo-accounts.mjs
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Idempotent: re-running resets these accounts to a known-good state.
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const DEMO_PASSWORD = "SchnitzeryDemo!2026";
const EMAIL_DOMAIN = "schnitzery-demo.de";

const ACCOUNTS = [
  { key: "owner",   role: "brand_owner",  name: "Demo Owner",   team: "Management", code: "DEMO-OWN" },
  { key: "branch",  role: "branch_owner", name: "Demo Branch",  team: "Management", code: "DEMO-BRN" },
  { key: "manager", role: "manager",      name: "Demo Manager", team: "Management", code: "DEMO-MGR" },
  { key: "staff",   role: "staff",        name: "Demo Staff",   team: "Kitchen",    code: "DEMO-STF" },
];

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

// Find a branch to attach the demo accounts to. Uses the first active branch;
// if there are none, creates a "Demo Branch" so the portals have data to show.
async function resolveBranch() {
  const { data: existing } = await admin
    .from("branches").select("id, name").order("created_at", { ascending: true }).limit(1);
  if (existing && existing.length) return existing[0];

  const { data: created, error } = await admin
    .from("branches").insert({ name: "Demo Branch", is_active: true }).select("id, name").single();
  if (error) { console.error("Could not create a demo branch:", error.message); process.exit(1); }
  return created;
}

// Find or create the auth user, force the known password, return its id.
async function ensureAuthUser(email) {
  // Try to create; if it already exists, find it and reset its password.
  const created = await admin.auth.admin.createUser({
    email, password: DEMO_PASSWORD, email_confirm: true,
  });
  if (!created.error) return created.data.user.id;

  if (!created.error.message?.toLowerCase().includes("already")) {
    throw new Error(created.error.message);
  }
  // Already exists → locate by paging the user list, then reset password + unban.
  let page = 1;
  for (;;) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) {
      await admin.auth.admin.updateUserById(hit.id, { password: DEMO_PASSWORD, ban_duration: "none" });
      return hit.id;
    }
    if (data.users.length < 200) throw new Error(`Could not locate existing user ${email}`);
    page++;
  }
}

async function run() {
  const branch = await resolveBranch();
  console.log(`Attaching demo accounts to branch: ${branch.name} (${branch.id})\n`);

  const rows = [];
  for (const a of ACCOUNTS) {
    const email = `demo.${a.key}@${EMAIL_DOMAIN}`;
    try {
      const id = await ensureAuthUser(email);
      const { error } = await admin.from("users").upsert({
        id,
        email,
        full_name: a.name,
        team: a.team,
        role: a.role,
        employee_code: a.code,
        branch_id: branch.id,
        status: "active",
        must_change_password: false, // demo: let the reviewer log straight in
      });
      if (error) { console.log(`FAIL  ${a.role.padEnd(13)} ${email} — ${error.message}`); continue; }
      console.log(`ok    ${a.role.padEnd(13)} ${email}`);
      rows.push({ role: a.role, email });
    } catch (e) {
      console.log(`FAIL  ${a.role.padEnd(13)} ${email} — ${e.message}`);
    }
  }

  console.log("\n=====================  DEMO LOGINS  =====================");
  console.log(`Password for ALL four:  ${DEMO_PASSWORD}\n`);
  for (const r of rows) console.log(`  ${r.role.padEnd(13)}  ${r.email}`);
  console.log("=========================================================");
  console.log("These are DEMO accounts on the real database. Delete them after");
  console.log("the evaluation:  node create-demo-accounts.mjs --delete");
}

async function del() {
  for (const a of ACCOUNTS) {
    const email = `demo.${a.key}@${EMAIL_DOMAIN}`;
    let page = 1, found = null;
    for (;;) {
      const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
      found = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
      if (found || data.users.length < 200) break;
      page++;
    }
    if (found) {
      await admin.from("users").delete().eq("id", found.id);
      await admin.auth.admin.deleteUser(found.id);
      console.log(`deleted  ${email}`);
    } else {
      console.log(`skip     ${email} (not found)`);
    }
  }
}

(process.argv.includes("--delete") ? del() : run())
  .catch((e) => { console.error("Fatal:", e); process.exit(1); });
