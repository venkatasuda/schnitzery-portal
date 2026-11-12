// Operational reminders (migration 20261111160000) on top of the real production notification_sweep():
// the sweep is patched once (Fri/Sat times + reminders call), and each reminder fires only in its hour
// window, only on working days, to the right people, without duplicates.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { PGlite } = require("../../.audit-db/node_modules/@electric-sql/pglite");
const B = "00000000-0000-0000-0000-00000000000b", MGR = "00000000-0000-0000-0000-000000000001", LEAD = "00000000-0000-0000-0000-000000000002", ANA = "00000000-0000-0000-0000-000000000003", OFF = "00000000-0000-0000-0000-000000000004";
(async () => {
  const db = new PGlite();
  const prod = fs.readFileSync("supabase/schema/production-functions.sql", "utf8").replace(/\r\n/g, "\n");
  const sweep = prod.slice(prod.indexOf("CREATE OR REPLACE FUNCTION public.notification_sweep()")).split("$function$\n;")[0] + "$function$;";
  await db.exec(`create role anon; create role authenticated; create role service_role; create schema private; create schema extensions;
    create table public.branches(id uuid primary key, name text);
    create table public.users(id uuid primary key, role text, branch_id uuid, status text default 'active', full_name text);
    create table public.notifications(id uuid primary key default gen_random_uuid(), branch_id uuid, user_id uuid, type text, title text, message text, is_read boolean default false, created_at timestamptz default now());
    create table public.attendance_logs(id uuid primary key default gen_random_uuid(), user_id uuid, branch_id uuid, work_date date, clock_in timestamptz, status text, created_at timestamptz default now());
    create table public.attendance_events(branch_id uuid, sync_status text, error text, created_at timestamptz default now());
    create table public.kiosks(id uuid primary key default gen_random_uuid(), branch_id uuid, label text, last_seen timestamptz, is_active boolean);
    create table public.weekly_roster(branch_id uuid, week_start date, roster_data jsonb);
    create table public.shift_times(branch_id uuid, team text, shift text, start_time time, end_time time, fri_sat_start time, fri_sat_end time, is_active boolean default true);
    create table public.temp_units(id uuid primary key default gen_random_uuid(), branch_id uuid, is_active boolean default true);
    create table public.temp_logs(branch_id uuid, unit_id uuid, work_date date, recorded_at timestamptz);
    create table public.checklists(branch_id uuid, work_date date, done boolean default false, template_id uuid);
    create table public.checklist_templates(id uuid primary key default gen_random_uuid(), branch_id uuid, is_active boolean default true, weekdays smallint[]);
    create table public.prep_items(branch_id uuid, is_active boolean default true);
    create table public.prep_lists(branch_id uuid, plan_date date, status text);
    create table public.shift_leaders(branch_id uuid, user_id uuid);
    create table public.day_closes(branch_id uuid, work_date date);
    create function public.notify(p_user uuid, p_branch uuid, p_type text, p_title text, p_message text, p_window interval default '12:00:00') returns void language plpgsql as $$
      begin if exists (select 1 from public.notifications where user_id = p_user and type = p_type and title = p_title and is_read = false and created_at > now() - p_window) then return; end if;
        insert into public.notifications(branch_id, user_id, type, title, message) values (p_branch, p_user, p_type, p_title, p_message); end $$;
    ${sweep}
    insert into public.branches values ('${B}', 'Stuttgart');
    insert into public.users(id, role, branch_id, full_name) values ('${MGR}', 'manager', '${B}', 'Mia'), ('${LEAD}', 'staff', '${B}', 'Lea'), ('${ANA}', 'staff', '${B}', 'Ana'), ('${OFF}', 'staff', '${B}', 'Off-duty lead');
    insert into public.shift_leaders values ('${B}', '${LEAD}'), ('${B}', '${OFF}');`);
  const m = fs.readFileSync("supabase/migrations/20261111160000_ops_reminders.sql", "utf8"); await db.exec(m); await db.exec(m);
  const def = (await db.query("select pg_get_functiondef('public.notification_sweep()'::regprocedure) d")).rows[0].d;
  assert.equal(def.split("perform private.ops_reminders();").length - 1, 1, "Reminders call added exactly once");
  assert.equal(def.split("fri_sat_start is not null then fri_sat_start").length - 1, 2, "Both shift-time lookups use Fri/Sat times");
  await db.exec("select public.notification_sweep()"); // patched sweep still runs

  // Thursday 12 Nov 2026 is a working day (Lea clocked in); Friday's roster has Ana on Evening (Fri time 17:30).
  const D = "2026-11-12", at = (hhmm) => `('${D} ${hhmm}'::timestamp at time zone 'Europe/Berlin')`;
  const run = async (hhmm) => { await db.exec(`select private.ops_reminders(${at(hhmm)})`); };
  const got = async (type) => (await db.query("select user_id, title, message from public.notifications where type = $1 order by title, user_id", [type])).rows;
  await db.exec(`insert into public.temp_units(id, branch_id) values ('00000000-0000-0000-0000-0000000000f1', '${B}'), ('00000000-0000-0000-0000-0000000000f2', '${B}');
    insert into public.prep_items values ('${B}');
    insert into public.checklist_templates(branch_id, weekdays) values ('${B}', '{1,2,3,4,5,6,7}');
    insert into public.weekly_roster values ('${B}', '2026-11-09', '{"Friday": [{"user_id": "${ANA}", "team": "Kitchen", "shift": "Night"}]}');
    insert into public.shift_times(branch_id, team, shift, start_time, end_time, fri_sat_start, fri_sat_end) values ('${B}', 'Kitchen', 'Night', '17:00', '23:30', '17:30', '02:00');`);

  await run("13:30"); assert.equal((await db.query("select count(*)::int n from public.notifications where type like '%reminder'")).rows[0].n, 0, "Nobody clocked in → no reminders");
  await db.exec(`insert into public.attendance_logs(user_id, branch_id, work_date, clock_in, status) values ('${LEAD}', '${B}', '${D}', ${at("09:00")}, 'complete');
    insert into public.temp_logs values ('${B}', '00000000-0000-0000-0000-0000000000f1', '${D}', ${at("09:30")});`);
  await run("10:00"); assert.equal((await got("temp_reminder")).length, 0, "Too early for the opening reminder");
  await run("13:30"); await run("14:10");
  let t = await got("temp_reminder");
  assert.deepEqual(t.map((x) => x.user_id).sort(), [MGR, LEAD].sort(), "Manager + the shift leader on duty, not the off-duty leader, once each");
  assert.equal(t[0].message, "1 of 2 opening temperature checks missing");

  await run("18:10");
  const up = await got("upcoming_shift");
  assert.deepEqual(up.map((x) => [x.user_id, x.message]), [[ANA, "Tomorrow: Evening 17:30"]], "Friday time used; roster key Night shown as Evening");

  await run("21:15");
  t = await got("temp_reminder");
  assert.equal(t.filter((x) => x.title.endsWith(":close")).length, 2, "Closing reminder: no closing readings yet");
  assert.equal(t.find((x) => x.title.endsWith(":close")).message, "2 of 2 closing temperature checks missing");
  assert.equal((await got("checklist_reminder"))[0].message, "1 checklist tasks still open", "Unopened template counts as open");
  assert.equal((await got("prep_reminder")).length, 2, "Tomorrow's prep list not sent");
  await run("22:15"); assert.equal((await got("prep_reminder")).length, 2, "No duplicates on the next hourly run");

  // Next morning: yesterday not closed → managers only; closed → nothing new.
  await db.exec(`select private.ops_reminders(('2026-11-13 08:30'::timestamp at time zone 'Europe/Berlin'))`);
  assert.deepEqual((await got("day_close_reminder")).map((x) => x.user_id), [MGR]);
  console.log("Ops reminders: sweep patched once, hour windows, working days only, on-duty leaders + managers, no duplicates.");
})().catch((e) => { console.error(e); process.exitCode = 1; });
