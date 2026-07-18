-- ============================================================================
-- Schnitzery — audit fixes, PART 1 of 2: THE SAFE ONES
-- 2026-07-18 · audit items 14, 16, 19
--
-- Everything in this file fixes a bug WITHOUT changing what the app accepts.
-- Nothing that used to work stops working. It is backward-compatible with the
-- currently-deployed application code, so it can be applied before the code
-- changes ship.
--
-- Verified before writing this:
--   • updateStaff()        (people.ts:82)        is manager-gated
--   • setLeaveAllowance()  (leave-balance.ts:105) is manager-gated
--   ...so the tightened trigger in PART 3 below breaks neither.
--
-- APPLY: Supabase dashboard → SQL Editor → paste → Run. Take a backup first.
-- ============================================================================


-- ── PART 1 · item 14 · current_clock_code() role list is broken ─────────────
-- Checked for 'franchise_owner' (not a role this system has) while OMITTING
-- 'branch_owner' and 'super_admin' (both real). Today a branch owner cannot
-- display the clock code. Now uses is_manager() so the list cannot drift again.

CREATE OR REPLACE FUNCTION public.current_clock_code()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid    uuid := auth.uid();
  v_role   text;
  v_branch uuid;
  v_now    bigint;
  v_code   text;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;

  select role, branch_id into v_role, v_branch from public.users where id = v_uid;
  if v_branch is null then raise exception 'No branch assigned.'; end if;

  if not (public.is_manager() or v_role = 'kiosk') then
    raise exception 'Not permitted.';
  end if;

  v_now  := floor(extract(epoch from now()))::bigint;
  v_code := public.clock_code_for(v_branch, v_now / 30);

  return jsonb_build_object(
    'ok', true,
    'code', v_code,
    'rotateSeconds', 30,
    'secondsLeft', 30 - (v_now % 30)::int,
    'qrPayload', 'SCHNITZERY-CLOCK:' || v_branch::text || ':' || v_code
  );
end;
$function$;


-- ── PART 2 · item 16 · offline work_date used UTC instead of Europe/Berlin ──
-- THE PAYROLL BUG. clock_in() files against Europe/Berlin; this function filed
-- against UTC. In summer (CEST = UTC+2) an offline clock-out at 00:30 Berlin is
-- 22:30 UTC the PREVIOUS day, so closing shifts landed on the wrong work_date
-- and fed wrong monthly totals.
--
-- This replacement changes ONE LINE (marked below) versus what is in production.
-- No new rejections, no behaviour change — only the date arithmetic is corrected.

CREATE OR REPLACE FUNCTION public.sync_attendance_events(p_events jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'pg_temp'
AS $function$
declare
  v_uid uuid := auth.uid();
  v_branch uuid; v_qr boolean;
  e jsonb;
  v_uuid uuid; v_action text; v_at timestamptz; v_code text; v_device text;
  v_wd date; v_valid boolean; v_logid uuid; v_err text; v_status text; v_last int;
  v_session public.attendance_logs%rowtype;
  v_results jsonb := '[]'::jsonb;
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  select branch_id into v_branch from public.users where id = v_uid;
  select qr_required into v_qr from public.branch_settings where branch_id = v_branch;

  for e in select value from jsonb_array_elements(p_events) loop
    v_uuid   := (e->>'event_uuid')::uuid;
    v_action := e->>'action';
    v_at     := (e->>'captured_at')::timestamptz;
    v_code   := e->>'code';
    v_device := e->>'device_id';
    v_err := null; v_logid := null; v_status := 'applied';

    -- 1) idempotent dedupe
    if exists (select 1 from public.attendance_events where event_uuid = v_uuid) then
      v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', 'duplicate');
      continue;
    end if;

    -- 2) retro code validation (recorded for audit; NOT yet enforced — see 02_)
    v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;

    -- >>> THE ONLY CHANGED LINE <<<  was: (v_at at time zone 'utc')::date
    v_wd := (v_at at time zone 'Europe/Berlin')::date;

    -- 3) apply to the session table (conflict-safe)
    begin
      if v_action = 'clock_in' then
        if exists (select 1 from public.attendance_logs where user_id = v_uid and work_date = v_wd and status in ('active','on-break')) then
          v_err := 'already_clocked_in';
        else
          insert into public.attendance_logs (user_id, branch_id, work_date, clock_in, status, approval_status, breaks, source, device_id)
          values (v_uid, v_branch, v_wd, v_at, 'active', 'pending', '[]'::jsonb, 'offline', v_device)
          returning id into v_logid;
        end if;

      elsif v_action = 'clock_out' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status not in ('active','on-break') then
          v_err := 'no_open_session';
        else
          update public.attendance_logs
            set clock_out = v_at, status = 'complete', approval_status = 'pending',
                duration_mins = greatest(0, round(extract(epoch from (v_at - clock_in)) / 60.0)),
                source = 'offline', device_id = coalesce(device_id, v_device)
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_start' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'active' then
          v_err := 'no_active_session';
        else
          update public.attendance_logs
            set status = 'on-break',
                breaks = coalesce(breaks, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('start', v_at))
            where id = v_session.id;
          v_logid := v_session.id;
        end if;

      elsif v_action = 'break_end' then
        select * into v_session from public.attendance_logs
          where user_id = v_uid and work_date = v_wd order by created_at desc limit 1;
        if v_session.id is null or v_session.status <> 'on-break' then
          v_err := 'no_open_break';
        else
          v_last := jsonb_array_length(coalesce(v_session.breaks, '[]'::jsonb)) - 1;
          update public.attendance_logs
            set status = 'active',
                breaks = jsonb_set(coalesce(breaks, '[]'::jsonb), array[v_last::text, 'end'], to_jsonb(v_at))
            where id = v_session.id and v_last >= 0;
          v_logid := v_session.id;
        end if;

      else
        v_err := 'unknown_action';
      end if;
    exception when others then
      v_err := 'apply_error: ' || sqlerrm;
    end;

    -- 4) record the event no matter what (audit; never lost)
    insert into public.attendance_events
      (event_uuid, user_id, branch_id, device_id, action, captured_at, source, code, code_valid, sync_status, attendance_log_id, error)
    values
      (v_uuid, v_uid, v_branch, v_device, v_action, v_at, 'offline', v_code, v_valid, 'synced', v_logid, v_err);

    if v_err is not null then v_status := 'recorded_with_error'; end if;
    v_results := v_results || jsonb_build_object('event_uuid', v_uuid, 'status', v_status, 'error', v_err);
  end loop;

  return jsonb_build_object('ok', true, 'results', v_results);
end;
$function$;


-- ── PART 3 · item 19 · staff could edit their own hours and leave allowance ─
-- guard_users_sensitive_update() protected role, branch_id and hourly_wage but
-- NOT contract_hours or annual_leave_days — and users_update permits
-- id = auth.uid(). Both feed payroll and leave-balance maths.
--
-- must_change_password is deliberately NOT guarded: ChangePasswordForm.tsx:44
-- clears it as the user themselves, so guarding it would break the forced
-- password change. Self-clearing only skips a prompt on an account they already
-- control.

CREATE OR REPLACE FUNCTION public.guard_users_sensitive_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  caller_role text;
  caller_rank int;
  new_rank    int;
begin
  if (new.role              is distinct from old.role)
  or (new.branch_id         is distinct from old.branch_id)
  or (new.hourly_wage       is distinct from old.hourly_wage)
  or (new.contract_hours    is distinct from old.contract_hours)
  or (new.annual_leave_days is distinct from old.annual_leave_days)
  or (new.employee_code     is distinct from old.employee_code) then

    -- Backend / service-role / SQL editor has no JWT → trusted, allow.
    if auth.uid() is null then
      return new;
    end if;

    select role into caller_role from public.users where id = auth.uid();
    caller_rank := public.role_rank(caller_role);

    -- Manager and above (rank >= 2) may change these; staff/kiosk may not.
    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, wage, contract hours or leave allowance';
    end if;

    if new.role is distinct from old.role then
      if new.role not in ('super_admin','brand_owner','branch_owner','manager','staff','kiosk') then
        raise exception 'Invalid role value: %', new.role;
      end if;
      new_rank := public.role_rank(new.role);
      if new_rank > caller_rank then
        raise exception 'Cannot grant a role higher than your own';
      end if;
    end if;
  end if;

  return new;
end;
$function$;


-- ── VERIFY (run after applying) ─────────────────────────────────────────────
-- 1. A branch owner should now get a code instead of "Not permitted":
--      select public.current_clock_code();
--
-- 2. Offline dates should stop drifting. Compare recent offline rows against
--    their captured_at — the work_date should match the Berlin calendar day:
--      select l.work_date, e.captured_at,
--             (e.captured_at at time zone 'Europe/Berlin')::date as berlin_date
--      from public.attendance_events e
--      join public.attendance_logs l on l.id = e.attendance_log_id
--      where e.source = 'offline'
--      order by e.created_at desc limit 20;
--
-- 3. Historical rows are NOT corrected by this migration. To see how many are
--    affected (only late-evening UTC timestamps can be wrong):
--      select count(*) from public.attendance_events
--      where source = 'offline'
--        and (captured_at at time zone 'utc')::date
--            <> (captured_at at time zone 'Europe/Berlin')::date;
--    If that number is small, fix them by hand. If it is large, ask before
--    bulk-updating — moving a work_date changes what payroll already paid.
-- ============================================================================
