// Shift swaps via cover requests (migration 20261109120000): approval moves both roster entries in one
// transaction; a stale offered shift rolls the whole approval back; plain covers still work.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", MGR = "00000000-0000-0000-0000-000000000001", ANA = "00000000-0000-0000-0000-000000000002", BEN = "00000000-0000-0000-0000-000000000003";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table public.users(id uuid primary key, role text, branch_id uuid, full_name text);
    create table public.weekly_roster(id uuid primary key default gen_random_uuid(), branch_id uuid, week_start date, roster_data jsonb);
    create table public.cover_requests(id uuid primary key default gen_random_uuid(), branch_id uuid, requester_id uuid, claimer_id uuid,
      work_date date, day text, team text, shift text, reason text, status text, resolved_by text, resolved_at timestamptz, created_at timestamptz default now());
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    insert into public.users values ('${MGR}', 'manager', '${B}', 'Mia'), ('${ANA}', 'staff', '${B}', 'Ana'), ('${BEN}', 'staff', '${B}', 'Ben');
    insert into public.weekly_roster(branch_id, week_start, roster_data) values ('${B}', '2026-11-09', '{
      "Tuesday": [{"user_id": "${ANA}", "name": "Ana", "team": "Kitchen", "shift": "Night"}],
      "Thursday": [{"user_id": "${BEN}", "name": "Ben", "team": "Kitchen", "shift": "Morning"}]}');
    grant usage on schema public, auth, private to authenticated; grant all on all tables in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261109120000_cover_swaps.sql", "utf8"));
  const as = async (uid, sql, params) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, params); } finally { await db.exec("reset role;"); } };
  const who = async (day) => (await db.query(`select roster_data->'${day}'->0->>'name' n from public.weekly_roster`)).rows[0].n;
  const add = async (extra) => (await db.query(`insert into public.cover_requests(branch_id, requester_id, claimer_id, work_date, day, team, shift, status${extra ? ", return_work_date, return_team, return_shift" : ""})
    values ('${B}', '${ANA}', '${BEN}', '2026-11-10', 'Tuesday', 'Kitchen', 'Night', 'claimed'${extra ? `, ${extra}` : ""}) returning id`)).rows[0].id;

  await assert.rejects(db.query(`insert into public.cover_requests(branch_id, return_work_date) values ('${B}', '2026-11-12')`), /cover_return_complete/, "Offered shift is all-or-nothing");

  // Stale offer: Ben no longer has Wednesday → whole approval rolls back, Ana keeps Tuesday.
  const stale = await add(`'2026-11-11', 'Kitchen', 'Morning'`);
  await assert.rejects(as(MGR, "select public.decide_cover_atomic($1, 'approved')", [stale]), /Shift no longer in the roster/);
  assert.equal(await who("Tuesday"), "Ana", "Rolled back");
  await db.query("update public.cover_requests set status = 'cancelled' where id = $1", [stale]);

  await assert.rejects(as(ANA, "select public.decide_cover_atomic($1, 'approved')", [stale]), /Managers only/);
  const swap = await add(`'2026-11-12', 'Kitchen', 'Morning'`);
  assert.equal((await as(MGR, "select public.decide_cover_atomic($1, 'approved') ok", [swap])).rows[0].ok, true);
  assert.equal(await who("Tuesday"), "Ben", "Ben works Ana's Tuesday night");
  assert.equal(await who("Thursday"), "Ana", "Ana works Ben's Thursday morning");

  // Plain cover (no return shift) still works: Ben gives Tuesday back? No — Ana now asks Ben to cover Thursday.
  const cover = (await db.query(`insert into public.cover_requests(branch_id, requester_id, claimer_id, work_date, day, team, shift, status)
    values ('${B}', '${ANA}', '${BEN}', '2026-11-12', 'Thursday', 'Kitchen', 'Morning', 'claimed') returning id`)).rows[0].id;
  await as(MGR, "select public.decide_cover_atomic($1, 'approved')", [cover]);
  assert.equal(await who("Thursday"), "Ben", "One-way cover moves one shift");
  console.log("Cover swaps: both shifts move together, stale offers roll back, managers only, plain covers unchanged.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
