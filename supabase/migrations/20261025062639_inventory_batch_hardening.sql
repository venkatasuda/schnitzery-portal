-- Batch identity/quantity/expiry are immutable to browser clients. Closing a
-- batch goes through one checked transaction, including waste on discard.
begin;
set local lock_timeout = '3s';
create schema if not exists private;
alter table public.stock_batches
  add column closed_by uuid references public.users(id) on delete set null,
  add column closed_at timestamptz;
revoke update, delete on public.stock_batches from public, anon, authenticated;
-- Older deployed clients mark used with UPDATE(status). Keep that single safe
-- transition during rollout; no quantity/identity edits or direct discard.
grant update(status) on public.stock_batches to authenticated;
drop policy if exists batches_update on public.stock_batches;
create policy batches_update on public.stock_batches for update to authenticated
using(status='active' and branch_id in(select public.accessible_branch_ids())
  and exists(select 1 from public.users where id=auth.uid() and status='active'))
with check(status='used' and branch_id in(select public.accessible_branch_ids())
  and closed_by=auth.uid() and closed_at is not null);
create function private.guard_batch_update() returns trigger language plpgsql security invoker set search_path='' as $$
begin
  -- Non-browser database roles and the checked definer below retain admin access.
  if current_user<>'authenticated' then return new; end if;
  if old.status<>'active' or new.status<>'used'
    or (to_jsonb(new)-array['status','closed_by','closed_at']) is distinct from
       (to_jsonb(old)-array['status','closed_by','closed_at']) then
    raise exception 'permission denied: use the batch workflow' using errcode='42501';
  end if;
  new.closed_by:=auth.uid(); new.closed_at:=now();
  return new;
end $$;
revoke all on function private.guard_batch_update() from public,anon,authenticated;
create trigger batch_update_guard before update on public.stock_batches
for each row execute function private.guard_batch_update();
drop policy if exists batches_insert on public.stock_batches;
create policy batches_insert on public.stock_batches for insert to authenticated
with check (branch_id in (select public.accessible_branch_ids())
  and logged_by=auth.uid() and status='active' and closed_by is null and closed_at is null
  and exists(select 1 from public.users where id=auth.uid() and status='active'));

create function private.close_stock_batch(p_id uuid, p_status text)
returns void language plpgsql security definer set search_path='' as $$
declare b public.stock_batches%rowtype; actor_name text;
begin
  if auth.uid() is null or p_status is null or p_status not in ('used','discarded') then
    raise exception 'Batch action denied' using errcode='42501';
  end if;
  select full_name into actor_name from public.users where id=auth.uid() and status='active';
  if not found then raise exception 'Active account required' using errcode='42501'; end if;
  select * into b from public.stock_batches where id=p_id for update;
  if not found or not exists(select 1 from public.accessible_branch_ids() as allowed(id) where allowed.id=b.branch_id) then
    raise exception 'Batch unavailable' using errcode='42501';
  end if;
  if b.status=p_status then return; end if;
  if b.status<>'active' then raise exception 'Batch already closed' using errcode='40001'; end if;
  if p_status='discarded' then
    insert into public.waste_log(branch_id,product,category,qty,unit,reason,note,logged_by,logged_by_name,work_date)
    values(b.branch_id,b.product,b.category,b.qty,b.unit,'expired','Auto from expiry',auth.uid(),actor_name,
      (now() at time zone 'Europe/Berlin')::date);
  end if;
  update public.stock_batches set status=p_status,closed_by=auth.uid(),closed_at=now() where id=p_id;
end $$;
revoke all on function private.close_stock_batch(uuid,text) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.close_stock_batch(uuid,text) to authenticated;

create or replace function public.discard_batch_atomic(p_id uuid)
returns void language sql security invoker set search_path='' as $$
  select private.close_stock_batch(p_id,'discarded');
$$;
create function public.use_batch_atomic(p_id uuid)
returns void language sql security invoker set search_path='' as $$
  select private.close_stock_batch(p_id,'used');
$$;
revoke all on function public.discard_batch_atomic(uuid),public.use_batch_atomic(uuid) from public,anon;
grant execute on function public.discard_batch_atomic(uuid),public.use_batch_atomic(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
