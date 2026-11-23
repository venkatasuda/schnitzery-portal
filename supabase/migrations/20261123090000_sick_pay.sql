-- Sick pay (Entgeltfortzahlung, EFZG §§ 3–5), Venky 23 Nov 2026. Built to the law (no collective agreement known):
--   · users.start_date: employment start, for the 4-week waiting period (§ 3 Abs. 3). Null = first clock-in is used.
--   · leave_requests.eau_confirmed: the manager ticks that the electronic sick note (eAU) was retrieved.
--   · get_payroll_inputs: adds a "sick" block (approved sick leave, roster, shift times, covers, 12-month history, wages)
--     so payroll can pay the hours the person would have worked (§ 4 Abs. 1). Calculated in src/lib/pay/sickPay.ts.
-- Additive: two columns, one function replaced (same output plus "sick"). Run once in production before merging; safe to run twice.
begin;

alter table public.users add column if not exists start_date date;
comment on column public.users.start_date is 'First day of employment (EFZG waiting period). Null = first clock-in.';
alter table public.leave_requests add column if not exists eau_confirmed boolean not null default false;

-- Employees must not change their own contract dates (now also the start date).
create or replace function public.guard_users_team_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); my_role text;
begin
  if me is null or old.id <> me then return new; end if; -- backend, or someone else's row (the existing guard and policy apply)
  if new.contract_type is distinct from old.contract_type
     or new.contract_end is distinct from old.contract_end or new.probation_end is distinct from old.probation_end
     or new.start_date is distinct from old.start_date
    then raise exception 'You cannot change your own contract type.' using errcode = '42501'; end if;
  select role into my_role from public.users where id = me;
  if coalesce(my_role, 'staff') in ('staff', 'kiosk')
     and (new.team is distinct from old.team or private.team_skills(new.skills) is distinct from private.team_skills(old.skills))
    then raise exception 'Your team and team skills are set by your manager.' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.guard_users_team_fields() from public, anon, authenticated;

-- Manager ticks "eAU retrieved" on an approved sick leave of their branch. Nothing else on the request changes.
create or replace function public.set_eau_confirmed(p_id uuid, p_value boolean) returns void
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only' using errcode = '42501'; end if;
  update public.leave_requests set eau_confirmed = coalesce(p_value, false)
    where id = p_id and leave_type = 'sick' and branch_id in (select public.accessible_branch_ids());
  if not found then raise exception 'Not found or no access.' using errcode = '42501'; end if;
end $$;
revoke all on function public.set_eau_confirmed(uuid, boolean) from public, anon;
grant execute on function public.set_eau_confirmed(uuid, boolean) to authenticated;

-- Same as 20261021120000 plus "sick". The sick block is empty in months without sick days, so their revision only
-- depends on the same data as before.
create or replace function public.get_payroll_inputs(p_branch uuid, p_month text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare inputs jsonb; first_day date; last_day date; sick jsonb; sick_users uuid[];
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then raise exception 'Branch access denied'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_month,4)::integer < 2000 then raise exception 'Invalid month'; end if;
  first_day := (p_month || '-01')::date;
  last_day := (first_day + interval '1 month')::date - 1;

  select array_agg(distinct user_id) into sick_users from public.leave_requests
    where branch_id = p_branch and leave_type = 'sick' and status = 'approved' and from_date <= last_day and to_date >= first_day;
  if sick_users is null then
    sick := '{}'::jsonb;
  else
    sick := jsonb_build_object(
      -- Sick leave of these people from 12 months back (6-week count across months, repeat-illness flag).
      'leave', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'user_id', user_id, 'from', from_date, 'to', to_date,
          'eau', eau_confirmed, 'note', sick_note_url is not null) order by user_id, from_date, id)
        from public.leave_requests where branch_id = p_branch and leave_type = 'sick' and status = 'approved'
          and user_id = any(sick_users) and to_date >= first_day - 365 and from_date <= last_day), '[]'::jsonb),
      -- Name for people who were only sick this month (they are not in "staff", which lists who worked).
      'start', coalesce((select jsonb_agg(jsonb_build_object('user_id', u.id, 'start_date', u.start_date,
          'full_name', u.full_name, 'employee_code', u.employee_code, 'team', u.team,
          'first_work', (select min(a.work_date) from public.attendance_logs a where a.user_id = u.id and a.status = 'complete')) order by u.id)
        from public.users u where u.id = any(sick_users)), '[]'::jsonb),
      -- Published roster weeks touching the month, shift catalogue, and shifts handed to a colleague (cover).
      'roster', coalesce((select jsonb_agg(jsonb_build_object('week_start', week_start, 'data', roster_data) order by week_start)
        from public.weekly_roster where branch_id = p_branch and week_start between first_day - 6 and last_day), '[]'::jsonb),
      'times', coalesce((select jsonb_agg(jsonb_build_object('branch', branch_id, 'team', team, 'shift', shift,
          'start', left(start_time::text, 5), 'end', left(end_time::text, 5), 'friSatStart', left(fri_sat_start::text, 5),
          'friSatEnd', left(fri_sat_end::text, 5), 'breakMins', break_mins) order by branch_id nulls first, team, shift)
        from public.shift_times where is_active and (branch_id = p_branch or branch_id is null)), '[]'::jsonb),
      'covers', coalesce((select jsonb_agg(jsonb_build_object('user_id', requester_id, 'date', work_date, 'team', team, 'shift', shift) order by work_date, id)
        from public.cover_requests where branch_id = p_branch and status = 'approved' and requester_id = any(sick_users)
          and work_date between first_day and last_day), '[]'::jsonb),
      -- Completed shifts of the 13 months before the month end: 12-month average when there is no roster.
      'history', coalesce((select jsonb_agg(jsonb_build_object('user_id', user_id, 'work_date', work_date, 'clock_in', clock_in,
          'clock_out', clock_out, 'duration_mins', duration_mins, 'breaks', breaks) order by user_id, work_date, id)
        from public.attendance_logs where branch_id = p_branch and status = 'complete' and user_id = any(sick_users)
          and work_date >= first_day - interval '13 months' and work_date <= last_day), '[]'::jsonb),
      -- Wage in force on each sick day of the month.
      'wages', coalesce((select jsonb_agg(jsonb_build_object('user_id', d.user_id, 'work_date', d.day, 'hourly_wage', r.hourly_wage) order by d.user_id, d.day)
        from (select distinct l.user_id, g.day::date as day from public.leave_requests l
                cross join lateral generate_series(greatest(l.from_date, first_day), least(l.to_date, last_day), interval '1 day') g(day)
              where l.branch_id = p_branch and l.leave_type = 'sick' and l.status = 'approved' and l.from_date <= last_day and l.to_date >= first_day) d
        left join lateral (select hourly_wage from public.wage_history h where h.user_id = d.user_id and h.branch_id = p_branch
          and h.effective_from <= d.day order by h.effective_from desc, h.id desc limit 1) r on true), '[]'::jsonb));
  end if;

  select jsonb_build_object(
    'logs', coalesce((select jsonb_agg(to_jsonb(l) order by l.id) from
      (select id, user_id, work_date, clock_in, clock_out, duration_mins, breaks, status, approval_status
       from public.attendance_logs where branch_id = p_branch and status = 'complete'
       and work_date >= first_day and work_date < first_day + interval '1 month') l), '[]'::jsonb),
    'staff', coalesce((select jsonb_agg(to_jsonb(u) order by u.id) from
      public.branch_worker_identities(p_branch, first_day, (first_day + interval '1 month')::date) u), '[]'::jsonb),
    'wages', coalesce((select jsonb_agg(to_jsonb(w) order by w.user_id,w.work_date) from
      (select d.user_id,d.work_date,r.hourly_wage,r.effective_from,r.id as rate_id from
       (select distinct user_id,work_date from public.attendance_logs where branch_id=p_branch and status='complete'
         and work_date>=first_day and work_date<first_day+interval '1 month') d
       left join lateral (select id,hourly_wage,effective_from from public.wage_history h where h.user_id=d.user_id
         and h.branch_id=p_branch and h.effective_from<=d.work_date order by h.effective_from desc,h.id desc limit 1) r on true) w), '[]'::jsonb),
    'wageBasis', 'effective-dated',
    'settings', coalesce((select jsonb_build_object('otDailyHours', ot_daily_hours, 'nightStart', left(night_start::text,5), 'nightEnd', left(night_end::text,5))
      from public.payroll_settings where branch_id = p_branch), '{"otDailyHours":8,"nightStart":"22:00","nightEnd":"06:00"}'::jsonb)
  ) into inputs;
  -- Only add the key when there is sick leave, so months without it keep their old revision.
  if sick <> '{}'::jsonb then inputs := inputs || jsonb_build_object('sick', sick); end if;
  return jsonb_build_object('source', inputs, 'revision', md5(inputs::text));
end $$;

notify pgrst, 'reload schema';
commit;
