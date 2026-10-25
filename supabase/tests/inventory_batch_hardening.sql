-- Run only on isolated staging. Synthetic account and transaction rollback required.
\set ON_ERROR_STOP on
begin;
select id as staff_id, branch_id as branch_id from public.users
where email='local.staff.a@example.test' and role='staff' and status='active' \gset
select gen_random_uuid() as batch_id \gset
select set_config('test.batch_id', :'batch_id',true);
set local role authenticated;
select set_config('request.jwt.claim.sub', :'staff_id',true);
insert into public.stock_batches(id,branch_id,product,category,qty,unit,received_date,expiry_date,status,logged_by)
values(:'batch_id',:'branch_id','Batch security test '||:'batch_id','E2E',3,'L',current_date,current_date,'active',:'staff_id');
do $$
declare b public.stock_batches%rowtype; batch uuid:=current_setting('test.batch_id')::uuid; n integer;
begin
  begin
    update public.stock_batches set qty=99 where id=batch;
    raise exception 'Direct quantity rewrite was allowed';
  exception when insufficient_privilege then null; end;
  begin
    update public.stock_batches set status='discarded' where id=batch;
    raise exception 'Direct status rewrite was allowed';
  exception when insufficient_privilege then null; end;
  perform public.discard_batch_atomic(batch);
  perform public.discard_batch_atomic(batch);
  select * into strict b from public.stock_batches where id=batch;
  if b.status<>'discarded' or b.closed_by is distinct from auth.uid() or b.closed_at is null or b.qty<>3 then
    raise exception 'Incorrect closure evidence';
  end if;
  select count(*) into n from public.waste_log where product=b.product and branch_id=b.branch_id and qty=3 and logged_by=auth.uid();
  if n<>1 then raise exception 'Discard did not create exactly one waste record'; end if;
  begin
    perform public.use_batch_atomic(batch);
    raise exception 'Discarded batch was used';
  exception when serialization_failure then null; end;
end $$;
rollback;
