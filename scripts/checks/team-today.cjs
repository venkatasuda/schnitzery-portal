// "Today's team" (migration 20261114120000): shift leaders and managers of the branch see who is planned today
// and their clock state; ordinary staff and other branches are refused; only today and only names/state.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", OTHER = "00000000-0000-0000-0000-00000000000c";
const MGR = "00000000-0000-0000-0000-000000000001", LEAD = "00000000-0000-0000-0000-000000000002", ANA = "00000000-0000-0000-0000-000000000003",
  BEN = "00000000-0000-0000-0000-000000000004", CEM = "00000000-0000-0000-0000-000000000005", OTTO = "00000000-0000-0000-0000-000000000009";
(async () => {
  const db = new PGlite();
  await db.exec(`create role anon; create role authenticated; create schema auth; create schema private;
    create table public.branches(id uuid primary key, name text, is_active boolean default true);
    create table public.users(id uuid primary key, role text, branch_id uuid, status text default 'active', full_name text, team text);
    create table public.weekly_roster(id uuid primary key default gen_random_uuid(), branch_id uuid, week_start date, roster_data jsonb);
    create table public.attendance_logs(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, work_date date, clock_in timestamptz, status text, late_mins int);
    create table public.inventory_recipe_yields(id uuid primary key);
    create table public.notifications(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, type text, title text, message text);
    create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
    create function public.is_manager() returns boolean language sql security definer as $$ select exists(select 1 from public.users where id = auth.uid() and role <> 'staff') $$;
    create function public.accessible_branch_ids() returns setof uuid language sql security definer as $$ select branch_id from public.users where id = auth.uid() $$;
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00') returns void language sql security definer
      as $$ insert into public.notifications(user_id, branch_id, type, title, message) values (p_user, p_branch, p_type, p_title, p_message) $$;
    insert into public.branches(id, name) values ('${B}', 'Stuttgart'), ('${OTHER}', 'Other');
    insert into public.users(id, role, branch_id, full_name, team) values ('${MGR}', 'manager', '${B}', 'Mia', 'Manager'), ('${LEAD}', 'staff', '${B}', 'Lea', 'Kitchen'),
      ('${ANA}', 'staff', '${B}', 'Ana', 'Kitchen'), ('${BEN}', 'staff', '${B}', 'Ben', 'Cashier'), ('${CEM}', 'staff', '${B}', 'Cem', 'Kitchen'), ('${OTTO}', 'manager', '${OTHER}', 'Otto', 'Manager');
    grant usage on schema public, auth, private to authenticated; grant select on all tables in schema public to authenticated;
    grant execute on all functions in schema public, auth to authenticated;`);
  await db.exec(fs.readFileSync("supabase/migrations/20261108120000_prep_lists.sql", "utf8"));
  const m = fs.readFileSync("supabase/migrations/20261114120000_team_today.sql", "utf8"); await db.exec(m); await db.exec(m);
  await db.query("insert into public.shift_leaders(branch_id, user_id) values ($1, $2)", [B, LEAD]);
  const as = async (uid, sql, p) => { await db.exec(`set role authenticated; set test.uid = '${uid}';`); try { return await db.query(sql, p); } finally { await db.exec("reset role;"); } };

  const { d, wk, dname: day } = (await db.query(`select (now() at time zone 'Europe/Berlin')::date::text d,
    ((now() at time zone 'Europe/Berlin')::date - (extract(isodow from (now() at time zone 'Europe/Berlin')::date)::int - 1))::text wk,
    (array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'])[extract(isodow from (now() at time zone 'Europe/Berlin')::date)::int] dname`)).rows[0];
  const roster = { [day]: [{ user_id: ANA, name: "Ana", team: "Kitchen", shift: "Morning" }, { user_id: BEN, name: "Ben", team: "Cashier", shift: "Night" }, { user_id: CEM, name: "Cem", team: "Kitchen", shift: "Night" }] };
  await db.query("insert into public.weekly_roster(branch_id, week_start, roster_data) values ($1, $2, $3::jsonb)", [B, wk, JSON.stringify(roster)]);
  await db.query(`insert into public.attendance_logs(user_id, branch_id, work_date, clock_in, status, late_mins) values
    ($1, $4, $5, now() - interval '3 hours', 'on-break', 12), ($2, $4, $5, now() - interval '8 hours', 'complete', 0),
    ($3, $4, $5::date - 3, now() - interval '3 days', 'complete', 0)`, [ANA, LEAD, CEM, B, d]);

  // Staff without the role, and a manager of another branch, are refused.
  await assert.rejects(as(ANA, "select * from public.team_today($1)", [B]), /Shift leaders only/);
  await assert.rejects(as(OTTO, "select * from public.team_today($1)", [B]), /Shift leaders only/);
  // Ana can still not read colleagues' attendance directly (no new table rights were added).
  for (const uid of [LEAD, MGR]) {
    const rows = (await as(uid, "select name, team, shift, status, late_mins from public.team_today($1) order by name", [B])).rows;
    assert.deepEqual(rows, [
      { name: "Ana", team: "Kitchen", shift: "Morning", status: "break", late_mins: 12 },
      { name: "Ben", team: "Cashier", shift: "Night", status: "not_in", late_mins: 0 },
      { name: "Cem", team: "Kitchen", shift: "Night", status: "not_in", late_mins: 0 }, // a shift 3 days ago does not count
      { name: "Lea", team: "Kitchen", shift: null, status: "done", late_mins: 0 },     // worked today without being rostered
    ], `Today's team for ${uid === LEAD ? "the shift leader" : "the manager"}`);
  }
  // A deactivated shift leader loses access.
  await db.query("update public.users set status = 'inactive' where id = $1", [LEAD]);
  await assert.rejects(as(LEAD, "select * from public.team_today($1)", [B]), /Shift leaders only/);
  console.log("Today's team: branch shift leaders and managers only; today's roster + clock state; no other branches, days or rights.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
