// Sick pay (migration 20261123090000): get_payroll_inputs adds a "sick" block only in months with approved sick
// leave (other months keep their revision), scoped to the branch; set_eau_confirmed is manager + branch only.
// The calculation itself is tested in src/lib/pay/sickPay.test.ts.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../../.audit-db/node_modules/@electric-sql/pglite');
const M = '00000000-0000-0000-0000-000000000001', E = '00000000-0000-0000-0000-000000000002', MY = '00000000-0000-0000-0000-000000000004', EY = '00000000-0000-0000-0000-000000000005';
const X = '00000000-0000-0000-0000-000000000010', Y = '00000000-0000-0000-0000-000000000011';
(async () => {
  const db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; create schema private; grant usage on schema auth, private to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key,branch_id uuid,role text,employee_code text,full_name text,team text,email text,contract_type text,contract_end date,probation_end date,skills text[]);
    create function is_manager() returns boolean language sql security definer set search_path=public as $$select exists(select 1 from users where id=auth.uid() and role in ('manager','branch_owner','brand_owner','super_admin'))$$;
    create function accessible_branch_ids() returns setof uuid language sql security definer set search_path=public as $$select branch_id from users where id=auth.uid()$$;
    create table user_pay(user_id uuid primary key,branch_id uuid,hourly_wage numeric,updated_by uuid,updated_at timestamptz);
    create table payroll_settings(branch_id uuid primary key,ot_daily_hours numeric,night_start time,night_end time);
    create table attendance_logs(id uuid default gen_random_uuid() primary key,user_id uuid,branch_id uuid,work_date date,clock_in timestamptz,clock_out timestamptz,duration_mins integer,breaks jsonb,status text,approval_status text);
    create table payroll_runs(id uuid default gen_random_uuid() primary key,branch_id uuid,month text,status text,approved_by text,approved_at timestamptz,note text,unique(branch_id,month));
    create table leave_requests(id uuid default gen_random_uuid() primary key,user_id uuid,branch_id uuid,from_date date,to_date date,status text,leave_type text not null default 'vacation',sick_note_url text);
    create table weekly_roster(id uuid default gen_random_uuid() primary key,branch_id uuid,week_start date,roster_data jsonb);
    create table shift_times(id uuid default gen_random_uuid() primary key,branch_id uuid,team text,shift text,start_time time,end_time time,fri_sat_start time,fri_sat_end time,break_mins int not null default 0,is_active boolean not null default true);
    create table cover_requests(id uuid default gen_random_uuid() primary key,branch_id uuid,requester_id uuid,work_date date,team text,shift text,status text);
    grant all on all tables in schema public to service_role;
    grant select on all tables in schema public to authenticated;
    grant insert,update,delete on user_pay to authenticated;
    alter table users enable row level security;
    create policy users_select on users for select using (id=auth.uid() or branch_id in (select accessible_branch_ids()));
    insert into branches values('${X}'),('${Y}');
    insert into users(id,branch_id,role,employee_code,full_name,team) values
      ('${M}','${X}','manager','M','Manager X','Manager'),('${E}','${X}','staff','E1','Ali','Kitchen'),
      ('${MY}','${Y}','manager','MY','Manager Y','Manager'),('${EY}','${Y}','staff','E3','Yara','Kitchen');
    insert into attendance_logs(user_id,branch_id,work_date,clock_in,clock_out,duration_mins,breaks,status,approval_status) values
      ('${E}','${X}','2020-08-03','2020-08-03T08:00Z','2020-08-03T15:00Z',420,'[]','complete','approved'),
      ('${E}','${X}','2020-09-10','2020-09-10T08:00Z','2020-09-10T16:00Z',480,'[]','complete','approved'),
      ('${EY}','${Y}','2020-09-10','2020-09-10T08:00Z','2020-09-10T16:00Z',480,'[]','complete','approved');`);
  for (const f of ['20261012001000_payroll_approval_snapshots', '20261013144029_wage_effective_history', '20261021120000_payroll_branch_worker_identities'])
    await db.exec(fs.readFileSync(`supabase/migrations/${f}.sql`, 'utf8'));
  await db.exec('set role service_role');
  await db.query('select set_wage_effective($1,$2,$3,$4)', [M, E, 14, '2020-01-01']);
  await db.exec('reset role');
  const as = async (u) => db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${u}',false)`);
  const inputs = async (u, b, m) => { await as(u); try { return (await db.query('select get_payroll_inputs($1,$2) v', [b, m])).rows[0].v; } finally { await db.exec('reset role'); } };
  const octBefore = await inputs(M, X, '2020-10');

  const mig = fs.readFileSync('supabase/migrations/20261123090000_sick_pay.sql', 'utf8');
  await db.exec(mig); await db.exec(mig);
  await db.exec(`insert into leave_requests(id,user_id,branch_id,from_date,to_date,status,leave_type) values
      ('00000000-0000-0000-0000-0000000000a1','${E}','${X}','2020-09-14','2020-09-16','approved','sick'),
      ('00000000-0000-0000-0000-0000000000a2','${E}','${X}','2020-09-20','2020-09-20','pending','sick'),
      ('00000000-0000-0000-0000-0000000000a3','${E}','${X}','2020-09-25','2020-09-26','approved','vacation'),
      ('00000000-0000-0000-0000-0000000000a4','${EY}','${Y}','2020-09-14','2020-09-14','approved','sick');
    insert into weekly_roster(branch_id,week_start,roster_data) values ('${X}','2020-09-14','{"Monday":[{"user_id":"${E}","team":"Kitchen","shift":"Early"}]}'),('${Y}','2020-09-14','{}');
    insert into shift_times(branch_id,team,shift,start_time,end_time,break_mins) values (null,'Kitchen','Early','09:00','17:00',30);
    insert into cover_requests(branch_id,requester_id,work_date,team,shift,status) values ('${X}','${E}','2020-09-15','Kitchen','Early','approved'),('${X}','${E}','2020-09-16','Kitchen','Early','rejected');`);

  const sep = await inputs(M, X, '2020-09');
  const s = sep.source.sick;
  assert.deepEqual(s.leave.map((l) => l.id), ['00000000-0000-0000-0000-0000000000a1'], 'Only approved sick leave of this branch (not pending, not vacation, not Y)');
  assert.equal(s.leave[0].eau, false);
  assert.deepEqual(s.wages.map((w) => [w.work_date, Number(w.hourly_wage)]), [['2020-09-14', 14], ['2020-09-15', 14], ['2020-09-16', 14]], 'Wage in force on each sick day');
  assert.equal(s.roster.length, 1, 'Roster weeks of this branch only');
  assert.deepEqual(s.covers.map((c) => c.date), ['2020-09-15'], 'Approved covers only');
  assert.equal(s.start[0].first_work, '2020-08-03', 'First clock-in as start fallback');
  assert.deepEqual(s.history.map((h) => h.work_date), ['2020-08-03', '2020-09-10'], '13-month history of the sick person');
  assert.equal(s.times[0].breakMins, 30);
  const octAfter = await inputs(M, X, '2020-10');
  assert.equal(octAfter.revision, octBefore.revision, 'Months without sick leave keep their revision');
  assert.ok(!('sick' in octAfter.source));

  // eAU tick: manager of the branch only, sick leave only.
  const eau = async (u, id, v = true) => { await as(u); try { await db.query('select set_eau_confirmed($1,$2)', [id, v]); } finally { await db.exec('reset role'); } };
  await db.exec('grant update on leave_requests to authenticated');
  await assert.rejects(eau(E, '00000000-0000-0000-0000-0000000000a1'), /Managers only/);
  await assert.rejects(eau(MY, '00000000-0000-0000-0000-0000000000a1'), /Not found or no access/);
  await assert.rejects(eau(M, '00000000-0000-0000-0000-0000000000a3'), /Not found or no access/, 'Vacation cannot be ticked');
  await eau(M, '00000000-0000-0000-0000-0000000000a1');
  const after = await inputs(M, X, '2020-09');
  assert.equal(after.source.sick.leave[0].eau, true);
  assert.notEqual(after.revision, sep.revision, 'Ticking eAU changes the payroll revision (approval must reload)');
  await assert.rejects(inputs(E, X, '2020-09'), /Managers only/);
  await assert.rejects(inputs(M, Y, '2020-09'), /Branch access denied/);
  console.log('Sick pay inputs: approved sick leave per branch, wages per sick day, roster + covers + 13-month history, unchanged revision without sickness, eAU tick manager/branch only.');
  await db.close();
})().catch((e) => { console.error(e); process.exitCode = 1; });
