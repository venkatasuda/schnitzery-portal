-- Atomic workflows: a failed write rolls back all related changes.
-- Invoker functions retain caller RLS; no service-role access is needed.
create or replace function public.approve_document_atomic(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare d public.user_documents%rowtype;
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  select * into d from public.user_documents where id = p_id;
  if not found then raise exception 'Document not found'; end if;
  if d.user_id = auth.uid() then raise exception 'Cannot approve your own document'; end if;
  -- Serialize approvals for all versions of this employee's document type.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(d.user_id::text || ':' || d.doc_type, 0));
  select * into d from public.user_documents where id = p_id for update;
  if not found or d.status not in ('pending', 'approved') then raise exception 'Document no longer pending'; end if;
  update public.user_documents set is_active = false
    where user_id = d.user_id and doc_type = d.doc_type and id <> p_id and is_active;
  update public.user_documents set status = 'approved', is_active = true,
    reviewed_by = auth.uid(), reviewed_at = now(), rejection_reason = null where id = p_id;
  if not found then raise exception 'Document approval denied'; end if;
end $$;

create or replace function public.discard_batch_atomic(p_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare b public.stock_batches%rowtype; caller_name text;
begin
  if auth.uid() is null then raise exception 'Not logged in'; end if;
  select * into b from public.stock_batches where id = p_id for update;
  if not found then raise exception 'Batch not found'; end if;
  if b.status = 'discarded' then return; end if;
  if b.status <> 'active' then raise exception 'Batch already used'; end if;
  select full_name into caller_name from public.users where id = auth.uid();
  insert into public.waste_log(branch_id, product, category, qty, unit, reason, note, logged_by, logged_by_name, work_date)
    values(b.branch_id, b.product, b.category, b.qty, b.unit, 'expired', 'Auto from expiry', auth.uid(), caller_name,
      (now() at time zone 'Europe/Berlin')::date);
  update public.stock_batches set status = 'discarded' where id = p_id and status = 'active';
  if not found then raise exception 'Batch discard denied'; end if;
end $$;

create or replace function public.decide_cover_atomic(p_id uuid, p_decision text)
returns boolean language plpgsql security invoker set search_path = '' as $$
declare c public.cover_requests%rowtype; r public.weekly_roster%rowtype;
  caller_branch uuid; caller_name text; claimer_name text; shift_index integer; entries jsonb;
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_decision not in ('approved', 'rejected') or p_decision is null then raise exception 'Invalid decision'; end if;
  select branch_id, full_name into caller_branch, caller_name from public.users where id = auth.uid();
  select * into c from public.cover_requests where id = p_id for update;
  if not found or c.branch_id is distinct from caller_branch then raise exception 'Request not found'; end if;
  if c.status not in ('open', 'claimed') then raise exception 'Already actioned'; end if;
  if p_decision = 'approved' then
    if c.status <> 'claimed' or c.claimer_id is null or c.claimer_id = c.requester_id then raise exception 'No valid claimant'; end if;
    select full_name into claimer_name from public.users where id = c.claimer_id and branch_id = c.branch_id;
    if not found then raise exception 'Claimant no longer in branch'; end if;
    select * into strict r from public.weekly_roster where branch_id = c.branch_id
      and week_start = c.work_date - (extract(isodow from c.work_date)::integer - 1) for update;
    if c.day <> (array['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'])[extract(isodow from c.work_date)::integer] then raise exception 'Shift date and day disagree'; end if;
    entries := coalesce(r.roster_data -> c.day, '[]'::jsonb);
    select ordinal::integer - 1 into strict shift_index
      from jsonb_array_elements(entries) with ordinality as shifts(entry, ordinal)
      where entry ->> 'user_id' = c.requester_id::text and entry ->> 'team' = c.team and entry ->> 'shift' = c.shift;
    if exists(select 1 from jsonb_array_elements(entries) as shifts(entry)
      where entry ->> 'user_id' = c.claimer_id::text and entry ->> 'shift' = c.shift)
      then raise exception 'Claimant already scheduled for this shift'; end if;
    entries := jsonb_set(entries, array[shift_index::text],
      (entries -> shift_index) || jsonb_build_object('user_id', c.claimer_id, 'name', claimer_name));
    update public.weekly_roster set roster_data = jsonb_set(coalesce(r.roster_data, '{}'::jsonb), array[c.day], entries) where id = r.id;
    if not found then raise exception 'Roster update denied'; end if;
  end if;
  update public.cover_requests set status = p_decision, resolved_by = caller_name, resolved_at = now() where id = p_id;
  if not found then raise exception 'Cover decision denied'; end if;
  return p_decision = 'approved';
end $$;

revoke all on function public.approve_document_atomic(uuid) from public, anon;
revoke all on function public.discard_batch_atomic(uuid) from public, anon;
revoke all on function public.decide_cover_atomic(uuid, text) from public, anon;
grant execute on function public.approve_document_atomic(uuid) to authenticated;
grant execute on function public.discard_batch_atomic(uuid) to authenticated;
grant execute on function public.decide_cover_atomic(uuid, text) to authenticated;

-- Prevent new invalid quantities while preserving legacy rows for a separate audit.
alter table public.inventory_master add constraint inventory_target_valid check (soll >= 0 and soll < 'Infinity'::numeric) not valid;
alter table public.inventory_counts add constraint inventory_count_valid check (ist >= 0 and ist < 'Infinity'::numeric and soll >= 0 and soll < 'Infinity'::numeric) not valid;
alter table public.inventory_purchases add constraint inventory_purchase_valid check (qty > 0 and qty < 'Infinity'::numeric and cost >= 0 and cost < 'Infinity'::numeric) not valid;
alter table public.stock_batches add constraint batch_quantity_valid check (qty > 0 and qty < 'Infinity'::numeric) not valid;
alter table public.waste_log add constraint waste_quantity_valid check (qty > 0 and qty < 'Infinity'::numeric) not valid;
alter table public.stock_transfers add constraint transfer_quantity_valid check (qty > 0 and qty < 'Infinity'::numeric) not valid;
alter table public.daily_sales add constraint sales_amount_valid check (amount >= 0 and amount < 'Infinity'::numeric) not valid;
-- Deliberately fails if the existing active catalog has duplicates. Review them;
-- never delete historical data automatically to make a migration pass.
create unique index inventory_active_identity on public.inventory_master(branch_id, coalesce(category, ''), product, coalesce(unit, '')) where is_active;
create unique index document_one_approved_version on public.user_documents(user_id, doc_type) where is_active and status = 'approved';
create unique index cover_one_active_request on public.cover_requests(requester_id, work_date, team, shift) where status in ('open', 'claimed');
create unique index roster_one_branch_week on public.weekly_roster(branch_id, week_start);

create table public.agent_request_limits (
  user_id uuid primary key references public.users(id) on delete cascade,
  window_start timestamptz not null,
  requests integer not null check (requests > 0)
);
alter table public.agent_request_limits enable row level security;
create policy agent_limits_own_read on public.agent_request_limits for select to authenticated using (user_id = auth.uid());
revoke all on public.agent_request_limits from public, anon, authenticated;
grant select on public.agent_request_limits to authenticated;

-- ponytail: fixed minute windows allow a boundary burst of twenty requests;
-- use a sliding-window limiter if measured traffic requires stricter smoothing.
create function public.allow_agent_request() returns boolean
language plpgsql security definer set search_path = '' as $$
declare n integer; started timestamptz := date_trunc('minute', now());
begin
  if auth.uid() is null or not exists(select 1 from public.users where id = auth.uid()
    and role in ('manager', 'branch_owner', 'brand_owner', 'super_admin')) then return false; end if;
  insert into public.agent_request_limits as limits(user_id, window_start, requests) values(auth.uid(), started, 1)
  on conflict(user_id) do update set window_start = started,
    requests = case when limits.window_start = started then limits.requests + 1 else 1 end
  returning requests into n;
  return n <= 10;
end $$;
revoke all on function public.allow_agent_request() from public, anon;
grant execute on function public.allow_agent_request() to authenticated;
