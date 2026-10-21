// Release E: an employee who worked at branch X and later moved to Y must stay
// identifiable in X's payroll for that month, without widening access.
// Reproduces the bug on the previous get_payroll_inputs, then verifies the fix.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../../.audit-db/node_modules/@electric-sql/pglite');
const managerX='00000000-0000-0000-0000-000000000001', mover='00000000-0000-0000-0000-000000000002';
const stayer='00000000-0000-0000-0000-000000000003', managerY='00000000-0000-0000-0000-000000000004', staffY='00000000-0000-0000-0000-000000000005';
const X='00000000-0000-0000-0000-000000000010', Y='00000000-0000-0000-0000-000000000011';
(async()=>{
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key,branch_id uuid,role text,employee_code text,full_name text,team text,email text);
    -- Helpers are definer functions in production; RLS on users would recurse otherwise.
    create function is_manager() returns boolean language sql security definer set search_path=public as $$select exists(select 1 from users where id=auth.uid() and role in ('manager','branch_owner','brand_owner','super_admin'))$$;
    create function accessible_branch_ids() returns setof uuid language sql security definer set search_path=public as $$select branch_id from users where id=auth.uid()$$;
    create table user_pay(user_id uuid primary key,branch_id uuid,hourly_wage numeric,updated_by uuid,updated_at timestamptz);
    create table payroll_settings(branch_id uuid primary key,ot_daily_hours numeric,night_start time,night_end time);
    create table attendance_logs(id uuid default gen_random_uuid() primary key,user_id uuid,branch_id uuid,work_date date,clock_in timestamptz,clock_out timestamptz,duration_mins integer,breaks jsonb,status text,approval_status text);
    create table payroll_runs(id uuid default gen_random_uuid() primary key,branch_id uuid,month text,status text,approved_by text,approved_at timestamptz,note text,unique(branch_id,month));
    grant all on all tables in schema public to service_role;
    grant select on users,branches,user_pay,payroll_settings,attendance_logs,payroll_runs to authenticated;
    grant insert,update,delete on user_pay to authenticated;
    -- Production visibility rule: a manager sees users whose CURRENT branch is accessible.
    alter table users enable row level security;
    create policy users_select on users for select using (id=auth.uid() or branch_id in (select accessible_branch_ids()));
    insert into branches values('${X}'),('${Y}');
    insert into users values
      ('${managerX}','${X}','manager','MX','Manager X','Manager','mx@example.test'),
      ('${mover}','${X}','staff','E1','Moving Employee','Kitchen','move@example.test'),
      ('${stayer}','${X}','staff','E2','Staying Employee','Kitchen','stay@example.test'),
      ('${managerY}','${Y}','manager','MY','Manager Y','Manager','my@example.test'),
      ('${staffY}','${Y}','staff','E3','Y Employee','Cashier','y@example.test');
    insert into attendance_logs(user_id,branch_id,work_date,clock_in,clock_out,duration_mins,breaks,status,approval_status) values
      ('${mover}','${X}','2020-09-10','2020-09-10T08:00Z','2020-09-10T16:00Z',480,'[]','complete','approved'),
      ('${stayer}','${X}','2020-09-11','2020-09-11T08:00Z','2020-09-11T12:00Z',240,'[]','complete','approved'),
      ('${staffY}','${Y}','2020-09-12','2020-09-12T08:00Z','2020-09-12T12:00Z',240,'[]','complete','approved');
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261012001000_payroll_approval_snapshots.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261013144029_wage_effective_history.sql','utf8'));
  // Confirmed X rates while both employees belong to X.
  await db.exec('set role service_role');
  for (const u of [mover, stayer]) await db.query('select set_wage_effective($1,$2,$3,$4)',[managerX,u,20,'2020-09-01']);
  await db.exec('reset role');
  // The move: mover now belongs to Y.
  await db.query('update users set branch_id=$1 where id=$2',[Y,mover]);

  const as=async(user,role='authenticated')=>db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user}',false)`);
  const inputs=async()=> (await db.query('select get_payroll_inputs($1,$2) value',[X,'2020-09'])).rows[0].value;

  // 1) Bug reproduced on the previous function.
  await as(managerX);
  let before=await inputs();
  assert.equal(before.source.logs.length,2,'Shifts are already selected by the shift branch');
  assert.ok(before.source.wages.some(w=>w.user_id===mover&&w.hourly_wage==20),'X wages for the mover are already visible');
  assert.ok(!before.source.staff.some(s=>s.id===mover),'Bug precondition: moved employee missing from X staff');

  // 2) Apply the fix.
  await db.exec('reset role');
  await db.exec(fs.readFileSync('supabase/migrations/20261021120000_payroll_branch_worker_identities.sql','utf8'));
  await as(managerX);
  const after=await inputs();
  const moved=after.source.staff.find(s=>s.id===mover);
  assert.equal(moved?.full_name,'Moving Employee','Moved employee identifiable in X payroll');
  assert.deepEqual(after.source.staff.map(s=>s.id).sort(),[mover,stayer].sort(),'Only people who worked at X that month');
  assert.deepEqual(Object.keys(moved).sort(),['employee_code','full_name','id','team'],'Identity exposes four columns only');
  assert.deepEqual(after.source.logs,before.source.logs,'Shifts unchanged');
  assert.deepEqual(after.source.wages,before.source.wages,'Wages unchanged');
  assert.ok(!(await db.query('select count(*)::int n from users where id=$1',[mover])).rows[0].n,'Direct users access is still not widened');

  // 3) Approval succeeds through the service-only path with the same revision.
  await db.exec('reset role; set role service_role');
  const snapshot={month:'2020-09',wageBasis:'effective-dated',revision:after.revision,rows:[{userId:mover,gross:160},{userId:stayer,gross:80}],totals:{gross:240},settings:after.source.settings};
  await db.query('select set_payroll_approval_atomic($1,$2,$3,true,$4,$5,null)',[managerX,X,'2020-09',after.revision,snapshot]);
  assert.equal((await db.query('select count(*)::int n from payroll_approvals where branch_id=$1',[X])).rows[0].n,1,'X September approved');

  // 4) Guards.
  const ids=(user,branch,from,to,role)=>as(user,role).then(()=>db.query('select * from branch_worker_identities($1,$2,$3)',[branch,from,to]));
  await assert.rejects(ids(managerX,Y,'2020-09-01','2020-10-01'),/Branch access denied/);
  await assert.rejects(ids(stayer,X,'2020-09-01','2020-10-01'),/Managers only/);
  await assert.rejects(ids(managerX,X,'2020-09-01','2020-11-03'),/Invalid period/);
  await assert.rejects(ids(managerX,X,'2020-09-10','2020-09-10'),/Invalid period/);
  assert.equal((await ids(managerX,X,'2020-09-01','2020-09-10')).rows.length,0,'Upper bound is exclusive');
  assert.deepEqual((await ids(managerX,X,'2020-09-10','2020-09-11')).rows.map(r=>r.id),[mover]);
  assert.ok(!(await ids(managerY,Y,'2020-09-01','2020-10-01')).rows.some(r=>r.id===mover),'Y does not inherit X shifts');
  await assert.rejects(ids(managerX,X,'2020-09-01','2020-10-01','anon'),/permission denied/);
  await db.exec('reset role');
  console.log('Payroll branch history: moved employee identifiable in old branch, approval unblocked, bounded/branch-scoped identity, no wider user access.');
  await db.close();
})().catch(error=>{console.error(error);process.exitCode=1;});
