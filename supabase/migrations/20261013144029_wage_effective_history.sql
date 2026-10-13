-- Existing wage start dates are unknown: preserve a baseline without inventing one.
alter table public.user_pay add column effective_from date;
create table public.wage_history (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users(id),
  branch_id uuid not null references public.branches(id),
  hourly_wage numeric check (hourly_wage is null or (hourly_wage>=0 and hourly_wage<'Infinity'::numeric)),
  effective_from date check (effective_from is null or (isfinite(effective_from) and effective_from>='2000-01-01')),
  recorded_at timestamptz not null default clock_timestamp(),
  recorded_by uuid references public.users(id)
);
create index wage_history_lookup on public.wage_history(user_id,branch_id,effective_from desc,id desc);
alter table public.wage_history enable row level security;
create policy wage_history_read on public.wage_history for select to authenticated
  using (user_id=(select auth.uid()) or (public.is_manager() and branch_id in (select public.accessible_branch_ids())));
revoke all on public.wage_history from public,anon,authenticated,service_role;
grant select on public.wage_history to authenticated;
-- UPDATE is needed for payroll's SHARE lock; the trigger forbids actual edits.
grant select,insert,update on public.wage_history to service_role;
grant usage on sequence public.wage_history_id_seq to service_role;
insert into public.wage_history(user_id,branch_id,hourly_wage)
  select user_id,branch_id,hourly_wage from public.user_pay where branch_id is not null
    and (hourly_wage is null or (hourly_wage>=0 and hourly_wage<'Infinity'::numeric));
create function public.guard_wage_history() returns trigger language plpgsql security invoker set search_path='' as $$
begin raise exception 'Wage history is immutable; append a corrected effective-dated rate'; end $$;
revoke all on function public.guard_wage_history() from public,anon,authenticated;
create trigger wage_history_immutable before update or delete on public.wage_history
  for each row execute function public.guard_wage_history();
-- All browser writes route through the authenticated server action and service-only RPC.
revoke insert,update,delete,truncate on public.user_pay from public,anon,authenticated;
grant select,insert,update on public.user_pay to service_role;
create function public.set_wage_effective(p_actor uuid,p_user uuid,p_wage numeric,p_date date) returns void
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare actor_branch uuid; target_branch uuid; current_rate public.wage_history%rowtype;
begin
  select branch_id into actor_branch from public.users where id=p_actor and role in ('manager','branch_owner','brand_owner','super_admin');
  if actor_branch is null then raise exception 'Managers only'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  -- Lock an existing employee row, including the first wage entry, to serialize edits.
  select branch_id into target_branch from public.users where id=p_user for update;
  if target_branch is null or target_branch<>actor_branch then raise exception 'Not in your branch'; end if;
  if p_date is null or not isfinite(p_date) or p_date<'2000-01-01' or p_date>(now() at time zone 'Europe/Berlin')::date
    or (p_wage is not null and not (p_wage>=0 and p_wage<'Infinity'::numeric)) then raise exception 'Invalid wage or effective date'; end if;
  insert into public.wage_history(user_id,branch_id,hourly_wage,effective_from,recorded_by)
    values(p_user,target_branch,p_wage,p_date,p_actor);
  select * into current_rate from public.wage_history where user_id=p_user and branch_id=target_branch
    and effective_from is not null order by effective_from desc,id desc limit 1;
  insert into public.user_pay(user_id,branch_id,hourly_wage,effective_from,updated_by,updated_at)
    values(p_user,target_branch,current_rate.hourly_wage,current_rate.effective_from,p_actor,now())
    on conflict(user_id) do update set branch_id=excluded.branch_id,hourly_wage=excluded.hourly_wage,
      effective_from=excluded.effective_from,updated_by=excluded.updated_by,updated_at=excluded.updated_at;
end $$;
revoke all on function public.set_wage_effective(uuid,uuid,numeric,date) from public,anon,authenticated;
grant execute on function public.set_wage_effective(uuid,uuid,numeric,date) to service_role;

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
      (select id, employee_code, full_name, team from public.users u where branch_id = p_branch
       and exists(select 1 from public.attendance_logs l where l.user_id=u.id and l.branch_id=p_branch and l.status='complete'
         and l.work_date>=first_day and l.work_date<first_day+interval '1 month')) u), '[]'::jsonb),
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
revoke all on function public.get_payroll_inputs(uuid,text) from public, anon;
grant execute on function public.get_payroll_inputs(uuid,text) to authenticated, service_role;

-- Only the authenticated server action can supply calculated figures. Browser
-- clients cannot inject a different gross amount through the Data API.
create or replace function public.set_payroll_approval_atomic(p_actor uuid, p_branch uuid, p_month text, p_approve boolean, p_revision text, p_snapshot jsonb, p_note text)
returns void language plpgsql security invoker set search_path = '' set lock_timeout = '3s' as $$
declare inputs jsonb; source_data jsonb; approval uuid; caller_name text; run public.payroll_runs%rowtype;
begin
  if not exists(select 1 from public.users where id=p_actor and branch_id=p_branch and role in ('manager','branch_owner','brand_owner','super_admin')) then raise exception 'Manager branch access denied'; end if;
  -- Request-scoped identity for the existing authorization helpers; callable
  -- only with the server's service-role key, never an employee's JWT.
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  if auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then raise exception 'Branch access denied'; end if;
  if p_approve is null or length(coalesce(p_note,'')) > 2000 then raise exception 'Invalid approval request'; end if;
  if p_month is null or p_month !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or left(p_month,4)::integer < 2000 then raise exception 'Invalid month'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_branch::text || ':payroll:' || p_month, 0));
  select * into run from public.payroll_runs where branch_id = p_branch and month = p_month for update;
  if p_approve then
    if run.status = 'approved' then raise exception 'Already approved; reload payroll'; end if;
    if p_month >= to_char(now() at time zone 'Europe/Berlin','YYYY-MM') then raise exception 'Close the month before final approval'; end if;
    -- ponytail: brief table locks prevent phantom shifts and wage changes during
    -- approval; replace with branch-scoped revision triggers if contention grows.
    lock table public.attendance_logs, public.users, public.user_pay, public.wage_history, public.payroll_settings in share mode;
    inputs := public.get_payroll_inputs(p_branch, p_month);
    source_data := inputs -> 'source';
    if p_revision is distinct from inputs ->> 'revision' then raise exception 'Payroll changed; reload and review before approval'; end if;
    if jsonb_array_length(source_data -> 'logs') = 0 then raise exception 'No completed shifts'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'approval_status' is distinct from 'approved') then raise exception 'Every completed shift must be approved first'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'clock_in' is null or l ->> 'clock_out' is null
      or (l ->> 'clock_out')::timestamptz <= (l ->> 'clock_in')::timestamptz) then raise exception 'Invalid completed attendance'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where
      not exists(select 1 from jsonb_array_elements(source_data -> 'staff') u where u ->> 'id' = l ->> 'user_id') or
      not exists(select 1 from jsonb_array_elements(source_data -> 'wages') w where w ->> 'user_id' = l ->> 'user_id' and w ->> 'work_date' = l ->> 'work_date'
        and (w ->> 'hourly_wage')::numeric >= 0 and (w ->> 'hourly_wage')::numeric < 'Infinity'::numeric)) then raise exception 'Every worked employee needs a valid wage and branch assignment'; end if;
    if p_snapshot ->> 'wageBasis' is distinct from 'effective-dated' then raise exception 'Reload the updated payroll before approval'; end if;
    if p_snapshot is null or p_snapshot ->> 'month' is distinct from p_month or
       p_snapshot ->> 'revision' is distinct from p_revision or
       jsonb_typeof(p_snapshot -> 'rows') is distinct from 'array' or
       jsonb_typeof(p_snapshot -> 'totals') is distinct from 'object' or
       p_snapshot -> 'settings' is distinct from source_data -> 'settings' then raise exception 'Invalid payroll snapshot'; end if;
    select coalesce(full_name,'Manager') into caller_name from public.users where id = auth.uid();
    insert into public.payroll_approvals(branch_id,month,snapshot,source,approved_by,approved_name,note)
      values(p_branch,p_month,p_snapshot,source_data,auth.uid(),caller_name,p_note) returning id into approval;
    insert into public.payroll_runs(branch_id,month,status,approved_by,approved_at,note,approval_id)
      values(p_branch,p_month,'approved',caller_name,now(),p_note,approval)
      on conflict(branch_id,month) do update set status='approved',approved_by=excluded.approved_by,
        approved_at=excluded.approved_at,note=excluded.note,approval_id=excluded.approval_id;
  else
    if run.status is distinct from 'approved' then raise exception 'Payroll is no longer approved; reload'; end if;
    if run.approval_id is not null and p_revision is distinct from
      (select snapshot ->> 'revision' from public.payroll_approvals where id=run.approval_id)
      then raise exception 'Approval changed; reload before reopening'; end if;
    -- Retain the old approval in the immutable archive when reopening.
    update public.payroll_runs set status='draft',approved_by=null,approved_at=null,note=p_note,approval_id=null
      where branch_id=p_branch and month=p_month;
  end if;
end $$;
revoke all on function public.set_payroll_approval_atomic(uuid,uuid,text,boolean,text,jsonb,text) from public, anon, authenticated;
grant execute on function public.set_payroll_approval_atomic(uuid,uuid,text,boolean,text,jsonb,text) to service_role;
