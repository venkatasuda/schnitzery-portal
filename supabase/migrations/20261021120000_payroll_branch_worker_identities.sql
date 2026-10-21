-- Release E: payroll identity for employees who later changed branch.
-- Shifts (attendance_logs.branch_id) are the source of truth for who worked at a
-- branch. Payroll staff and approval-queue names previously came from the
-- employee's CURRENT branch, so a moved employee became "Unassigned employee"
-- and blocked the old branch's approval forever. See docs/PAYROLL-BRANCH-HISTORY.md.
begin;
set local lock_timeout = '5s';

-- Minimal, bounded identity read: only people with completed shifts at a branch
-- the caller manages, inside a window of at most 62 days, four columns only.
create function public.branch_worker_identities(p_branch uuid, p_from date, p_to date)
returns table(id uuid, full_name text, employee_code text, team text)
language plpgsql stable security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then
    raise exception 'Branch access denied';
  end if;
  if p_from is null or p_to is null or p_to <= p_from or p_to - p_from > 62 then raise exception 'Invalid period'; end if;
  return query
    select u.id, u.full_name::text, u.employee_code::text, u.team::text
    from public.users u
    where exists(select 1 from public.attendance_logs l
                 where l.user_id = u.id and l.branch_id = p_branch and l.status = 'complete'
                   and l.work_date >= p_from and l.work_date < p_to)
    order by u.id;
end $$;
revoke all on function public.branch_worker_identities(uuid, date, date) from public, anon;
grant execute on function public.branch_worker_identities(uuid, date, date) to authenticated, service_role;

-- Same signature, return type and checks as 20261013144029; only 'staff' changes.
create or replace function public.get_payroll_inputs(p_branch uuid, p_month text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare inputs jsonb; first_day date;
begin
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then raise exception 'Branch access denied'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_month,4)::integer < 2000 then raise exception 'Invalid month'; end if;
  first_day := (p_month || '-01')::date;
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
  return jsonb_build_object('source', inputs, 'revision', md5(inputs::text));
end $$;

commit;
