-- Daily preparation list (Inventory → Kitchen → Prep list; employee "Today's prep").
-- Evening routine: count leftovers → plan tomorrow (weekday target − leftover) → send.
-- Prepared food is tracked here, not in the stock catalogue (no double counting or valuation).
-- Sending notifies everyone rostered on the Preparation team that day.
begin;

-- Items with weekday targets (index 1 = Monday … 7 = Sunday). Reserve is shown separately.
create table if not exists public.prep_items (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 80),
  name_de text check (name_de is null or length(trim(name_de)) between 1 and 80),
  unit text not null check (length(trim(unit)) between 1 and 20),
  container_size numeric check (container_size is null or (container_size > 0 and container_size < 1e6)),
  container_label text check (container_label is null or length(trim(container_label)) between 1 and 30),
  target_min numeric[] not null default '{0,0,0,0,0,0,0}',
  target_max numeric[] not null default '{0,0,0,0,0,0,0}',
  reserve numeric[] not null default '{0,0,0,0,0,0,0}',
  sort integer not null default 0,
  is_active boolean not null default true,
  -- Optional link to a confirmed recipe yield: shows raw ingredients for the amount to prepare.
  yield_id uuid references public.inventory_recipe_yields(id) on delete set null,
  created_at timestamptz not null default now(),
  check (cardinality(target_min) = 7 and cardinality(target_max) = 7 and cardinality(reserve) = 7),
  check (0 <= all(target_min) and 0 <= all(target_max) and 0 <= all(reserve)),
  check (1e6 > all(target_max) and 1e6 > all(reserve))
);
create index if not exists prep_items_branch on public.prep_items (branch_id, is_active, sort);

-- Shift leaders: normal staff accounts with extra operational rights (prep list now; inventory tasks later).
-- Managers grant it per branch; nobody can grant it to themselves.
create table if not exists public.shift_leaders (
  branch_id uuid not null references public.branches(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (branch_id, user_id)
);

create table if not exists public.prep_lists (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  plan_date date not null,
  status text not null default 'draft' check (status in ('draft', 'sent')),
  version integer not null default 0,
  note text check (note is null or length(note) <= 500),
  updated_by uuid references public.users(id) on delete set null,
  sent_by uuid references public.users(id) on delete set null,
  sent_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (branch_id, plan_date)
);
create index if not exists prep_lists_branch_date on public.prep_lists (branch_id, plan_date desc);

create table if not exists public.prep_list_lines (
  list_id uuid not null references public.prep_lists(id) on delete cascade,
  item_id uuid not null references public.prep_items(id),
  item_name text not null,
  unit text not null,
  container_size numeric,
  container_label text,
  target numeric not null check (target >= 0 and target < 1e6),
  leftover numeric check (leftover is null or (leftover >= 0 and leftover < 1e6)),
  reserve numeric not null default 0 check (reserve >= 0 and reserve < 1e6),
  override numeric check (override is null or (override >= 0 and override < 1e6)),
  reason text check (reason is null or length(reason) <= 200),
  to_prepare numeric not null check (to_prepare >= 0),
  sort integer not null default 0,
  primary key (list_id, item_id)
);

-- Evening leftover count of prepared food (one row per item and day; latest save wins).
create table if not exists public.prep_leftovers (
  branch_id uuid not null references public.branches(id) on delete cascade,
  count_date date not null,
  item_id uuid not null references public.prep_items(id),
  qty numeric not null check (qty >= 0 and qty < 1e6),
  counted_by uuid references public.users(id) on delete set null,
  counted_at timestamptz not null default now(),
  primary key (branch_id, count_date, item_id)
);

create or replace function private.is_shift_leader(p_branch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (select 1 from public.shift_leaders s join public.users u on u.id = s.user_id
    where s.branch_id = p_branch and s.user_id = auth.uid() and u.status = 'active')
$$;
revoke all on function private.is_shift_leader(uuid) from public, anon;
grant execute on function private.is_shift_leader(uuid) to authenticated;

create or replace function private.can_plan_prep(p_branch uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and p_branch in (select public.accessible_branch_ids())
    and (public.is_manager() or private.is_shift_leader(p_branch))
$$;
revoke all on function private.can_plan_prep(uuid) from public, anon;
grant execute on function private.can_plan_prep(uuid) to authenticated;
create or replace function public.can_plan_prep(p_branch uuid) returns boolean language sql stable security invoker set search_path = '' as $$ select private.can_plan_prep(p_branch) $$;
revoke all on function public.can_plan_prep(uuid) from public, anon;
grant execute on function public.can_plan_prep(uuid) to authenticated;

alter table public.prep_items enable row level security;
alter table public.shift_leaders enable row level security;
alter table public.prep_lists enable row level security;
alter table public.prep_list_lines enable row level security;
alter table public.prep_leftovers enable row level security;

drop policy if exists prep_items_read on public.prep_items;
create policy prep_items_read on public.prep_items for select to authenticated using (branch_id in (select public.accessible_branch_ids()));
drop policy if exists prep_items_insert on public.prep_items;
create policy prep_items_insert on public.prep_items for insert to authenticated with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
drop policy if exists prep_items_update on public.prep_items;
create policy prep_items_update on public.prep_items for update to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

drop policy if exists shift_leaders_read on public.shift_leaders;
create policy shift_leaders_read on public.shift_leaders for select to authenticated using (branch_id in (select public.accessible_branch_ids()));
drop policy if exists shift_leaders_insert on public.shift_leaders;
create policy shift_leaders_insert on public.shift_leaders for insert to authenticated with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()) and user_id <> auth.uid());
drop policy if exists shift_leaders_delete on public.shift_leaders;
create policy shift_leaders_delete on public.shift_leaders for delete to authenticated using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

-- Drafts are visible to planners only; everyone in the branch sees sent lists.
drop policy if exists prep_lists_read on public.prep_lists;
create policy prep_lists_read on public.prep_lists for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and (status = 'sent' or private.can_plan_prep(branch_id)));
drop policy if exists prep_leftovers_read on public.prep_leftovers;
create policy prep_leftovers_read on public.prep_leftovers for select to authenticated using (branch_id in (select public.accessible_branch_ids()));
drop policy if exists prep_list_lines_read on public.prep_list_lines;
create policy prep_list_lines_read on public.prep_list_lines for select to authenticated
  using (exists (select 1 from public.prep_lists l where l.id = list_id));

revoke all on public.prep_items, public.shift_leaders, public.prep_lists, public.prep_list_lines, public.prep_leftovers from anon;
grant select, insert, update on public.prep_items to authenticated;
grant select, insert, delete on public.shift_leaders to authenticated;
grant select on public.prep_lists, public.prep_list_lines, public.prep_leftovers to authenticated;

-- Save (and optionally send) one day's list. Lines: [{item_id, target, leftover|null, reserve, override|null, reason|null}].
-- to_prepare = override, else max(0, target − leftover); a missing leftover counts as nothing left.
create or replace function private.save_prep_list(p_branch uuid, p_date date, p_lines jsonb, p_note text, p_send boolean, p_version integer)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare l public.prep_lists%rowtype; actor uuid := auth.uid(); recipients integer := 0; dayname text; msg text;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Prep planning access required' using errcode = '42501'; end if;
  if p_date is null or p_date < (now() at time zone 'Europe/Berlin')::date - 1 or p_date > (now() at time zone 'Europe/Berlin')::date + 14 then raise exception 'Invalid prep date'; end if;
  if jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 200 then raise exception 'Invalid prep lines'; end if;
  if exists (select 1 from jsonb_array_elements(p_lines) x where jsonb_typeof(x->'target') <> 'number' or jsonb_typeof(x->'reserve') <> 'number'
      or (x->'leftover' is not null and jsonb_typeof(x->'leftover') not in ('number','null'))
      or (x->'override' is not null and jsonb_typeof(x->'override') not in ('number','null'))
      or not exists (select 1 from public.prep_items i where i.id = (x->>'item_id')::uuid and i.branch_id = p_branch))
    then raise exception 'Invalid prep lines'; end if;

  perform pg_advisory_xact_lock(hashtextextended('prep-list:' || p_branch::text || ':' || p_date::text, 0));
  select * into l from public.prep_lists where branch_id = p_branch and plan_date = p_date for update;
  if found and l.version <> coalesce(p_version, -1) then raise exception 'Prep list changed. Reload before saving.' using errcode = '40001'; end if;
  if not found then
    insert into public.prep_lists (branch_id, plan_date, updated_by) values (p_branch, p_date, actor) returning * into l;
  end if;

  delete from public.prep_list_lines where list_id = l.id;
  insert into public.prep_list_lines (list_id, item_id, item_name, unit, container_size, container_label, target, leftover, reserve, override, reason, to_prepare, sort)
  select l.id, i.id, i.name, i.unit, i.container_size, i.container_label, (x->>'target')::numeric, (x->>'leftover')::numeric, (x->>'reserve')::numeric,
    (x->>'override')::numeric, nullif(trim(x->>'reason'), ''),
    coalesce((x->>'override')::numeric, greatest(0, (x->>'target')::numeric - coalesce((x->>'leftover')::numeric, 0))), i.sort
  from jsonb_array_elements(p_lines) x join public.prep_items i on i.id = (x->>'item_id')::uuid;

  update public.prep_lists set version = version + 1, note = nullif(trim(p_note), ''), updated_by = actor, updated_at = now(),
    status = case when p_send then 'sent' else status end,
    sent_by = case when p_send then actor else sent_by end, sent_at = case when p_send then now() else sent_at end
  where id = l.id returning * into l;

  if p_send then
    dayname := trim(to_char(p_date, 'FMDay'));
    msg := (select string_agg(x.item_name || ': ' || trim(to_char(x.to_prepare, 'FM999999990.##')) || ' ' || x.unit, ' · ' order by x.sort, x.item_name)
            from public.prep_list_lines x where x.list_id = l.id and x.to_prepare > 0);
    with team as (
      select distinct (e->>'user_id')::uuid as uid
      from public.weekly_roster r, jsonb_array_elements(coalesce(r.roster_data -> dayname, '[]'::jsonb)) e
      where r.branch_id = p_branch and r.week_start = date_trunc('week', p_date)::date
        and e->>'team' = 'Preparation' and (e->>'user_id') ~* '^[0-9a-f-]{36}$'
    )
    select count(*) into recipients from (select public.notify(t.uid, p_branch, 'prep_list', 'prep:' || l.id || ':v' || l.version, coalesce(msg, 'Nothing to prepare'), '1 minute'::interval) from team t) s;
  end if;
  return jsonb_build_object('id', l.id, 'version', l.version, 'status', l.status, 'notified', recipients);
end $$;
revoke all on function private.save_prep_list(uuid, date, jsonb, text, boolean, integer) from public, anon;
grant execute on function private.save_prep_list(uuid, date, jsonb, text, boolean, integer) to authenticated;
create or replace function public.save_prep_list(p_branch uuid, p_date date, p_lines jsonb, p_note text default null, p_send boolean default false, p_version integer default 0)
returns jsonb language sql security invoker set search_path = '' as $$ select private.save_prep_list(p_branch, p_date, p_lines, p_note, p_send, p_version) $$;
revoke all on function public.save_prep_list(uuid, date, jsonb, text, boolean, integer) from public, anon;
grant execute on function public.save_prep_list(uuid, date, jsonb, text, boolean, integer) to authenticated;

-- Save tonight's leftover counts: [{item_id, qty}] (planners only; a blank item is simply not sent).
create or replace function private.save_prep_leftovers(p_branch uuid, p_date date, p_counts jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare n integer;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Prep planning access required' using errcode = '42501'; end if;
  if p_date is null or p_date < (now() at time zone 'Europe/Berlin')::date - 2 or p_date > (now() at time zone 'Europe/Berlin')::date then raise exception 'Invalid count date'; end if;
  if jsonb_typeof(p_counts) is distinct from 'array' or jsonb_array_length(p_counts) = 0 or jsonb_array_length(p_counts) > 200
    or exists (select 1 from jsonb_array_elements(p_counts) x where jsonb_typeof(x->'qty') <> 'number'
      or not exists (select 1 from public.prep_items i where i.id = (x->>'item_id')::uuid and i.branch_id = p_branch))
    then raise exception 'Invalid leftover counts'; end if;
  insert into public.prep_leftovers (branch_id, count_date, item_id, qty, counted_by)
  select p_branch, p_date, (x->>'item_id')::uuid, (x->>'qty')::numeric, auth.uid() from jsonb_array_elements(p_counts) x
  on conflict (branch_id, count_date, item_id) do update set qty = excluded.qty, counted_by = excluded.counted_by, counted_at = now();
  get diagnostics n = row_count;
  return n;
end $$;
revoke all on function private.save_prep_leftovers(uuid, date, jsonb) from public, anon;
grant execute on function private.save_prep_leftovers(uuid, date, jsonb) to authenticated;
create or replace function public.save_prep_leftovers(p_branch uuid, p_date date, p_counts jsonb)
returns integer language sql security invoker set search_path = '' as $$ select private.save_prep_leftovers(p_branch, p_date, p_counts) $$;
revoke all on function public.save_prep_leftovers(uuid, date, jsonb) from public, anon;
grant execute on function public.save_prep_leftovers(uuid, date, jsonb) to authenticated;

notify pgrst, 'reload schema';
commit;
