// ============================================================
// One-time bulk staff creation for Schnitzery Stuttgart.
// Creates a real auth account + users row for each colleague.
// Run once:  node seed-stuttgart-team.mjs
//
// Requires .env.local with:
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY   (admin key — server only, never commit)
// ============================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

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

const admin = createClient(URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BRANCH_ID = "20b8cb3e-2046-40d7-9f5e-c7ef18261bd6"; // Schnitzery Stuttgart
const TEMP_PASSWORD = "Schnitzery2026!";
const EMAIL_DOMAIN = "schnitzery-stuttgart.de";

// team -> code prefix
const PREFIX = { Kitchen: "KIT", Preparation: "PREP", Cashier: "CASH", Manager: "MGR", Dishwashing: "DISH" };

// [first, team, role, contract, hours, phone]
const TEAM = [
  ["Abhi","Kitchen","staff","Working Student",80,"+4915563656077"],
  ["Achsah","Kitchen","staff","Working Student",80,"+917736879373"],
  ["Ajinkya","Kitchen","staff","Mini Job",80,"+4917625364037"],
  ["Alfredo","Cashier","staff","Full Time",160,"+4915213487335"],
  ["Amir","Kitchen","staff","Working Student",80,"+9779815902561"],
  ["Asit","Kitchen","staff","Working Student",80,"+919067474203"],
  ["Attilio","Preparation","staff","Full Time",160,"+4915124890838"],
  ["Bhargav","Kitchen","staff","Working Student",80,"+919328323426"],
  ["Gouri","Kitchen","staff","Working Student",80,"+4915510158878"],
  ["Jeph","Kitchen","staff","Working Student",80,"+919633101773"],
  ["Jijo","Kitchen","staff","Working Student",80,"+4915511047107"],
  ["Joann","Kitchen","staff","Working Student",80,"+491622148215"],
  ["Mridhual","Kitchen","staff","Mini Job",80,"+918848857350"],
  ["Nithin","Kitchen","staff","Full Time",160,"+4915146354138"],
  ["Om","Manager","manager","Working Student",80,"+4915218982868"],
  ["Parth","Kitchen","staff","Working Student",80,"+491706956535"],
  ["Parthiv","Kitchen","staff","Working Student",80,"+4914463854238"],
  ["Prabin","Kitchen","staff","Working Student",80,"+491632120379"],
  ["Pritesh","Manager","manager","Full Time",160,"+4915568927507"],
  ["Razeev","Kitchen","staff","Working Student",80,"+491632120735"],
  ["Varghese","Kitchen","staff","Working Student",80,"+4915511047565"],
  ["Varunjith","Kitchen","staff","Working Student",80,"+4915255425288"],
  ["Vijay","Kitchen","staff","Working Student",80,"+4915565685501"],
  ["Wajdi","Kitchen","staff","Full Time",160,"+4917681260001"],
  ["Yash","Kitchen","staff","Working Student",80,"+4917623675492"],
  ["Mari","Cashier","staff","Working Student",80,"+491631431004"],
  ["Brandi","Cashier","staff","Working Student",80,"+491738555991"],
  ["Ekta","Preparation","staff","Working Student",80,"+4915565575791"],
  ["Noor Ali","Preparation","staff","Full Time",160,"+4915510686564"],
  ["Nishan","Preparation","staff","Working Student",80,null],
  ["Babita","Preparation","staff","Working Student",80,"+9779862492338"],
  ["Anuja","Preparation","staff","Working Student",80,"+4915164368887"],
  ["Hasen","Dishwashing","staff","Full Time",160,null],
  ["Chacha","Dishwashing","staff","Full Time",160,null],
];

function slug(name) {
  return name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z]/g, "");
}

async function run() {
  const counters = {};
  let created = 0, skipped = 0, failed = 0;
  const summary = [];

  for (const [first, team, role, contract, hours, phone] of TEAM) {
    counters[team] = (counters[team] || 0) + 1;
    const code = `${PREFIX[team]}-${String(counters[team]).padStart(3, "0")}`;
    const email = `${slug(first)}.${code.toLowerCase()}@${EMAIL_DOMAIN}`;

    // 1. create auth user
    const { data: created_user, error: authErr } = await admin.auth.admin.createUser({
      email,
      password: TEMP_PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: first },
    });

    if (authErr) {
      if (authErr.message?.toLowerCase().includes("already")) {
        console.log(`⏭  ${first} (${email}) — already exists, skipping`);
        skipped++;
      } else {
        console.log(`❌ ${first} (${email}) — ${authErr.message}`);
        failed++;
      }
      continue;
    }

    const id = created_user.user?.id;

    // 2. upsert users row (trigger may have created a base row)
    const { error: rowErr } = await admin.from("users").upsert({
      id,
      full_name: first,
      email,
      team,
      role,
      employee_code: code,
      contract_type: contract,
      contract_hours: hours,
      phone: phone || null,
      branch_id: BRANCH_ID,
      status: "active",
    });

    if (rowErr) {
      console.log(`⚠  ${first} — auth created but row failed: ${rowErr.message}`);
      failed++;
    } else {
      console.log(`✅ ${first.padEnd(18)} ${code.padEnd(9)} ${email}`);
      summary.push({ first, code, email });
      created++;
    }
  }

  console.log("\n========================================");
  console.log(`Created: ${created} | Skipped: ${skipped} | Failed: ${failed}`);
  console.log(`Temp password for everyone: ${TEMP_PASSWORD}`);
  console.log("========================================");
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
