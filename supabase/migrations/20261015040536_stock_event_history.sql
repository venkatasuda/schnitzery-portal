-- Evidence journal, not a calculated stock balance. Counts are observations;
-- legacy snapshots cannot reconstruct deletions or a reliable opening balance.
begin;
set local lock_timeout='3s';
create table public.stock_events (
  id bigint generated always as identity primary key,
  source_table text not null check (source_table in ('inventory_counts','inventory_purchases','waste_log','stock_transfers')),
  source_id uuid not null,
  operation text not null check (operation in ('BASELINE','INSERT','UPDATE','DELETE')),
  branch_ids uuid[] not null,
  before_row jsonb,
  after_row jsonb,
  actor_id uuid,
  recorded_at timestamptz not null default clock_timestamp(),
  check (cardinality(branch_ids) > 0)
);
create index stock_events_branches on public.stock_events using gin(branch_ids);
create index stock_events_order on public.stock_events(id desc);
create unique index stock_events_baseline on public.stock_events(source_table,source_id) where operation='BASELINE';
alter table public.stock_events enable row level security;
revoke all on public.stock_events from public,anon,authenticated,service_role;
grant select on public.stock_events to authenticated,service_role;
create policy stock_events_manager_read on public.stock_events for select to authenticated
  using ((select public.is_manager()) and branch_ids && array(select public.accessible_branch_ids()));

create schema if not exists private;
-- Definer is intentional: authorized source-table writes must append evidence,
-- while their callers must never receive permission to forge journal entries.
-- Not an RPC: private schema, no EXECUTE grants, and trigger-only return type.
create function private.capture_stock_event() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb; following jsonb; branches uuid[];
begin
  if auth.uid() is null then raise exception 'Authenticated stock actor required'; end if;
  if tg_op <> 'INSERT' then previous := to_jsonb(old); end if;
  if tg_op <> 'DELETE' then following := to_jsonb(new); end if;
  if previous is not distinct from following then return null; end if;
  select array_agg(distinct value::uuid) into branches
    from unnest(array[previous->>'branch_id',following->>'branch_id',
      previous->>'from_branch_id',previous->>'to_branch_id',
      following->>'from_branch_id',following->>'to_branch_id']) as ids(value)
    where value is not null;
  insert into public.stock_events(source_table,source_id,operation,branch_ids,before_row,after_row,actor_id)
    values(tg_table_name,coalesce(following->>'id',previous->>'id')::uuid,tg_op,branches,previous,following,auth.uid());
  return null;
end $$;
revoke all on function private.capture_stock_event() from public,anon,authenticated,service_role;

-- Hold writes until both initial snapshots and future capture are installed.
lock table public.inventory_counts,public.inventory_purchases,public.waste_log,public.stock_transfers in share row exclusive mode;
insert into public.stock_events(source_table,source_id,operation,branch_ids,after_row)
  select 'inventory_counts',id,'BASELINE',array[branch_id],to_jsonb(c) from public.inventory_counts c where branch_id is not null
  union all select 'inventory_purchases',id,'BASELINE',array[branch_id],to_jsonb(p) from public.inventory_purchases p
  union all select 'waste_log',id,'BASELINE',array[branch_id],to_jsonb(w) from public.waste_log w
  union all select 'stock_transfers',id,'BASELINE',array[from_branch_id,to_branch_id],to_jsonb(t) from public.stock_transfers t;

create trigger stock_event_capture after insert or update or delete on public.inventory_counts for each row execute function private.capture_stock_event();
create trigger stock_event_capture after insert or update or delete on public.inventory_purchases for each row execute function private.capture_stock_event();
create trigger stock_event_capture after insert or update or delete on public.waste_log for each row execute function private.capture_stock_event();
create trigger stock_event_capture after insert or update or delete on public.stock_transfers for each row execute function private.capture_stock_event();

-- Protect retained evidence even against accidental service-client writes.
create function private.stock_events_immutable() returns trigger
language plpgsql set search_path='' as $$begin raise exception 'Stock history is immutable'; end $$;
revoke all on function private.stock_events_immutable() from public,anon,authenticated,service_role;
create trigger stock_events_immutable before update or delete or truncate on public.stock_events
  for each statement execute function private.stock_events_immutable();
-- TRUNCATE bypasses row triggers and RLS; refuse unaudited bulk erasure.
create trigger stock_history_no_truncate before truncate on public.inventory_counts for each statement execute function private.stock_events_immutable();
create trigger stock_history_no_truncate before truncate on public.inventory_purchases for each statement execute function private.stock_events_immutable();
create trigger stock_history_no_truncate before truncate on public.waste_log for each statement execute function private.stock_events_immutable();
create trigger stock_history_no_truncate before truncate on public.stock_transfers for each statement execute function private.stock_events_immutable();
commit;
