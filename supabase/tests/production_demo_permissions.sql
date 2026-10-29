-- Manual production acceptance. Only the user-supplied demo staff identity is used.
-- Run against the verified Schnitzery project; every attempted write is rolled back.
begin;
set local statement_timeout = '10s';
do $$ begin
 if not exists(select 1 from public.users where id='d162c1bd-d4e7-4409-9d11-42afff16537b'
   and email='demo.staff@schnitzery-demo.de' and role='staff' and status='active') then
   raise exception 'Expected active demo staff identity missing';
 end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','d162c1bd-d4e7-4409-9d11-42afff16537b',true);
select set_config('request.jwt.claims','{"sub":"d162c1bd-d4e7-4409-9d11-42afff16537b","role":"authenticated"}',true);
do $$ declare n integer; begin
 if current_user <> 'authenticated' or auth.uid() <> 'd162c1bd-d4e7-4409-9d11-42afff16537b'::uuid then
   raise exception 'Test is not running as demo staff';
 end if;
 select count(*) into n from public.users where id=auth.uid();
 if n<>1 then raise exception 'Positive control: own profile is not visible'; end if;
 select count(*) into n from public.users where branch_id is distinct from '20b8cb3e-2046-40d7-9f5e-c7ef18261bd6'::uuid;
 if n<>0 then raise exception 'Foreign-branch user records visible'; end if;
 begin
   update public.users set role='brand_owner' where id=auth.uid();
   get diagnostics n = row_count;
   if n<>0 then raise exception 'UNSAFE: self-promotion succeeded'; end if;
 exception when insufficient_privilege then null;
 when raise_exception then
   if sqlerrm not in ('You cannot change roles.', 'You cannot change your own role, branch, contract, leave allowance, status, email or lock.') then raise; end if;
 end;
 begin
   update public.users set branch_id='e7c2600c-b415-4913-b6b7-77d984392fb9' where id=auth.uid();
   get diagnostics n = row_count;
   if n<>0 then raise exception 'UNSAFE: self branch reassignment succeeded'; end if;
 exception when insufficient_privilege then null;
 when raise_exception then
   if sqlerrm <> 'You cannot change your own role, branch, contract, leave allowance, status, email or lock.' then raise; end if;
 end;
 if has_column_privilege(current_user,'public.stock_batches','qty','UPDATE')
    or has_column_privilege(current_user,'public.stock_batches','expiry_date','UPDATE')
    or has_table_privilege(current_user,'public.stock_batches','DELETE') then
   raise exception 'UNSAFE: batch field rewrite/delete privilege';
 end if;
 begin
   update public.stock_batches set qty=0 where id='00000000-0000-0000-0000-000000000000';
   raise exception 'UNSAFE: batch quantity update command allowed';
 exception when insufficient_privilege then null; end;
 begin
   perform public.notification_sweep();
   raise exception 'UNSAFE: staff can run internal notification sweep';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
select 'PASS: authenticated demo staff positive control, cross-branch read isolation, self-promotion/reassignment denial, batch tampering and internal RPC denial. All writes rolled back.' as result;
