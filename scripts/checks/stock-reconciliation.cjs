// Release C: reconciliation reviews are manager-only, branch-scoped, tied to real
// counts of that branch, attributed to the caller, and immutable.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('../../.audit-db/node_modules/@electric-sql/pglite');
const mX='00000000-0000-0000-0000-000000000001', staffX='00000000-0000-0000-0000-000000000002', mY='00000000-0000-0000-0000-000000000003';
const X='00000000-0000-0000-0000-000000000010', Y='00000000-0000-0000-0000-000000000011';
const a='00000000-0000-0000-0000-0000000000a1', b='00000000-0000-0000-0000-0000000000b1', yc='00000000-0000-0000-0000-0000000000c1';
(async()=>{
  const db=new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema auth to anon,authenticated,service_role;
    create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    create table branches(id uuid primary key);
    create table users(id uuid primary key,branch_id uuid,role text);
    create function is_manager() returns boolean language sql security definer set search_path=public as $$select exists(select 1 from users where id=auth.uid() and role in ('manager','branch_owner','brand_owner','super_admin'))$$;
    create function accessible_branch_ids() returns setof uuid language sql security definer set search_path=public as $$select branch_id from users where id=auth.uid()$$;
    create table inventory_counts(id uuid primary key,branch_id uuid,product text,count_date date,ist numeric);
    alter table inventory_counts enable row level security;
    create policy counts_read on inventory_counts for select using (branch_id in (select accessible_branch_ids()));
    grant select on branches,users,inventory_counts to authenticated;
    insert into branches values('${X}'),('${Y}');
    insert into users values('${mX}','${X}','manager'),('${staffX}','${X}','staff'),('${mY}','${Y}','branch_owner');
    insert into inventory_counts values('${a}','${X}','Oil','2026-10-01',10),('${b}','${X}','Oil','2026-10-05',2),('${yc}','${Y}','Oil','2026-10-05',2);
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261021180000_stock_reconciliation_reviews.sql','utf8'));
  const as=async(user,role='authenticated')=>db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user}',false)`);
  const review=(branch,from,to,note='Metro delivery 03.10 not entered',figures={used:8})=>
    db.query('insert into stock_reconciliation_reviews(branch_id,from_count_id,to_count_id,figures,note) values($1,$2,$3,$4,$5) returning reviewed_by',[branch,from,to,JSON.stringify(figures),note]);
  const rejects=async(p,msg)=>assert.rejects(p,undefined,msg);

  await as(mX);
  assert.equal((await review(X,a,b)).rows[0].reviewed_by,mX,'Review attributed to the caller');
  await rejects(review(X,a,b),'Same interval + same figures cannot be reviewed twice');
  await review(X,a,b,'Re-checked after delivery entered',{used:3}); // figures changed → new review allowed
  await rejects(review(X,a,yc),'Count from another branch');
  await rejects(review(Y,a,b),'Other branch');
  await rejects(review(X,a,b,'  '),'Empty note');
  await rejects(review(X,a,a),'Zero-length interval');
  await rejects(db.query(`insert into stock_reconciliation_reviews(branch_id,from_count_id,to_count_id,figures,note,reviewed_by) values($1,$2,$3,'{}','forged',$4)`,[X,a,b,mY]),'Cannot attribute to someone else');
  await rejects(db.query(`update stock_reconciliation_reviews set note='edited'`),'Immutable: update');
  await rejects(db.query(`delete from stock_reconciliation_reviews`),'Immutable: delete');
  assert.equal((await db.query('select count(*)::int n from stock_reconciliation_reviews')).rows[0].n,2);

  await as(staffX);
  await rejects(review(X,a,b,'staff note',{used:1}),'Staff cannot review');
  assert.equal((await db.query('select count(*)::int n from stock_reconciliation_reviews')).rows[0].n,0,'Staff cannot read reviews');
  await as(mY);
  assert.equal((await db.query('select count(*)::int n from stock_reconciliation_reviews')).rows[0].n,0,'Other branch cannot read');
  await as(mY,'anon');
  await rejects(db.query('select 1 from stock_reconciliation_reviews'),'Anon has no access');
  await as(mX,'service_role');
  await rejects(db.query(`delete from stock_reconciliation_reviews`),'Immutable even for service_role');
  console.log('Stock reconciliation reviews: manager-only, branch-scoped, count-bound, attributed, immutable.');
})().catch(e=>{console.error(e);process.exitCode=1;});
