// End-of-day close (migration 20261109090000): shift leaders + managers only, every open point needs a
// reason, cash difference computed, one close per day, closes cannot be edited.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", MGR = "00000000-0000-0000-0000-000000000001", LEAD = "00000000-0000-0000-0000-000000000002", STAFF = "00000000-0000-0000-0000-000000000003";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table public.branches(id uuid primary key, name text, is_active boolean default true);
    create table public.users(id uuid primary key, role text, branch_id uuid, status text default 'active', full_name text);
    create table public.weekly_roster(id uuid primary key default gen_random_uuid(), branch_id uuid, week_start date, roster_data jsonb);
    create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, type text, title text, message text);
    create table public.inventory_recipe_yields(id uuid primary key);
    create table public.temp_units(id uuid primary key default gen_random_uuid(), branch_id uuid, name text, is_active boolean default true);
    create table public.temp_logs(id uuid primary key default gen_random_uuid(), branch_id uuid, unit_id uuid, work_date date, recorded_at timestamptz);
    create table public.checklists(id uuid primary key default gen_random_uuid(), branch_id uuid, work_date date, done boolean default false, template_id uuid);
    create table public.checklist_templates(id uuid primary key default gen_random_uuid(), branch_id uuid, is_active boolean default true, weekdays smallint[]);
    create table public.daily_sales(id uuid primary key default gen_random_uuid(), branch_id uuid, sale_date date, amount numeric, unique(branch_id, sale_date));
    create table public.attendance_logs(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, work_date date, clock_in timestamptz, status text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00') returns void language sql as $$ select $$;
    insert into public.branches(id, name) values ('${B}', 'Stuttgart');
    insert into public.users values ('${MGR}', 'manager', '${B}', 'active', 'Manager'), ('${LEAD}', 'staff', '${B}', 'active', 'Lead'), ('${STAFF}', 'staff', '${B}', 'active', 'Ali');
    grant usage on schema public, auth, private to authenticated; grant select on all tables in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261108120000_prep_lists.sql", "utf8"));
  await db.exec(fs.readFileSync("supabase/migrations/20261109090000_day_closes.sql", "utf8"));
  await db.exec(fs.readFileSync("supabase/migrations/20261109150000_temp_rooms.sql", "utf8"));
  const today = (await db.query("select ((now() at time zone 'Europe/Berlin')::date)::text d")).rows[0].d;
  await db.exec(`insert into public.shift_leaders(branch_id, user_id) values ('${B}', '${LEAD}');
    insert into public.temp_units(id, branch_id, name) values ('00000000-0000-0000-0000-0000000000f1', '${B}', 'Fridge 1'), ('00000000-0000-0000-0000-0000000000f2', '${B}', 'Fridge 2');
    -- Fridge 1: opening + closing check (done). Fridge 2: opening only (not done).
    insert into public.temp_logs(branch_id, unit_id, work_date, recorded_at) values
      ('${B}', '00000000-0000-0000-0000-0000000000f1', '${today}', ('${today} 08:00'::timestamp at time zone 'Europe/Berlin')),
      ('${B}', '00000000-0000-0000-0000-0000000000f1', '${today}', ('${today} 21:00'::timestamp at time zone 'Europe/Berlin')),
      ('${B}', '00000000-0000-0000-0000-0000000000f2', '${today}', ('${today} 08:30'::timestamp at time zone 'Europe/Berlin'));
    insert into public.checklists(branch_id, work_date, done, template_id) values ('${B}', '${today}', true, '00000000-0000-0000-0000-0000000000c1'), ('${B}', '${today}', true, null);
    insert into public.attendance_logs(user_id, branch_id, work_date, clock_in, status) values ('${STAFF}', '${B}', '${today}', now(), 'active');
    insert into public.checklist_templates(id, branch_id, weekdays) values ('00000000-0000-0000-0000-0000000000c1', '${B}', '{1,2,3,4,5,6,7}');`);
  const as = async (uid, sql, params) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, params); } finally { await db.exec("reset role;"); } };
  const close = (uid, posTotal, posCash, counted, reasons, d = today) => as(uid, "select public.close_day($1, $2::date, $3, $4, $5, $6::jsonb, 'note') id", [B, d, posTotal, posCash, counted, JSON.stringify(reasons)]);

  const snap = (await as(LEAD, "select public.day_close_snapshot($1, $2::date) s", [B, today])).rows[0].s;
  assert.deepEqual(snap.temps, { units: 2, logged: 1 }, "Only fridge 1 has both opening and closing checks");
  assert.deepEqual(snap.checklists, { total: 2, done: 2 });
  assert.equal(snap.clocked_in.length, 1, "Ali still clocked in");
  await assert.rejects(as(STAFF, "select public.day_close_snapshot($1, $2::date) s", [B, today]), /Day close access required/, "Plain staff cannot see the close");
  const yesterday = (await db.query("select ((now() at time zone 'Europe/Berlin')::date - 1)::text d")).rows[0].d;
  assert.deepEqual((await as(LEAD, "select public.day_close_snapshot($1, $2::date) s", [B, yesterday])).rows[0].s.checklists, { total: 1, done: 0 }, "Checklist never opened: the weekday's templates still count as open");
  // Codex T2: finished unrelated tasks must not hide a required template nobody opened.
  const twoAgo = (await db.query("select ((now() at time zone 'Europe/Berlin')::date - 2)::text d")).rows[0].d;
  await db.exec(`insert into public.checklists(branch_id, work_date, done) values ('${B}', '${twoAgo}', true), ('${B}', '${twoAgo}', true), ('${B}', '${twoAgo}', true)`);
  assert.deepEqual((await as(LEAD, "select public.day_close_snapshot($1, $2::date) s", [B, twoAgo])).rows[0].s.checklists, { total: 4, done: 3 }, "3 unrelated done + 1 unopened template = 1 open");
  await assert.rejects(close(STAFF, 2430, 400, 400, {}), /Day close access required/, "Plain staff cannot close");
  await assert.rejects(close(LEAD, 2430, 400, 395.5, { temps: "Fridge 2 broken, reported" }), /Reason required for clocked_in/, "Every open point needs a reason");
  await assert.rejects(close(LEAD, 2430, 400, 395.5, { temps: "Fridge 2 broken", clocked_in: "Ali forgot, manager fixes" }), /Reason required for cash/, "A cash difference needs a reason");
  await assert.rejects(close(LEAD, 100, 400, 400, {}), /POS cash cannot exceed/);
  await assert.rejects(close(LEAD, 2430, 400, 400, {}, "2030-01-01"), /Invalid close date/);
  const id = (await close(LEAD, 2430, 400, 395.5, { temps: "Fridge 2 broken", clocked_in: "Ali forgot, manager fixes", cash: "4.50 tip jar mix-up", unrelated: "dropped" })).rows[0].id;
  const row = (await db.query("select cash_difference, reasons, snapshot->'open_points' op, closed_by from public.day_closes where id = $1", [id])).rows[0];
  assert.equal(Number(row.cash_difference), -4.5, "Counted 395.50 vs POS cash 400.00 = −4.50");
  assert.deepEqual(Object.keys(row.reasons).sort(), ["cash", "clocked_in", "temps"], "Only reasons for open points are kept");
  assert.equal(row.closed_by, LEAD);
  assert.equal(Number((await db.query("select amount from public.daily_sales where branch_id = $1 and sale_date = $2::date", [B, today])).rows[0].amount), 2430, "A day without sales gets the POS total in daily_sales (the dashboards' source)");
  // Yesterday already has an imported figure: a different POS total needs a reason and never overwrites it.
  await db.exec(`insert into public.daily_sales(branch_id, sale_date, amount) values ('${B}', '${yesterday}', 2000)`);
  const why = { temps: "x broken", checklists: "late close", clocked_in: "Ali forgot" };
  await assert.rejects(close(LEAD, 2100, 400, 400, why, yesterday), /Reason required for sales/, "POS total differs from the recorded sales");
  await close(LEAD, 2100, 400, 400, { ...why, sales: "refund not in import" }, yesterday);
  assert.equal(Number((await db.query("select amount from public.daily_sales where branch_id = $1 and sale_date = $2::date", [B, yesterday])).rows[0].amount), 2000, "Imported sales are not overwritten");
  await assert.rejects(close(MGR, 2430, 400, 400, {}), /Day already closed/, "One close per day");
  await assert.rejects(as(MGR, `update public.day_closes set counted_cash = 400 where id = '${id}'`), /permission denied/, "Closes cannot be edited");
  assert.equal((await as(LEAD, "select count(*)::int n from public.day_closes")).rows[0].n, 2, "Shift leader reads closes");
  assert.equal((await as(STAFF, "select count(*)::int n from public.day_closes")).rows[0].n, 0, "Plain staff cannot read closes");
  console.log("Day closes: shift leaders + managers only, reasons for every open point, cash difference, one immutable close per day.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
