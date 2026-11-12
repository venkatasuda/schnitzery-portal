-- Operational reminders, added to the existing hourly notification_sweep() (bell notifications, deduplicated
-- by public.notify). All times Europe/Berlin. A branch only gets reminders on days somebody clocked in.
--   13–15 h  opening temperature checks still missing      → shift leaders on duty + managers
--   from 21 h closing temperature checks / open checklist  → shift leaders on duty + managers
--   from 20 h tomorrow's prep list not sent                → shift leaders on duty + managers
--   18–20 h  "your shift tomorrow" (published roster)      → each rostered employee
--   08–11 h  yesterday not closed (day close)              → managers
-- Also: the sweep's schedule alerts now use the Friday/Saturday shift times (migration 20261111090000).
begin;

-- p_now exists so the hour windows can be tested; the sweep calls it without arguments.
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
      -- opening = a reading before 15:00, closing = from 15:00 (same rule as the Temperature log and day close)
      select units - count(distinct l.unit_id) into open_checks from public.temp_logs l join public.temp_units t on t.id = l.unit_id
        where l.branch_id = b.id and l.work_date = d and t.is_active
          and (extract(hour from l.recorded_at at time zone 'Europe/Berlin') >= 15) = (h >= 21);
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

-- Patch the existing sweep in place (same approach as 20261108150000): (1) Friday/Saturday shift times,
-- (2) call the reminders at the end. Idempotent: each replacement only applies once.
do $$
declare def text := pg_get_functiondef('public.notification_sweep()'::regprocedure); fixed text;
begin
  fixed := def;
  if position('fri_sat_start' in fixed) = 0 then
    fixed := replace(fixed, 'select start_time, end_time into v_start, v_end from public.shift_times',
      'select case when extract(isodow from v_date) in (5, 6) and fri_sat_start is not null then fri_sat_start else start_time end, '
      || 'case when extract(isodow from v_date) in (5, 6) and fri_sat_end is not null then fri_sat_end else end_time end into v_start, v_end from public.shift_times');
    if fixed = def then raise exception 'notification_sweep: shift-time lookup not found — review before applying'; end if;
  end if;
  if position('ops_reminders' in fixed) = 0 then
    fixed := regexp_replace(fixed, 'end;\s*\$function\$\s*$', E'  perform private.ops_reminders();\nend; $function$');
    if position('ops_reminders' in fixed) = 0 then raise exception 'notification_sweep: end of function not found — review before applying'; end if;
  end if;
  if fixed <> def then execute fixed; end if;
end $$;
revoke all on function public.notification_sweep() from public, anon, authenticated;
grant execute on function public.notification_sweep() to service_role;

commit;
