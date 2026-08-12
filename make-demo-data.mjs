// ============================================================================
// DEMO DATA — fills the demo branch so the portals look alive when a reviewer
// logs in (otherwise Inventory, Announcements etc. show empty screens).
//
// Seeds: a small inventory catalogue + today's counts, and two announcements.
// Idempotent: re-running replaces the demo rows rather than duplicating them.
//
// RUN:      node make-demo-data.mjs
// CLEAN UP: node make-demo-data.mjs --delete
//
// Requires .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
// Attaches to the same branch as create-demo-accounts.mjs (the first branch).
// ============================================================================

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const TAG = "[demo]"; // marks rows this script owns, so cleanup is safe

function loadEnv() {
  const env = {};
  try {
    const txt = readFileSync(".env.local", "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
    }
  } catch (e) { console.error("Could not read .env.local:", e.message); process.exit(1); }
  return env;
}

const env = loadEnv();
const URL = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL || !KEY) { console.error("Missing Supabase URL / service key in .env.local"); process.exit(1); }
const admin = createClient(URL, KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const berlinToday = () =>
  new Date(new Date().toLocaleString("en-US", { timeZone: "Europe/Berlin" })).toISOString().slice(0, 10);

const ITEMS = [
  { category: "Meat",     product: "Pork Schnitzel",     soll: 60, unit: "pcs", ist: 42 },
  { category: "Meat",     product: "Chicken Schnitzel",  soll: 50, unit: "pcs", ist: 55 },
  { category: "Sides",    product: "French Fries",       soll: 40, unit: "kg",  ist: 18 },
  { category: "Sides",    product: "Potato Salad",       soll: 20, unit: "kg",  ist: 12 },
  { category: "Salad",    product: "Mixed Leaves",       soll: 15, unit: "kg",  ist: 9  },
  { category: "Sauces",   product: "Mushroom Sauce",     soll: 12, unit: "L",   ist: 5  },
  { category: "Bread",    product: "Pretzel Rolls",      soll: 80, unit: "pcs", ist: 80 },
  { category: "Drinks",   product: "Apfelschorle 0.5L",  soll: 48, unit: "btl", ist: 30 },
];

const ANNOUNCEMENTS = [
  { title: `${TAG} Weekend rush — extra prep`, category: "Schedule",
    message: "We're expecting a busy Saturday. Kitchen, please prep an extra tray of schnitzel by 11:00. Thank you!" },
  { title: `${TAG} New waste-logging routine`, category: "General",
    message: "Please log any dropped or spoiled stock in the Waste section as it happens — it takes ten seconds and keeps our numbers accurate." },
];

async function firstBranch() {
  const { data } = await admin.from("branches").select("id, name").order("created_at", { ascending: true }).limit(1);
  if (!data || !data.length) { console.error("No branch found. Run create-demo-accounts.mjs first."); process.exit(1); }
  return data[0];
}

async function seed() {
  const b = await firstBranch();
  const today = berlinToday();
  console.log(`Seeding demo data into: ${b.name} (${b.id})\n`);

  // Inventory catalogue — upsert on (branch_id, product) isn't guaranteed unique,
  // so clear this branch's demo items first, then insert.
  await admin.from("inventory_master").delete().eq("branch_id", b.id).in("product", ITEMS.map((i) => i.product));
  const { error: mErr } = await admin.from("inventory_master").insert(
    ITEMS.map((i) => ({ branch_id: b.id, category: i.category, product: i.product, soll: i.soll, unit: i.unit, is_active: true }))
  );
  console.log(mErr ? `  inventory catalogue: FAIL ${mErr.message}` : `  inventory catalogue: ${ITEMS.length} items`);

  // Today's counts (so low-stock indicators light up).
  await admin.from("inventory_counts").delete().eq("branch_id", b.id).eq("count_date", today);
  const { error: cErr } = await admin.from("inventory_counts").insert(
    ITEMS.map((i) => ({ branch_id: b.id, count_date: today, category: i.category, product: i.product, ist: i.ist, soll: i.soll, unit: i.unit, counted_by: "Demo" }))
  );
  console.log(cErr ? `  today's counts: FAIL ${cErr.message}` : `  today's counts: ${ITEMS.length} rows`);

  // Announcements.
  await admin.from("announcements").delete().eq("branch_id", b.id).like("title", `${TAG}%`);
  const { error: aErr } = await admin.from("announcements").insert(
    ANNOUNCEMENTS.map((a, idx) => ({ branch_id: b.id, title: a.title, message: a.message, category: a.category, author: "Demo Manager", pinned: idx === 0 }))
  );
  console.log(aErr ? `  announcements: FAIL ${aErr.message}` : `  announcements: ${ANNOUNCEMENTS.length}`);

  console.log("\nDone. The Inventory, Announcements and low-stock views now have content.");
}

async function clean() {
  const b = await firstBranch();
  const today = berlinToday();
  await admin.from("inventory_counts").delete().eq("branch_id", b.id).eq("count_date", today);
  await admin.from("inventory_master").delete().eq("branch_id", b.id).in("product", ITEMS.map((i) => i.product));
  await admin.from("announcements").delete().eq("branch_id", b.id).like("title", `${TAG}%`);
  console.log("Demo data removed.");
}

(process.argv.includes("--delete") ? clean() : seed())
  .catch((e) => { console.error("Fatal:", e); process.exit(1); });
