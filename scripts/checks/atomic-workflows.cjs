// Install test runtime separately: npm install --prefix .audit-db --no-save --package-lock=false @electric-sql/pglite
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('../../.audit-db/node_modules/@electric-sql/pglite');

(async () => {
  const db = new PGlite();
  const actor = '00000000-0000-0000-0000-000000000001';
  const employee = '00000000-0000-0000-0000-000000000002';
  const claimant = '00000000-0000-0000-0000-000000000003';
  const branch = '00000000-0000-0000-0000-000000000010';
  const doc = '00000000-0000-0000-0000-000000000020';
  const batch = '00000000-0000-0000-0000-000000000030';
  const cover = '00000000-0000-0000-0000-000000000040';
  await db.exec(`
    create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql as $$select '${actor}'::uuid$$;
    create function public.is_manager() returns boolean language sql as $$select true$$;
    create table users(id uuid primary key, full_name text, branch_id uuid, role text default 'manager');
    create table inventory_master(branch_id uuid, category text, product text, unit text, is_active boolean, soll numeric);
    create table inventory_counts(ist numeric, soll numeric);
    create table inventory_purchases(qty numeric, cost numeric);
    create table stock_transfers(qty numeric);
    create table daily_sales(amount numeric);
    create table user_documents(id uuid primary key, user_id uuid, branch_id uuid, doc_type text,
      status text, is_active boolean, reviewed_by uuid, reviewed_at timestamptz, rejection_reason text);
    create table stock_batches(id uuid primary key, branch_id uuid, product text, category text, qty numeric, unit text, status text);
    create table waste_log(branch_id uuid, product text, category text, qty numeric, unit text, reason text,
      note text, logged_by uuid, logged_by_name text, work_date date);
    create table cover_requests(id uuid primary key, branch_id uuid, requester_id uuid, claimer_id uuid,
      work_date date, day text, team text, shift text, status text, resolved_by text, resolved_at timestamptz);
    create table weekly_roster(id uuid primary key, branch_id uuid, week_start date, roster_data jsonb);
    insert into users(id, full_name, branch_id) values ('${actor}', 'Manager', '${branch}'), ('${employee}', 'Employee', '${branch}'), ('${claimant}', 'Claimant', '${branch}');
  `);
  await db.exec(fs.readFileSync(path.join(__dirname, '../../supabase/migrations/20261011035503_audit_atomic_workflows.sql'), 'utf8'));
  await db.exec(`
    insert into stock_batches values ('${batch}', '${branch}', 'Milk', 'Dairy', 3, 'L', 'active');
    create function fail_write() returns trigger language plpgsql as $$begin raise exception 'forced write failure'; end$$;
    create trigger fail_waste before insert on waste_log for each row execute function fail_write();
  `);
  await assert.rejects(db.query('select discard_batch_atomic($1)', [batch]), /forced write failure/);
  assert.equal((await db.query('select status from stock_batches')).rows[0].status, 'active');
  await db.exec('drop trigger fail_waste on waste_log');
  await db.query('select discard_batch_atomic($1)', [batch]);
  await db.query('select discard_batch_atomic($1)', [batch]);
  assert.equal((await db.query('select count(*)::integer n from waste_log')).rows[0].n, 1);
  await db.exec(`
    insert into user_documents values ('${doc}', '${employee}', '${branch}', 'permit', 'pending', false, null, null, null);
    insert into user_documents values ('00000000-0000-0000-0000-000000000021', '${employee}', '${branch}', 'permit', 'approved', true, null, null, null);
    create trigger fail_doc before update on user_documents for each row when (new.status = 'approved' and not old.is_active) execute function fail_write();
  `);
  await assert.rejects(db.query('select approve_document_atomic($1)', [doc]), /forced write failure/);
  assert.equal((await db.query('select count(*)::integer n from user_documents where is_active')).rows[0].n, 1);
  await db.exec('drop trigger fail_doc on user_documents');
  await db.query('select approve_document_atomic($1)', [doc]);
  assert.equal((await db.query('select id from user_documents where is_active')).rows[0].id, doc);
  const roster = { Monday: [{ user_id: employee, name: 'Employee', team: 'Kitchen', shift: 'Morning' }] };
  await db.query('insert into weekly_roster values ($1,$2,$3,$4)', [branch, branch, '2026-10-12', JSON.stringify(roster)]);
  await db.exec(`insert into cover_requests values ('${cover}', '${branch}', '${employee}', '${claimant}', '2026-10-12', 'Monday', 'Kitchen', 'Morning', 'claimed', null, null);
    create trigger fail_cover before update on cover_requests for each row execute function fail_write();`);
  await assert.rejects(db.query("select decide_cover_atomic($1,'approved')", [cover]), /forced write failure/);
  assert.deepEqual((await db.query('select roster_data from weekly_roster')).rows[0].roster_data, roster);
  await db.exec('drop trigger fail_cover on cover_requests');
  await db.query("select decide_cover_atomic($1,'approved')", [cover]);
  assert.equal((await db.query('select roster_data from weekly_roster')).rows[0].roster_data.Monday[0].user_id, claimant);
  await assert.rejects(db.query("select decide_cover_atomic($1,'approved')", [cover]), /Already actioned/);
  await assert.rejects(db.exec("insert into inventory_counts values ('Infinity', 1)"), /inventory_count_valid/);
  await assert.rejects(db.exec("insert into inventory_purchases values (1, -1)"), /inventory_purchase_valid/);
  for (let i = 0; i < 10; i++) assert.equal((await db.query('select allow_agent_request() allowed')).rows[0].allowed, true);
  assert.equal((await db.query('select allow_agent_request() allowed')).rows[0].allowed, false);
  await db.exec(`update users set role = 'staff' where id = '${actor}'`);
  assert.equal((await db.query('select allow_agent_request() allowed')).rows[0].allowed, false);
  await db.exec(`
    create or replace function public.is_manager() returns boolean language sql as $$
      select exists(select 1 from public.users where id = auth.uid() and role = 'manager')$$;
    grant usage on schema auth to authenticated;
    grant select on users to authenticated;
    grant select, update on stock_batches to authenticated;
    grant select, insert on waste_log to authenticated;
    alter table stock_batches enable row level security;
    create policy own_branch on stock_batches using (branch_id = (select branch_id from users where id = auth.uid()));
    update users set branch_id = '00000000-0000-0000-0000-000000000011' where id = '${actor}';
    set role authenticated;
  `);
  await assert.rejects(db.query('select discard_batch_atomic($1)', [batch]), /Batch not found/);
  await assert.rejects(db.query('select approve_document_atomic($1)', [doc]), /Managers only/);
  await db.exec('reset role; set role anon');
  await assert.rejects(db.query('select discard_batch_atomic($1)', [batch]), /permission denied/);
  await db.exec('reset role');
  await db.close();
  console.log('Atomic rollback, repeat disposal and cover approval checks pass.');
})().catch(error => { console.error(error); process.exitCode = 1; });
