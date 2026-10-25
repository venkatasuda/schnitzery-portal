const assert=require('node:assert/strict'),fs=require('node:fs');
const {PGlite}=require('../../.audit-db/node_modules/@electric-sql/pglite');
const id=n=>`00000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
(async()=>{
 const db=new PGlite(),a=id(1),b=id(2),c=id(3),staff=id(10),manager=id(11),inactive=id(12),owner=id(13);
 await db.exec(`
 create role anon; create role authenticated; create schema auth;
 create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth to authenticated,anon;
 create table users(id uuid primary key,branch_id uuid,full_name text,status text,role text);
 create table branches(id uuid primary key);
 create table user_branches(user_id uuid,branch_id uuid);
 create table stock_batches(id uuid primary key,branch_id uuid not null,product text,category text,unit text,qty numeric,expiry_date date,status text default 'active',logged_by uuid);
 create table waste_log(branch_id uuid,product text,category text,qty numeric,unit text,reason text,note text,logged_by uuid,logged_by_name text,work_date date);
 create function public.accessible_branch_ids() returns setof uuid language sql security definer set search_path='' as $$
 select branch_id from public.users where id=auth.uid()
 union select branch_id from public.user_branches where user_id=auth.uid()
 union select id from public.branches where exists(select 1 from public.users where id=auth.uid() and role='brand_owner')
 union select null::uuid $$;
 insert into branches values('${a}'),('${b}'),('${c}');
 insert into users values('${staff}','${a}','Staff','active','staff'),('${manager}','${a}','Manager','active','manager'),('${inactive}','${a}','Inactive','inactive','staff'),('${owner}','${a}','Owner','active','brand_owner');
 insert into user_branches values('${manager}','${b}');
 insert into stock_batches(id,branch_id,product,category,unit,qty,expiry_date,logged_by)
 values('${id(20)}','${a}','Milk','Dairy','L',3,'2026-10-25','${staff}'),('${id(21)}','${a}','Oil','Dry','L',2,'2026-10-25','${staff}'),('${id(22)}','${b}','Rice','Dry','kg',4,'2026-10-25','${manager}'),('${id(23)}','${c}','Salt','Dry','kg',1,'2026-10-25','${owner}');
 alter table stock_batches enable row level security;
 create policy batches_select on stock_batches for select to authenticated using(branch_id in(select public.accessible_branch_ids()));
 create policy batches_update on stock_batches for update using(true) with check(true);
 grant all on stock_batches to authenticated,anon;
 grant select on users,branches,user_branches to authenticated;
 `);
 await db.exec(fs.readFileSync('supabase/migrations/20261025062639_inventory_batch_hardening.sql','utf8'));
 const as=async actor=>db.exec(`reset role; set role authenticated; select set_config('request.jwt.claim.sub','${actor}',false);`);
 await as(staff);
 for(const mutation of ["qty=99","expiry_date='2030-01-01'",`branch_id='${b}'`,"status='discarded'"])
  await assert.rejects(db.exec(`update stock_batches set ${mutation} where id='${id(20)}'`),/permission denied/i);
 await assert.rejects(db.exec(`delete from stock_batches where id='${id(20)}'`),/permission denied/i);
 await assert.rejects(db.query('select discard_batch_atomic($1)',[id(22)]),/Batch unavailable/);
 await assert.rejects(db.query("select private.close_stock_batch($1,'used')",[id(23)]),/Batch unavailable/);
 await assert.rejects(db.exec(`insert into stock_batches(id,branch_id,logged_by,status) values('${id(90)}','${a}','${staff}','used')`),/row-level security/i);
 await db.exec(`reset role; create function fail_waste() returns trigger language plpgsql as $$begin raise exception 'forced waste failure'; end$$; create trigger fail_waste before insert on waste_log for each row execute function fail_waste();`);
 await as(staff);await assert.rejects(db.query('select discard_batch_atomic($1)',[id(20)]),/forced waste failure/);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select status,closed_by,closed_at from stock_batches where id=$1',[id(20)])).rows[0],{status:'active',closed_by:null,closed_at:null});
 assert.equal((await db.query('select count(*)::int n from waste_log')).rows[0].n,0);
 await db.exec('drop trigger fail_waste on waste_log');await as(staff);
 await db.query('select discard_batch_atomic($1)',[id(20)]);await db.query('select discard_batch_atomic($1)',[id(20)]);
 await assert.rejects(db.query('select use_batch_atomic($1)',[id(20)]),/Batch already closed/);
 await db.query('select use_batch_atomic($1)',[id(21)]);await db.query('select use_batch_atomic($1)',[id(21)]);
 await as(inactive);await assert.rejects(db.query('select use_batch_atomic($1)',[id(21)]),/Active account required/);
 await as(manager);await db.query("update stock_batches set status='used' where id=$1",[id(22)]);
 await db.query('select use_batch_atomic($1)',[id(22)]);
 await as(owner);await db.query('select use_batch_atomic($1)',[id(23)]);
 await db.exec('reset role');
 assert.deepEqual((await db.query('select qty,logged_by from waste_log')).rows,[{qty:'3',logged_by:staff}]);
 assert.equal((await db.query('select closed_by from stock_batches where id=$1',[id(20)])).rows[0].closed_by,staff);
 assert.equal((await db.query('select closed_by from stock_batches where id=$1',[id(22)])).rows[0].closed_by,manager,'Legacy status-only clients receive canonical actor evidence');
 assert.ok((await db.query('select closed_at from stock_batches where id=$1',[id(20)])).rows[0].closed_at);
 await db.exec(`set role anon; select set_config('request.jwt.claim.sub','',false);`);
 await assert.rejects(db.query('select use_batch_atomic($1)',[id(21)]),/permission denied/i);
 await db.exec('reset role');await db.close();
 console.log('Batch hardening: direct tampering denied; branch/account checks, close retries, actor evidence and atomic waste rollback pass.');
})().catch(error=>{console.error(error);process.exitCode=1;});
