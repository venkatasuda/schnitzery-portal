-- Approved figures and their source inputs are append-only. Legacy approvals
-- retain their metadata; historical wages cannot be reconstructed safely.
create table public.payroll_approvals (
  id uuid primary key default gen_random_uuid(),
  branch_id uuid not null references public.branches(id),
  month text not null,
  snapshot jsonb not null,
  source jsonb not null,
  approved_by uuid not null references public.users(id),
  approved_name text not null,
  approved_at timestamptz not null default now(),
  note text,
  check (month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$')
);
alter table public.payroll_approvals enable row level security;
create policy payroll_approvals_read on public.payroll_approvals for select to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
revoke all on public.payroll_approvals from public, anon, authenticated;
grant select on public.payroll_approvals to authenticated;
grant all on public.payroll_approvals to service_role;
revoke truncate on public.payroll_approvals from service_role;
create function public.keep_payroll_approval() returns trigger language plpgsql set search_path = '' as $$
begin raise exception 'Payroll approvals are immutable'; end $$;
revoke all on function public.keep_payroll_approval() from public, anon, authenticated;
create trigger payroll_approval_immutable before update or delete on public.payroll_approvals
  for each row execute function public.keep_payroll_approval();
alter table public.payroll_runs add column approval_id uuid references public.payroll_approvals(id);
-- Final approval is available only through the checked transaction below.
revoke insert, update, delete, truncate on public.payroll_runs from public, anon, authenticated;

create function public.get_payroll_inputs(p_branch uuid, p_month text) returns jsonb
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
    'wages', coalesce((select jsonb_agg(to_jsonb(w) order by w.user_id) from
      (select user_id, hourly_wage from public.user_pay w where branch_id = p_branch
       and exists(select 1 from public.attendance_logs l where l.user_id=w.user_id and l.branch_id=p_branch and l.status='complete'
         and l.work_date>=first_day and l.work_date<first_day+interval '1 month')) w), '[]'::jsonb),
    'settings', coalesce((select jsonb_build_object('otDailyHours', ot_daily_hours, 'nightStart', left(night_start::text,5), 'nightEnd', left(night_end::text,5))
      from public.payroll_settings where branch_id = p_branch), '{"otDailyHours":8,"nightStart":"22:00","nightEnd":"06:00"}'::jsonb)
  ) into inputs;
  return jsonb_build_object('source', inputs, 'revision', md5(inputs::text));
end $$;
revoke all on function public.get_payroll_inputs(uuid,text) from public, anon;
grant execute on function public.get_payroll_inputs(uuid,text) to authenticated, service_role;

-- Only the authenticated server action can supply calculated figures. Browser
-- clients cannot inject a different gross amount through the Data API.
create function public.set_payroll_approval_atomic(p_actor uuid, p_branch uuid, p_month text, p_approve boolean, p_revision text, p_snapshot jsonb, p_note text)
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
    lock table public.attendance_logs, public.users, public.user_pay, public.payroll_settings in share mode;
    inputs := public.get_payroll_inputs(p_branch, p_month);
    source_data := inputs -> 'source';
    if p_revision is distinct from inputs ->> 'revision' then raise exception 'Payroll changed; reload and review before approval'; end if;
    if jsonb_array_length(source_data -> 'logs') = 0 then raise exception 'No completed shifts'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'approval_status' is distinct from 'approved') then raise exception 'Every completed shift must be approved first'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where l ->> 'clock_in' is null or l ->> 'clock_out' is null
      or (l ->> 'clock_out')::timestamptz <= (l ->> 'clock_in')::timestamptz) then raise exception 'Invalid completed attendance'; end if;
    if exists(select 1 from jsonb_array_elements(source_data -> 'logs') l where
      not exists(select 1 from jsonb_array_elements(source_data -> 'staff') u where u ->> 'id' = l ->> 'user_id') or
      not exists(select 1 from jsonb_array_elements(source_data -> 'wages') w where w ->> 'user_id' = l ->> 'user_id'
        and (w ->> 'hourly_wage')::numeric >= 0 and (w ->> 'hourly_wage')::numeric < 'Infinity'::numeric)) then raise exception 'Every worked employee needs a valid wage and branch assignment'; end if;
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
