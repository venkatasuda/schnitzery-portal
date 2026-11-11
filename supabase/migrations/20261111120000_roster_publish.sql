-- Roster drafts + publish, and staff tiers (step 1 of the smart scheduler).
-- weekly_roster.roster_data stays the PUBLISHED roster: attendance, payroll, Shifts, cover and prep keep
-- reading it unchanged. Unpublished work lives in roster_drafts (managers only — staff never see a draft).
-- Publishing copies the draft live (only if the live roster did not change meanwhile, e.g. an approved
-- cover) and notifies everyone on the published roster. staff_tiers is manager-only as well.
begin;

create table if not exists public.roster_drafts (
  branch_id uuid not null references public.branches(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  roster_data jsonb not null,
  base_data jsonb,               -- the published roster this draft started from (null = none yet)
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (branch_id, week_start)
);
alter table public.roster_drafts enable row level security;
drop policy if exists roster_drafts_managers on public.roster_drafts;
create policy roster_drafts_managers on public.roster_drafts for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
revoke all on public.roster_drafts from anon;
grant select, insert, update, delete on public.roster_drafts to authenticated;

-- Tier 1 = senior/ace, 2 = mid, 3 = junior. Used by the scheduler; not visible to employees.
create table if not exists public.staff_tiers (
  user_id uuid primary key references public.users(id) on delete cascade,
  branch_id uuid not null references public.branches(id) on delete cascade,
  tier smallint not null check (tier between 1 and 3),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.staff_tiers enable row level security;
drop policy if exists staff_tiers_managers on public.staff_tiers;
create policy staff_tiers_managers on public.staff_tiers for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
revoke all on public.staff_tiers from anon;
grant select, insert, update, delete on public.staff_tiers to authenticated;

alter table public.weekly_roster add column if not exists published_at timestamptz;
alter table public.weekly_roster add column if not exists published_by uuid references public.users(id) on delete set null;

-- Publish one week's draft. Returns how many people were notified.
create or replace function private.publish_roster(p_branch uuid, p_week date) returns integer
language plpgsql security definer set search_path = '' as $$
declare d public.roster_drafts%rowtype; live jsonb; uid uuid; n integer := 0;
begin
  if auth.uid() is null or not public.is_manager() or p_branch not in (select public.accessible_branch_ids())
    then raise exception 'Managers only' using errcode = '42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('roster:' || p_branch::text || ':' || p_week::text, 0));
  select * into d from public.roster_drafts where branch_id = p_branch and week_start = p_week for update;
  if not found then raise exception 'No draft to publish' using errcode = '22023'; end if;
  select roster_data into live from public.weekly_roster where branch_id = p_branch and week_start = p_week for update;
  -- Someone changed the live roster after this draft started (e.g. an approved cover/swap).
  if live is distinct from d.base_data then raise exception 'Roster changed since this draft' using errcode = '40001'; end if;
  insert into public.weekly_roster (branch_id, week_start, roster_data, published_at, published_by)
  values (p_branch, p_week, d.roster_data, now(), auth.uid())
  on conflict (branch_id, week_start) do update set roster_data = excluded.roster_data, published_at = now(), published_by = auth.uid();
  delete from public.roster_drafts where branch_id = p_branch and week_start = p_week;
  for uid in select distinct (e ->> 'user_id')::uuid from jsonb_each(d.roster_data) as days(day, arr), jsonb_array_elements(days.arr) as e
             where e ->> 'user_id' is not null loop
    perform public.notify(uid, p_branch, 'roster', 'roster:' || p_week::text || ':' || floor(extract(epoch from now()))::bigint::text,
      'Your shifts for the week of ' || to_char(p_week, 'DD.MM.') || ' are published.', interval '1 minute');
    n := n + 1;
  end loop;
  return n;
end $$;
revoke all on function private.publish_roster(uuid, date) from public, anon;
grant execute on function private.publish_roster(uuid, date) to authenticated;
create or replace function public.publish_roster(p_branch uuid, p_week date) returns integer
language sql security invoker set search_path = '' as $$ select private.publish_roster(p_branch, p_week) $$;
revoke all on function public.publish_roster(uuid, date) from public, anon;
grant execute on function public.publish_roster(uuid, date) to authenticated;

notify pgrst, 'reload schema';
commit;
