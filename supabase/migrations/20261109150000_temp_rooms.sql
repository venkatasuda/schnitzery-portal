-- Temperature units per room (Preparation / Kitchen / Storage …) and two checks a day.
-- A reading before 15:00 (Berlin) is the opening check, from 15:00 the closing check. No new table.
-- The day close counts a unit as done only when both checks exist.
begin;

alter table public.temp_units add column if not exists room text check (room is null or length(room) <= 40);
alter table public.temp_units add column if not exists sort integer not null default 0;

create or replace function private.day_close_snapshot(p_branch uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare units int; logged int; total_tasks int; done_tasks int; items int; counted int; prep text; sales numeric; open_people jsonb;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Day close access required' using errcode = '42501'; end if;
  select count(*) into units from public.temp_units where branch_id = p_branch and is_active;
  -- Units with both an opening (before 15:00) and a closing (from 15:00) reading that day.
  select count(*) into logged from (
    select l.unit_id from public.temp_logs l join public.temp_units u on u.id = l.unit_id
    where l.branch_id = p_branch and l.work_date = p_date and u.is_active
    group by l.unit_id
    having bool_or(extract(hour from l.recorded_at at time zone 'Europe/Berlin') < 15)
       and bool_or(extract(hour from l.recorded_at at time zone 'Europe/Berlin') >= 15)) done;
  select count(*), count(*) filter (where done) into total_tasks, done_tasks from public.checklists where branch_id = p_branch and work_date = p_date;
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

notify pgrst, 'reload schema';
commit;
