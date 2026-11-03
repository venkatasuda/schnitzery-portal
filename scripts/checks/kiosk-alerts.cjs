// One "Kiosk offline" alert per kiosk (migration 20261104100000): the hourly sweep keys
// alerts by hour; while an unread alert for the kiosk exists, no new one is added.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const U = "00000000-0000-0000-0000-000000000001", B = "00000000-0000-0000-0000-00000000000b";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated;
    create table notifications(id uuid primary key default gen_random_uuid(), branch_id uuid, user_id uuid, type text, title text, message text, is_read boolean default false, created_at timestamptz default now());`);
  await db.exec(fs.readFileSync("supabase/migrations/20261104100000_kiosk_offline_once.sql", "utf8"));
  const notify = (type, title, win = "6 hours") => db.query("select public.notify($1,$2,$3,$4,'x',$5::interval)", [U, B, type, title, win]);
  const n = async (type) => Number((await db.query("select count(*) c from notifications where type=$1", [type])).rows[0].c);
  for (const h of ["10", "11", "12", "13"]) await notify("kiosk_offline", `kiosk:k1:2026-11-03-${h}`);
  assert.equal(await n("kiosk_offline"), 1, "Same kiosk, every hour: one alert");
  await notify("kiosk_offline", "kiosk:k2:2026-11-03-13");
  assert.equal(await n("kiosk_offline"), 2, "Another kiosk gets its own alert");
  await db.exec("update notifications set is_read = true where title like 'kiosk:k1:%'");
  await notify("kiosk_offline", "kiosk:k1:2026-11-03-14");
  assert.equal(await n("kiosk_offline"), 3, "Still offline after it was read: one new alert");
  await notify("sync_failure", "sync:1"); await notify("sync_failure", "sync:1"); await notify("sync_failure", "sync:2");
  assert.equal(await n("sync_failure"), 2, "Other alert types keep their old duplicate rule");
  console.log("Kiosk alerts: one per kiosk while unread; other alert types unchanged.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
