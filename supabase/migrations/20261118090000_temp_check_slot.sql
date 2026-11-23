-- Temperature log: the employee picks Opening or Closing (Venky, 18 Nov 2026). Until now the check was derived
-- from the time (before 15:00 = opening), so an opening check done late counted as closing.
-- New column temp_logs.slot; existing rows get the old time rule; inserts without a slot (older app) still get it.
-- Day close and the hourly reminders now read the slot. Run once in production before merging; safe to run twice.
begin;

alter table public.temp_logs add column if not exists slot text check (slot in ('opening', 'closing'));
update public.temp_logs set slot = case when extract(hour from recorded_at at time zone 'Europe/Berlin') >= 15 then 'closing' else 'opening' end
  where slot is null;

create or replace function private.temp_log_slot() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.slot is null then
    new.slot := case when extract(hour from coalesce(new.recorded_at, now()) at time zone 'Europe/Berlin') >= 15 then 'closing' else 'opening' end;
  end if;
  return new;
end $$;
drop trigger if exists temp_log_slot on public.temp_logs;
create trigger temp_log_slot before insert on public.temp_logs for each row execute function private.temp_log_slot();
alter table public.temp_logs alter column slot set not null;

create or replace function private.day_close_snapshot(p_branch uuid, p_date date) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare units int; logged int; total_tasks int; done_tasks int; items int; counted int; prep text; sales numeric; open_people jsonb;
begin
  if not private.can_plan_prep(p_branch) then raise exception 'Day close access required' using errcode = '42501'; end if;
  select count(*) into units from public.temp_units where branch_id = p_branch and is_active;
  -- Units with both an opening and a closing reading that day.
  select count(*) into logged from (
    select l.unit_id from public.temp_logs l join public.temp_units u on u.id = l.unit_id
    where l.branch_id = p_branch and l.work_date = p_date and u.is_active
    group by l.unit_id
    having bool_or(l.slot = 'opening')
       and bool_or(l.slot = 'closing')) done;
  select count(*), count(*) filter (where done) into total_tasks, done_tasks from public.checklists where branch_id = p_branch and work_date = p_date;
  -- Plus every required template for this weekday that has no task row yet (list not opened = still open).
  total_tasks := total_tasks + (select count(*) from public.checklist_templates t
    where t.branch_id = p_branch and t.is_active and extract(isodow from p_date)::smallint = any(t.weekdays)
      and not exists (select 1 from public.checklists c where c.branch_id = p_branch and c.work_date = p_date and c.template_id = t.id));
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

create or replace function private.ops_reminders(p_now timestamptz default now()) returns void
language plpgsql security definer set search_path = '' as $$
declare
  b record; u record; e record;
  d date := (p_now at time zone 'Europe/Berlin')::date;
  h int := extract(hour from p_now at time zone 'Europe/Berlin')::int;
  days text[] := array['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
  units int; open_checks int; open_tasks int; n int; st time; tm text; r jsonb; tomorrow date := d + 1;
begin
  for b in select id from public.branches loop
    -- ── "Your shift tomorrow" (only the published roster) ──
    if h between 18 and 19 then
      select roster_data into r from public.weekly_roster where branch_id = b.id
        and week_start = tomorrow - (extract(isodow from tomorrow)::int - 1);
      for e in select x ->> 'user_id' as uid, x ->> 'team' as team, x ->> 'shift' as shift
               from jsonb_array_elements(coalesce(r -> days[extract(isodow from tomorrow)::int], '[]'::jsonb)) x loop
        continue when e.uid is null;
        select case when extract(isodow from tomorrow) in (5, 6) and s.fri_sat_start is not null then s.fri_sat_start else s.start_time end into st
          from public.shift_times s where s.team = e.team and s.shift = e.shift and s.is_active and (s.branch_id = b.id or s.branch_id is null)
          order by (s.branch_id is null) limit 1;
        tm := case when st is not null then ' ' || to_char(st, 'HH24:MI') else '' end;
        perform public.notify(e.uid::uuid, b.id, 'upcoming_shift', tomorrow::text || ':eve:' || e.shift,
          'Tomorrow: ' || case when e.team = 'Preparation' then 'Preparation' when e.shift = 'Night' then 'Evening' else e.shift end || tm, interval '20 hours');
      end loop;
    end if;

    -- ── Yesterday not closed → managers (morning) ──
    if h between 8 and 10 and exists (select 1 from public.attendance_logs where branch_id = b.id and work_date = d - 1)
       and not exists (select 1 from public.day_closes where branch_id = b.id and work_date = d - 1) then
      for u in select id from public.users where branch_id = b.id and role = 'manager' and status = 'active' loop
        perform public.notify(u.id, b.id, 'day_close_reminder', (d - 1)::text, 'Yesterday has not been closed yet.', interval '20 hours');
      end loop;
    end if;

    -- The rest only on days the branch is working.
    continue when not exists (select 1 from public.attendance_logs where branch_id = b.id and work_date = d);

    select count(*) into units from public.temp_units where branch_id = b.id and is_active;
    open_checks := 0;
    if units > 0 and (h between 13 and 14 or h >= 21) then
      -- opening / closing = the check the employee picked (temp_logs.slot)
      select units - count(distinct l.unit_id) into open_checks from public.temp_logs l join public.temp_units t on t.id = l.unit_id
        where l.branch_id = b.id and l.work_date = d and t.is_active
          and (l.slot = 'closing') = (h >= 21);
    end if;
    open_tasks := 0;
    if h >= 21 then
      select count(*) filter (where not done) into open_tasks from public.checklists where branch_id = b.id and work_date = d;
      open_tasks := open_tasks + (select count(*) from public.checklist_templates t
        where t.branch_id = b.id and t.is_active and extract(isodow from d)::smallint = any(t.weekdays)
          and not exists (select 1 from public.checklists c where c.branch_id = b.id and c.work_date = d and c.template_id = t.id));
    end if;
    n := 0;
    if h >= 20 and exists (select 1 from public.prep_items where branch_id = b.id and is_active)
       and not exists (select 1 from public.prep_lists where branch_id = b.id and plan_date = tomorrow and status = 'sent') then n := 1; end if;
    continue when open_checks <= 0 and open_tasks <= 0 and n = 0;

    -- Shift leaders who clocked in today + the branch's managers.
    for u in select usr.id from public.users usr where usr.branch_id = b.id and usr.status = 'active' and (usr.role = 'manager'
               or (exists (select 1 from public.shift_leaders sl where sl.branch_id = b.id and sl.user_id = usr.id)
                   and exists (select 1 from public.attendance_logs a where a.branch_id = b.id and a.user_id = usr.id and a.work_date = d))) loop
      if open_checks > 0 then
        perform public.notify(u.id, b.id, 'temp_reminder', d::text || case when h >= 21 then ':close' else ':open' end,
          open_checks || ' of ' || units || case when h >= 21 then ' closing' else ' opening' end || ' temperature checks missing', interval '12 hours');
      end if;
      if open_tasks > 0 then
        perform public.notify(u.id, b.id, 'checklist_reminder', d::text, open_tasks || ' checklist tasks still open', interval '12 hours');
      end if;
      if n = 1 then
        perform public.notify(u.id, b.id, 'prep_reminder', tomorrow::text, 'Tomorrow''s prep list has not been sent yet.', interval '12 hours');
      end if;
    end loop;
  end loop;
end $$;
revoke all on function private.ops_reminders(timestamptz) from public, anon, authenticated;

notify pgrst, 'reload schema';
commit;
