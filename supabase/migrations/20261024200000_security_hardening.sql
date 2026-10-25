-- Security hardening (docs/security/ATTACK-REVIEW-2026-10-24.md).
-- Every logged-in browser holds a Supabase session and the public anon key, so anything
-- RLS allows can be done with a direct REST call, whatever the app's buttons allow.
-- This migration closes the direct-call holes:
--   B1 nobody changes their own role/branch/contract/leave/status/lock/email
--   B2 nobody sets their own wage; managers only act on people below their rank
--   B3 nobody edits or approves their own shifts, corrections, leave or swaps
--      (brand owner / super admin excepted: nobody ranks above them)
--   C* staff lose write access to other people's records
--   D* internal SECURITY DEFINER helpers are no longer callable by anon / users
begin;
set local lock_timeout = '3s';

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

-- Rank helpers --------------------------------------------------------------
-- True when the caller may act on p_user: someone else, ranked strictly below the
-- caller (super_admin may act on anyone but themselves).
create or replace function public.outranks(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and p_user is distinct from auth.uid() and exists (
    select 1 from public.users u
    where u.id = p_user
      and (public.current_role() = 'super_admin'
           or public.role_rank(u.role) < public.role_rank(public.current_role())));
$$;
revoke all on function public.outranks(uuid) from public, anon;
grant execute on function public.outranks(uuid) to authenticated, service_role;

-- Top of the hierarchy: nobody above them to approve their own records.
create or replace function private.is_top() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('brand_owner', 'super_admin');
$$;
revoke all on function private.is_top() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_top() to authenticated, service_role;

-- B1 / B4: users ------------------------------------------------------------
create or replace function public.guard_users_sensitive_update() returns trigger
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid(); my_role text; my_rank int; sensitive boolean;
begin
  if me is null then return new; end if; -- backend (service role) is trusted
  select role into my_role from public.users where id = me;
  my_rank := public.role_rank(my_role);
  sensitive := new.role is distinct from old.role
    or new.branch_id is distinct from old.branch_id
    or new.contract_hours is distinct from old.contract_hours
    or new.annual_leave_days is distinct from old.annual_leave_days
    or new.employee_code is distinct from old.employee_code
    or new.login_locked is distinct from old.login_locked
    or new.status is distinct from old.status
    or new.email is distinct from old.email
    or new.must_change_password is distinct from old.must_change_password;

  if old.id = me then
    -- Own row: contact details, skills and avatar only. Clearing the
    -- "change your password" flag after changing it is the one allowed flag write.
    if sensitive and not (
      new.must_change_password = false and old.must_change_password = true
      and new.role is not distinct from old.role and new.branch_id is not distinct from old.branch_id
      and new.contract_hours is not distinct from old.contract_hours
      and new.annual_leave_days is not distinct from old.annual_leave_days
      and new.employee_code is not distinct from old.employee_code
      and new.login_locked is not distinct from old.login_locked
      and new.status is not distinct from old.status and new.email is not distinct from old.email)
    then
      raise exception 'You cannot change your own role, branch, contract, leave allowance, status, email or lock.';
    end if;
    return new;
  end if;

  -- Someone else's row: managers and above, and only for people ranked below them.
  if my_rank < 2 then raise exception 'Not permitted.'; end if;
  if my_role <> 'super_admin' and public.role_rank(old.role) >= my_rank then
    raise exception 'You can only change people ranked below you.';
  end if;
  if new.role is distinct from old.role then
    if new.role not in ('super_admin','brand_owner','branch_owner','manager','staff','kiosk') then
      raise exception 'Invalid role value: %', new.role;
    end if;
    if public.role_rank(new.role) > my_rank or (my_role <> 'super_admin' and new.role in ('brand_owner','super_admin')) then
      raise exception 'Cannot grant that role.';
    end if;
  end if;
  if new.branch_id is distinct from old.branch_id
     and not exists (select 1 from public.accessible_branch_ids() b where b = new.branch_id) then
    raise exception 'You can only move people into your own branches.';
  end if;
  return new;
end $$;
revoke all on function public.guard_users_sensitive_update() from public, anon, authenticated;

drop policy if exists "users_update" on public.users;
create policy "users_update" on public.users for update to authenticated
  using (id = auth.uid() or (public.is_manager() and branch_id in (select public.accessible_branch_ids())))
  with check (id = auth.uid() or (public.is_manager() and branch_id in (select public.accessible_branch_ids())));

-- B2: wages -----------------------------------------------------------------
drop policy if exists "user_pay_mgr" on public.user_pay;
create policy "user_pay_mgr_read" on public.user_pay for select to authenticated
  using (public.is_manager() and public.user_in_my_branches(user_id));
create policy "user_pay_mgr_write" on public.user_pay for all to authenticated
  using (public.is_manager() and public.user_in_my_branches(user_id) and public.outranks(user_id))
  with check (public.is_manager() and public.user_in_my_branches(user_id) and public.outranks(user_id));

-- set_wage_effective is service-role only, but takes the actor as an argument:
-- enforce the same "below you, never yourself" rule inside it.
create or replace function public.set_wage_effective(p_actor uuid,p_user uuid,p_wage numeric,p_date date) returns void
language plpgsql security invoker set search_path='' set lock_timeout='3s' as $$
declare target_branch uuid; current_rate public.wage_history%rowtype;
begin
  if not exists(select 1 from public.users where id=p_actor and role in ('manager','branch_owner','brand_owner','super_admin')) then raise exception 'Managers only'; end if;
  if p_user is null or p_user = p_actor then raise exception 'You cannot set your own wage'; end if;
  perform set_config('request.jwt.claim.sub',p_actor::text,true);
  if not public.outranks(p_user) then raise exception 'You can only set wages for people ranked below you'; end if;
  select branch_id into target_branch from public.users where id=p_user for update;
  if target_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b=target_branch) then raise exception 'Not in your branch'; end if;
  if p_date is null or not isfinite(p_date) or p_date<'2000-01-01' or p_date>(now() at time zone 'Europe/Berlin')::date
    or (p_wage is not null and not (p_wage>=0 and p_wage<1000)) then raise exception 'Invalid wage or effective date'; end if;
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

-- B3: no deciding about yourself --------------------------------------------
-- tg_argv[0] = column holding the employee the row is about.
-- Shifts: a direct REST write (current_user = authenticated) to your own shift is
-- refused; the clock-in/out functions run as their owner and are unaffected.
create or replace function private.guard_own_attendance() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or current_user <> 'authenticated' or private.is_top() then return new; end if;
  if (tg_op = 'DELETE' and old.user_id = auth.uid()) or (tg_op <> 'DELETE' and new.user_id = auth.uid())
     or (tg_op = 'UPDATE' and old.user_id = auth.uid()) then
    raise exception 'You cannot edit or approve your own shifts.';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end $$;
revoke all on function private.guard_own_attendance() from public, anon, authenticated;
drop trigger if exists guard_own_attendance on public.attendance_logs;
create trigger guard_own_attendance before insert or update or delete on public.attendance_logs
  for each row execute function private.guard_own_attendance();

-- Requests (corrections, leave, swaps): the person a request is about cannot move it
-- out of "pending" themselves — including via SECURITY DEFINER decision functions.
create or replace function private.guard_own_decision() returns trigger
language plpgsql security invoker set search_path = '' as $$
declare subject text := to_jsonb(new) ->> tg_argv[0];
begin
  if auth.uid() is null or private.is_top() then return new; end if;
  if subject = auth.uid()::text and new.status is distinct from old.status
     and new.status not in ('pending', 'cancelled') then
    raise exception 'You cannot decide your own request.';
  end if;
  return new;
end $$;
revoke all on function private.guard_own_decision() from public, anon, authenticated;
drop trigger if exists guard_own_decision on public.attendance_corrections;
create trigger guard_own_decision before update on public.attendance_corrections
  for each row execute function private.guard_own_decision('user_id');
drop trigger if exists guard_own_decision on public.leave_requests;
create trigger guard_own_decision before update on public.leave_requests
  for each row execute function private.guard_own_decision('user_id');
drop trigger if exists guard_own_decision on public.swap_requests;
create trigger guard_own_decision before update on public.swap_requests
  for each row execute function private.guard_own_decision('requester_id');

-- C1: swaps — staff create their own, managers decide.
drop policy if exists "swap_write" on public.swap_requests;
create policy "swap_insert_own" on public.swap_requests for insert to authenticated
  with check (requester_id = auth.uid() and status = 'pending' and branch_id in (select public.accessible_branch_ids()));
create policy "swap_manage" on public.swap_requests for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

-- C2: cover — requester cancels own, a colleague claims an open one, managers decide.
drop policy if exists "cover_update" on public.cover_requests;
create policy "cover_update" on public.cover_requests for update to authenticated
  using (branch_id in (select public.accessible_branch_ids())
         and (requester_id = auth.uid() or public.is_manager() or status = 'open'))
  with check (branch_id in (select public.accessible_branch_ids())
         and (public.is_manager()
              or (requester_id = auth.uid() and status = 'cancelled')
              or (requester_id <> auth.uid() and claimer_id = auth.uid() and status = 'claimed')));

-- C3: incidents — anyone reports, reporters see their own, managers see and handle all.
drop policy if exists "incident_select" on public.incidents;
drop policy if exists "incident_write" on public.incidents;
create policy "incident_select" on public.incidents for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and (reported_by = auth.uid() or public.is_manager()));
create policy "incident_insert" on public.incidents for insert to authenticated
  with check (branch_id in (select public.accessible_branch_ids()) and reported_by = auth.uid() and status = 'open');
create policy "incident_manage" on public.incidents for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

-- C4: audit log entries only from managers (the app writes them for manager actions).
drop policy if exists "audit_insert" on public.audit_logs;
create policy "audit_insert" on public.audit_logs for insert to authenticated
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

-- C5: checklists — managers create/delete; staff only tick (done/value/who/when, as themselves).
drop policy if exists "checklist_write" on public.checklists;
create policy "checklist_manage" on public.checklists for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
create policy "checklist_tick" on public.checklists for update to authenticated
  using (branch_id in (select public.accessible_branch_ids()))
  with check (branch_id in (select public.accessible_branch_ids()) and (completed_by is null or completed_by = auth.uid()));
create or replace function private.guard_checklist_tick() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null or public.is_manager() then return new; end if;
  if new.branch_id is distinct from old.branch_id or new.work_date is distinct from old.work_date
     or new.type is distinct from old.type or new.task is distinct from old.task
     or new.input_kind is distinct from old.input_kind then
    raise exception 'Only managers can change checklist tasks.';
  end if;
  return new;
end $$;
revoke all on function private.guard_checklist_tick() from public, anon, authenticated;
drop trigger if exists guard_checklist_tick on public.checklists;
create trigger guard_checklist_tick before update on public.checklists
  for each row execute function private.guard_checklist_tick();

-- C6 / C8 / temp units: manager-only writes.
drop policy if exists "cert_write" on public.certifications;
create policy "cert_write" on public.certifications for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
drop policy if exists "broadcast_write" on public.shift_broadcasts;
create policy "broadcast_write" on public.shift_broadcasts for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
drop policy if exists "temp_units_write" on public.temp_units;
create policy "temp_units_write" on public.temp_units for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));

-- C7: availability — your own, or a manager's.
drop policy if exists "avail_write" on public.availability;
create policy "avail_write" on public.availability for all to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and (user_id = auth.uid() or public.is_manager()))
  with check (branch_id in (select public.accessible_branch_ids()) and (user_id = auth.uid() or public.is_manager()));

-- D1 / D2: internal helpers are not public API.
create or replace function public.geo_checkpoint(p_log_id uuid, p_lat double precision, p_lng double precision) returns void
language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_branch uuid; v_gps text; v_blat double precision; v_blng double precision; v_rad int; v_dist double precision;
begin
  if p_lat is null or p_lng is null or p_log_id is null then return; end if;
  -- Only your own shift (or the backend) may record a location checkpoint.
  select branch_id into v_branch from public.attendance_logs
   where id = p_log_id and (auth.uid() is null or user_id = auth.uid());
  if v_branch is null then return; end if;
  select gps_mode into v_gps from public.branch_settings where branch_id = v_branch;
  if coalesce(v_gps, 'off') = 'off' then return; end if;
  select gps_lat, gps_lng, gps_radius_m into v_blat, v_blng, v_rad from public.branches where id = v_branch;
  if v_blat is null or v_blng is null then return; end if;
  v_dist := public.distance_m(p_lat, p_lng, v_blat, v_blng);
  update public.attendance_logs
    set geo_max_distance_m = greatest(coalesce(geo_max_distance_m, 0), v_dist),
        geo_flagged        = coalesce(geo_flagged, false) or (v_dist > coalesce(v_rad, 150))
  where id = p_log_id;
end; $$;
revoke all on function public.geo_checkpoint(uuid, double precision, double precision) from public, anon;
grant execute on function public.geo_checkpoint(uuid, double precision, double precision) to authenticated, service_role;
revoke all on function public.resolve_kiosk(uuid, uuid) from public, anon, authenticated;
grant execute on function public.resolve_kiosk(uuid, uuid) to service_role;
revoke all on function public.notification_sweep() from public, anon, authenticated;
grant execute on function public.notification_sweep() to service_role;
revoke all on function public.notify(uuid, uuid, text, text, text, interval) from public, anon, authenticated;
grant execute on function public.notify(uuid, uuid, text, text, text, interval) to service_role;

commit;
