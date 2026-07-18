-- ============================================================================
-- Schnitzery — audit fixes, 2026-07-18
--
-- Derived from production-schema.sql / production-functions.sql.
-- Read PRODUCTION-AUDIT.md items 14-19 for the reasoning behind each change.
--
-- HOW TO APPLY:
--   1. Take a backup first (Supabase dashboard → Database → Backups).
--   2. Apply SECTION 1 and 2 — these are safe and fix live bugs.
--   3. SECTION 3 changes attendance behaviour. Read the note before applying.
--   4. SECTION 4 is NOT safe to run blind — it is a plan, not a patch.
--
-- Every function below is reproduced in full because Postgres has no "patch
-- function" operation. Diff each against production-functions.sql before
-- running, in case production has drifted since the dump was taken.
-- ============================================================================


-- ============================================================================
-- SECTION 1 — current_clock_code() role list is broken   [FIX: safe]
--
-- The role list checks for 'franchise_owner', which is not a role this system
-- has (users_role_check allows only super_admin, brand_owner, branch_owner,
-- manager, staff, kiosk). Meanwhile it OMITS branch_owner and super_admin.
--
-- Effect today: a branch owner or super admin calling getCurrentClockCode()
-- gets "Not permitted." and cannot display the clock code on the kiosk screen.
-- The newer current_clock_token() already does this correctly with is_manager().
-- ============================================================================

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

  -- Only managers / owners / the kiosk account may read the live code.
  -- Staff must read it off the in-store screen (this is the presence guarantee).
  -- Uses is_manager() so this list can never drift from the role set again.
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


-- ============================================================================
-- SECTION 2 — guard contract_hours and annual_leave_days   [FIX: safe]
--
-- guard_users_sensitive_update() currently protects role, branch_id and
-- hourly_wage. It does NOT protect contract_hours or annual_leave_days, and
-- the users_update RLS policy lets a user update their own row — so any staff
-- member can raise their own contract hours or holiday allowance with a direct
-- PostgREST call. Both feed payroll and leave-balance calculations.
--
-- NOT guarded here, deliberately:
--   must_change_password — ChangePasswordForm.tsx clears this as the user
--     themselves. Guarding it would break the forced-password-change flow.
--     Self-clearing it only lets someone skip a prompt on an account they
--     already control, so the risk is negligible.
-- ============================================================================

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
  -- Only act when a protected column actually changes.
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

    -- Manager and above (rank >= 2) may change these columns; staff/kiosk may not.
    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, wage, contract hours or leave allowance';
    end if;

    -- Cannot grant a role higher than your own.
    if new.role is distinct from old.role then
      new_rank := public.role_rank(new.role);
      if new.role not in ('super_admin','brand_owner','branch_owner','manager','staff','kiosk') then
        raise exception 'Invalid role value: %', new.role;
      end if;
      if new_rank > caller_rank then
        raise exception 'Cannot grant a role higher than your own';
      end if;
    end if;
  end if;

  return new;
end;
$function$;


-- ============================================================================
-- SECTION 3 — sync_attendance_events(): three real bugs   [FIX: behaviour change]
--
-- READ BEFORE APPLYING. This changes how offline attendance is recorded.
--
-- (a) WRONG TIMEZONE — work_date was computed as (captured_at at time zone 'utc').
--     Everywhere else in the system uses Europe/Berlin (clock_in uses
--     `(now() at time zone 'Europe/Berlin')::date`). In summer (CEST = UTC+2) an
--     offline clock-out at 00:30 Berlin is 22:30 UTC the PREVIOUS day, so late
--     shifts were filed against the wrong work_date — the exact shifts most
--     likely to be recorded offline. This is a payroll correctness bug.
--
-- (b) CODE VALIDATION COMPUTED BUT NEVER ENFORCED — v_valid was calculated and
--     stored on attendance_events.code_valid, then ignored: step 3 applied the
--     event to attendance_logs regardless. Online clock_in RAISES on a bad code;
--     the offline path accepted anything. Anyone who could reach the sync
--     endpoint could post a clock_in with no code at all and have it applied.
--
-- (c) captured_at UNBOUNDED — taken straight from the device clock with no
--     sanity check. On a branch with qr_required = false there is no code check
--     either, so a staff member could set a tablet's clock back and fabricate
--     hours. Now clamped to a sane window.
--
-- BEHAVIOUR CHANGE: events that fail (b) or (c) are still RECORDED in
-- attendance_events (nothing is ever lost, the audit trail is complete) but are
-- no longer APPLIED to attendance_logs — they come back as
-- 'recorded_with_error'. The client already treats that as "server has it, drop
-- from queue", so nothing gets stuck. Staff fix these via the existing
-- attendance-corrections flow.
--
-- BEFORE APPLYING, check how many events this would have rejected:
--   select code_valid, count(*) from public.attendance_events
--   where source = 'offline' and created_at > now() - interval '90 days'
--   group by 1;
-- If code_valid = false is common, fix the cause before turning on enforcement,
-- or you will flood managers with corrections on day one.
-- ============================================================================

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
  -- How far a device clock may disagree with the server before we stop trusting it.
  c_future_skew  interval := interval '10 minutes';
  c_max_backdate interval := interval '14 days';
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

    -- 2) retro code validation (only meaningful when the branch requires it)
    v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;

    -- (a) Berlin, not UTC — must match clock_in()/clock_out().
    v_wd := (v_at at time zone 'Europe/Berlin')::date;

    -- (c) the device clock must be plausible
    if v_at > now() + c_future_skew then
      v_err := 'captured_at_in_future';
    elsif v_at < now() - c_max_backdate then
      v_err := 'captured_at_too_old';
    -- (b) enforce the code when the branch requires one
    elsif coalesce(v_qr, false) and coalesce(v_valid, false) = false then
      v_err := 'invalid_code';
    end if;

    -- 3) apply to the session table (conflict-safe) — only if it passed above
    if v_err is null then
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
    end if;

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


-- ============================================================================
-- SECTION 4 — hourly_wage is readable by every colleague   [PLAN: do not run blind]
--
-- THIS SECTION IS COMMENTED OUT ON PURPOSE. It will break payroll code if
-- applied without the matching application changes. It is here so the problem
-- is written down next to everything else, not so it can be pasted in.
--
-- THE PROBLEM
-- users_select is:
--     (id = auth.uid()) OR (branch_id IN (SELECT accessible_branch_ids()))
-- and accessible_branch_ids() returns a staff member's own branch. Postgres RLS
-- is row-level, not column-level — so every staff member can read every column
-- of every colleague in their branch:
--     hourly_wage, phone, email, annual_leave_days, contract_hours, employee_code
-- One PostgREST call (`/rest/v1/users?select=full_name,hourly_wage,phone`) with
-- their own anon token returns the whole branch's pay and contact list.
--
-- For a German employer this is the most serious data-protection issue in the
-- system. Wage data is exactly what an employee is not entitled to see about a
-- colleague, and the app's own UI never shows it to staff — the exposure is
-- invisible from inside the product.
--
-- WHY NOT A QUICK FIX
-- Column privileges (REVOKE SELECT (hourly_wage) ... FROM authenticated) would
-- also block managers, who legitimately need it: labor.ts:123 selects
-- hourly_wage for the labour-cost report.
--
-- THE PROPER FIX — move pay into its own table, manager-only:
--
--   CREATE TABLE public.user_pay (
--     user_id     uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
--     branch_id   uuid,
--     hourly_wage numeric,
--     updated_by  text,
--     updated_at  timestamptz NOT NULL DEFAULT now()
--   );
--   ALTER TABLE public.user_pay ENABLE ROW LEVEL SECURITY;
--
--   CREATE POLICY user_pay_mgr ON public.user_pay
--     FOR ALL TO authenticated
--     USING      (is_manager() AND branch_id IN (SELECT accessible_branch_ids()))
--     WITH CHECK (is_manager() AND branch_id IN (SELECT accessible_branch_ids()));
--
--   -- staff may read only their OWN wage
--   CREATE POLICY user_pay_own ON public.user_pay
--     FOR SELECT TO authenticated USING (user_id = auth.uid());
--
--   INSERT INTO public.user_pay (user_id, branch_id, hourly_wage)
--     SELECT id, branch_id, hourly_wage FROM public.users WHERE hourly_wage IS NOT NULL;
--
--   -- ONLY after labor.ts and every other reader has been repointed:
--   -- ALTER TABLE public.users DROP COLUMN hourly_wage;
--
-- ORDER OF OPERATIONS: create + backfill user_pay → update the application to
-- read from it → verify the labour report still matches → then drop the column.
-- Do not drop first.
--
-- `phone` deserves the same treatment but is lower risk; consider whether staff
-- seeing colleagues' numbers is intended (a shift-swap feature might want it).
-- ============================================================================
