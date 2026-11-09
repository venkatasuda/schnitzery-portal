-- End-of-day close: one immutable sign-off per branch and day by a shift leader or manager.
-- The database computes the snapshot (sales, temperatures, checklists, prep leftovers, tomorrow's
-- prep list, people still clocked in, cash difference). Open points do not block the close, but each
-- one needs a short reason that is saved with it. A closed day cannot be changed.
begin;

create table if not exists public.day_closes (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id) on delete cascade,
  work_date date not null,
  pos_total numeric check (pos_total is null or (pos_total >= 0 and pos_total < 1e7)),
  pos_cash numeric check (pos_cash is null or (pos_cash >= 0 and pos_cash < 1e7)),
  counted_cash numeric check (counted_cash is null or (counted_cash >= 0 and counted_cash < 1e7)),
  cash_difference numeric,
  snapshot jsonb not null,
  reasons jsonb not null default '{}'::jsonb,
  note text check (note is null or length(note) <= 1000),
  closed_by uuid references public.users(id) on delete set null,
  closed_at timestamptz not null default now(),
  unique (branch_id, work_date)
);

alter table public.day_closes enable row level security;
drop policy if exists day_closes_read on public.day_closes;
create policy day_closes_read on public.day_closes for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and private.can_plan_prep(branch_id));
revoke all on public.day_closes from anon, authenticated;
grant select on public.day_closes to authenticated;

-- What the day looks like right now (also used for the preview screen).
create or replace function private.day_close_snapshot(p_branch uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare units int; logged int; total_tasks int; done_tasks int; items int; counted int; prep text; sales numeric; open_people jsonb;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Day close access required' using errcode = '42501'; end if;
  select count(*) into units from public.temp_units where branch_id = p_branch and is_active;
  select count(distinct unit_id) into logged from public.temp_logs l join public.temp_units u on u.id = l.unit_id
    where l.branch_id = p_branch and l.work_date = p_date and u.is_active;
  select count(*), count(*) filter (where done) into total_tasks, done_tasks from public.checklists where branch_id = p_branch and work_date = p_date;
  -- Today's list is created when someone first opens it: if nobody did, the weekday's templates still count as open.
  total_tasks := greatest(total_tasks, (select count(*) from public.checklist_templates
    where branch_id = p_branch and is_active and extract(isodow from p_date)::smallint = any(weekdays)));
  select count(*) into items from public.prep_items where branch_id = p_branch and is_active;
  select count(*) into counted from public.prep_leftovers l join public.prep_items i on i.id = l.item_id
    where l.branch_id = p_branch and l.count_date = p_date and i.is_active;
  select status into prep from public.prep_lists where branch_id = p_branch and plan_date = p_date + 1;
  select amount into sales from public.daily_sales where branch_id = p_branch and sale_date = p_date;
  select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(u.full_name, '—'), 'since', a.clock_in) order by a.clock_in), '[]'::jsonb) into open_people
    from public.attendance_logs a left join public.users u on u.id = a.user_id
    where a.branch_id = p_branch and a.status in ('active', 'on-break') and a.work_date <= p_date;
  return jsonb_build_object(
    'date', p_date, 'recorded_sales', sales,
    'temps', jsonb_build_object('units', units, 'logged', logged),
    'checklists', jsonb_build_object('total', total_tasks, 'done', done_tasks),
    'leftovers', jsonb_build_object('items', items, 'counted', counted),
    'next_prep_list', coalesce(prep, 'none'),
    'clocked_in', open_people);
end $$;

-- Close the day. Reasons: {"sales": "...", "temps": "...", ...} for every open point.
create or replace function private.close_day(p_branch uuid, p_date date, p_pos_total numeric, p_pos_cash numeric, p_counted_cash numeric, p_reasons jsonb, p_note text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare snap jsonb; diff numeric; open_points text[] := '{}'; k text; new_id uuid;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Day close access required' using errcode = '42501'; end if;
  if p_date is null or p_date > (now() at time zone 'Europe/Berlin')::date or p_date < (now() at time zone 'Europe/Berlin')::date - 2 then raise exception 'Invalid close date'; end if;
  if p_pos_cash is not null and p_pos_total is not null and p_pos_cash > p_pos_total then raise exception 'POS cash cannot exceed POS total'; end if;
  if p_reasons is null or jsonb_typeof(p_reasons) <> 'object' then raise exception 'Invalid reasons'; end if;
  perform pg_advisory_xact_lock(hashtextextended('day-close:' || p_branch::text || ':' || p_date::text, 0));
  if exists (select 1 from public.day_closes where branch_id = p_branch and work_date = p_date) then raise exception 'Day already closed' using errcode = '23505'; end if;

  snap := private.day_close_snapshot(p_branch, p_date);
  diff := case when p_counted_cash is not null and p_pos_cash is not null then round(p_counted_cash - p_pos_cash, 2) end;
  -- Sales: missing, or different from the figure already in daily_sales (POS import / manager entry) → needs a reason.
  if p_pos_total is null or (snap->>'recorded_sales' is not null and abs(p_pos_total - (snap->>'recorded_sales')::numeric) >= 0.01) then
    open_points := array_append(open_points, 'sales'); end if;
  if (snap->'temps'->>'logged')::int < (snap->'temps'->>'units')::int then open_points := array_append(open_points, 'temps'); end if;
  if (snap->'checklists'->>'done')::int < (snap->'checklists'->>'total')::int then open_points := array_append(open_points, 'checklists'); end if;
  if (snap->'leftovers'->>'counted')::int < (snap->'leftovers'->>'items')::int then open_points := array_append(open_points, 'leftovers'); end if;
  if (snap->'leftovers'->>'items')::int > 0 and snap->>'next_prep_list' <> 'sent' then open_points := array_append(open_points, 'prep_list'); end if;
  if jsonb_array_length(snap->'clocked_in') > 0 then open_points := array_append(open_points, 'clocked_in'); end if;
  if p_counted_cash is null or p_pos_cash is null or diff <> 0 then open_points := array_append(open_points, 'cash'); end if;
  foreach k in array open_points loop
    if length(trim(coalesce(p_reasons->>k, ''))) < 3 then raise exception 'Reason required for %', k using errcode = '22023'; end if;
  end loop;

  insert into public.day_closes (branch_id, work_date, pos_total, pos_cash, counted_cash, cash_difference, snapshot, reasons, note, closed_by)
  values (p_branch, p_date, p_pos_total, p_pos_cash, p_counted_cash, diff, snap || jsonb_build_object('open_points', to_jsonb(open_points)),
    (select coalesce(jsonb_object_agg(key, left(trim(value), 300)), '{}'::jsonb) from jsonb_each_text(p_reasons) where key = any(open_points)),
    nullif(trim(p_note), ''), auth.uid())
  returning id into new_id;
  -- daily_sales stays the single sales source for every dashboard. Fill a missing day from the close;
  -- never overwrite an existing figure (POS import or manager entry wins, a mismatch is kept as a reason above).
  if p_pos_total is not null then
    insert into public.daily_sales (branch_id, sale_date, amount) values (p_branch, p_date, round(p_pos_total, 2))
    on conflict (branch_id, sale_date) do nothing;
  end if;
  return new_id;
end $$;

revoke all on function private.day_close_snapshot(uuid, date), private.close_day(uuid, date, numeric, numeric, numeric, jsonb, text) from public, anon;
grant execute on function private.day_close_snapshot(uuid, date), private.close_day(uuid, date, numeric, numeric, numeric, jsonb, text) to authenticated;
create or replace function public.day_close_snapshot(p_branch uuid, p_date date) returns jsonb language sql stable security invoker set search_path = '' as $$ select private.day_close_snapshot(p_branch, p_date) $$;
create or replace function public.close_day(p_branch uuid, p_date date, p_pos_total numeric, p_pos_cash numeric, p_counted_cash numeric, p_reasons jsonb, p_note text default null)
returns uuid language sql security invoker set search_path = '' as $$ select private.close_day(p_branch, p_date, p_pos_total, p_pos_cash, p_counted_cash, p_reasons, p_note) $$;
revoke all on function public.day_close_snapshot(uuid, date), public.close_day(uuid, date, numeric, numeric, numeric, jsonb, text) from public, anon;
grant execute on function public.day_close_snapshot(uuid, date), public.close_day(uuid, date, numeric, numeric, numeric, jsonb, text) to authenticated;

notify pgrst, 'reload schema';
commit;
