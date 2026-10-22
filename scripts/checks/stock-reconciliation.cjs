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
    grant all on branches,users,inventory_counts to service_role; -- as in Supabase
    insert into branches values('${X}'),('${Y}');
    insert into users values('${mX}','${X}','manager'),('${staffX}','${X}','staff'),('${mY}','${Y}','branch_owner');
    insert into inventory_counts values('${a}','${X}','Oil','2026-10-01',10),('${b}','${X}','Oil','2026-10-05',2),('${yc}','${Y}','Oil','2026-10-05',2);
  `);
  await db.exec(fs.readFileSync('supabase/migrations/20261021180000_stock_reconciliation_reviews.sql','utf8'));
  await db.exec(fs.readFileSync('supabase/migrations/20261022090000_stock_reviews_trusted_insert.sql','utf8'));
  const as=async(user,role='authenticated')=>db.exec(`reset role; set role ${role}; select set_config('request.jwt.claim.sub','${user}',false)`);
  // Reviews are written only by the server (service role) via the trusted function.
  const review=async(actor,branch,from,to,note='Metro delivery 03.10 not entered',figures={used:8})=>{
    await db.exec(`reset role; set role service_role; select set_config('request.jwt.claim.sub','',false)`);
    return db.query('select record_stock_reconciliation_review($1,$2,$3,$4,$5,$6)',[actor,branch,from,to,JSON.stringify(figures),note]);
  };
  const rejects=async(p,msg)=>assert.rejects(p,undefined,msg);
  const n=async()=>(await db.query('select count(*)::int n from stock_reconciliation_reviews')).rows[0].n;

  // Review finding 8: a manager can no longer insert figures directly.
  await as(mX);
  await rejects(db.query(`insert into stock_reconciliation_reviews(branch_id,from_count_id,to_count_id,figures,note) values($1,$2,$3,'{"used":123456}','forged')`,[X,a,b]),'No direct client insert');
  await rejects(db.query('select record_stock_reconciliation_review($1,$2,$3,$4,$5,$6)',[mX,X,a,b,'{}','direct rpc']),'Managers cannot call the trusted function');

  await review(mX,X,a,b);
  await as(mX,'service_role');
  assert.equal((await db.query('select reviewed_by from stock_reconciliation_reviews')).rows[0].reviewed_by,mX,'Attributed to the actor');
  await rejects(review(mX,X,a,b),'Same interval + same figures cannot be reviewed twice');
  await review(mX,X,a,b,'Re-checked after delivery entered',{used:3}); // figures changed → new review allowed
  await rejects(review(mX,X,a,yc),'Count from another branch');
  await rejects(review(mX,Y,a,b),'Other branch');
  await rejects(review(mX,X,a,b,'  ',{used:4}),'Empty note');
  await rejects(review(mX,X,a,a,'zero',{used:5}),'Zero-length interval');
  await rejects(review(staffX,X,a,b,'staff note',{used:1}),'Staff cannot review');
  await rejects(review(null,X,a,b,'no actor',{used:6}),'Actor required');
  await as(mX);
  await rejects(db.query(`update stock_reconciliation_reviews set note='edited'`),'Immutable: update');
  await rejects(db.query(`delete from stock_reconciliation_reviews`),'Immutable: delete');
  assert.equal(await n(),2,'Manager reads own branch reviews');

  await as(staffX);
  assert.equal(await n(),0,'Staff cannot read reviews');
  await as(mY);
  assert.equal(await n(),0,'Other branch cannot read');
  await as(mY,'anon');
  await rejects(db.query('select 1 from stock_reconciliation_reviews'),'Anon has no access');
  await as(mX,'service_role');
  await rejects(db.query(`delete from stock_reconciliation_reviews`),'Immutable even for service_role');
  console.log('Stock reconciliation reviews: server-only trusted writes, manager-only, branch-scoped, count-bound, attributed, immutable.');
})().catch(e=>{console.error(e);process.exitCode=1;});
