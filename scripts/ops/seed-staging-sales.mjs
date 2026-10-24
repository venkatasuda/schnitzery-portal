// Fills LOCAL STAGING with realistic made-up daily sales (last 60 days, both test
// branches) so the owner cockpit, flash, targets, PDF and Monday summary can be seen
// before real till data exists. Refuses anything but the local Supabase stack.
//   node scripts/ops/seed-staging-sales.mjs          → add/replace synthetic sales
//   node scripts/ops/seed-staging-sales.mjs --clear  → remove them again
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(readFileSync(resolve(".audit-db/local-staging/app/.env.local"), "utf8")
  .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/)).filter(Boolean).map((m) => [m[1], m[2].replace(/^"|"$/g, "")]));
const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
if (!/^http:\/\/(127\.0\.0\.1|localhost):55321\/?$/.test(url)) throw new Error("Refusing: not the local staging database.");
const db = createClient(url, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const BRANCHES = { "10000000-0000-4000-8000-000000000001": 1900, "10000000-0000-4000-8000-000000000002": 1350 }; // base € per day
const WEEKDAY = [1.35, 0.7, 0.8, 0.85, 1.0, 1.3, 1.5]; // Sun..Sat: weekends busier, Mon quiet
const today = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(new Date()) + "T12:00:00Z");
const days = Array.from({ length: 60 }, (_, i) => { const d = new Date(today); d.setUTCDate(d.getUTCDate() - 60 + i); return d; });

if (process.argv.includes("--clear")) {
  const { error } = await db.from("daily_sales").delete().in("branch_id", Object.keys(BRANCHES)).gte("sale_date", days[0].toISOString().slice(0, 10));
  if (error) throw error;
  console.log("Synthetic sales removed from local staging.");
} else {
  let seed = 42; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647); // repeatable
  const rows = Object.entries(BRANCHES).flatMap(([branch_id, base]) => days.map((d) => ({
    branch_id, sale_date: d.toISOString().slice(0, 10),
    amount: Math.round(base * WEEKDAY[d.getUTCDay()] * (0.85 + rnd() * 0.3) * 100) / 100,
  })));
  const { error } = await db.from("daily_sales").upsert(rows, { onConflict: "branch_id,sale_date" });
  if (error) throw error;
  console.log(`Seeded ${rows.length} days of synthetic sales (${days[0].toISOString().slice(0, 10)} → yesterday) for the 2 test branches.`);
}
