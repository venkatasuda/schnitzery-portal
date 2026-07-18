-- ============================================================================
-- Schnitzery — audit fixes, PART 2 of 2: THE BEHAVIOUR CHANGE
-- 2026-07-18 · audit items 15, 17
--
-- ⚠  DO NOT APPLY THIS UNTIL YOU HAVE RUN THE COUNTING QUERY BELOW.
-- ⚠  APPLY 01_safe_fixes.sql FIRST — this file builds on it.
--
-- WHAT CHANGES
--   item 15 · sync_attendance_events() computed whether the clock code was
--             valid, stored the answer on attendance_events.code_valid, and
--             then IGNORED it — applying the event either way. The online
--             clock_in() raises 'Invalid or expired code' and refuses. So the
--             same branch enforced its QR rule online and ignored it offline.
--
--   item 17 · captured_at came straight from the device clock with no bounds.
--             Combined with the above, on a branch where qr_required = false
--             there was NO constraint on offline attendance at all: set the
--             tablet's clock back, clock in, sync, hours recorded.
--
-- WHAT IT MEANS IN THE RESTAURANT
--   Events that fail these checks are still RECORDED in attendance_events —
--   the audit trail stays complete, nothing is lost — but they are no longer
--   APPLIED to attendance_logs. They come back as 'recorded_with_error', which
--   the client already treats as "server has it, drop from queue", so nothing
--   jams. Staff then fix them through the existing attendance-corrections flow.
--
--   The cost of turning this on is manager time spent on corrections. The cost
--   of leaving it off is that offline hours are unverifiable.
--
-- ── RUN THIS FIRST ──────────────────────────────────────────────────────────
-- How many offline events of the last 90 days would have been rejected?
--
--   select
--     coalesce(code_valid::text, 'not-checked (qr_required off)') as code_state,
--     count(*)
--   from public.attendance_events
--   where source = 'offline' and created_at > now() - interval '90 days'
--   group by 1 order by 2 desc;
--
-- READING THE RESULT:
--   mostly 'true'                → safe to apply, few corrections expected.
--   many 'false'                 → STOP. Something is wrong with code capture
--                                  (clock drift on the tablets, or the code is
--                                  not being stored with the queued event).
--                                  Fix that cause first or you will bury your
--                                  managers in corrections on day one.
--   mostly 'not-checked'         → those branches have qr_required = false, so
--                                  the code check will not fire for them at all
--                                  and only the captured_at clamp applies.
--                                  Consider turning qr_required ON per branch,
--                                  one branch at a time, after this is live.
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
  -- How far a device clock may disagree with the server before we stop trusting
  -- it. Widen c_max_backdate if a tablet might plausibly stay offline longer.
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

    -- 2) retro code validation
    v_valid := case when coalesce(v_qr, false) then public.code_valid_at(v_branch, v_code, v_at, 4) else null end;

    -- Berlin, not UTC — must match clock_in()/clock_out(). (from 01_safe_fixes)
    v_wd := (v_at at time zone 'Europe/Berlin')::date;

    -- item 17 · the device clock must be plausible
    if v_at > now() + c_future_skew then
      v_err := 'captured_at_in_future';
    elsif v_at < now() - c_max_backdate then
      v_err := 'captured_at_too_old';
    -- item 15 · enforce the code where the branch requires one
    elsif coalesce(v_qr, false) and coalesce(v_valid, false) = false then
      v_err := 'invalid_code';
    end if;

    -- 3) apply to the session table — ONLY if the checks above passed
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


-- ── WATCH THIS FOR THE FIRST WEEK ───────────────────────────────────────────
--   select error, count(*) from public.attendance_events
--   where source = 'offline' and created_at > now() - interval '7 days'
--     and error is not null
--   group by 1 order by 2 desc;
--
-- 'invalid_code' climbing            → tablets are drifting or codes are not
--                                      being captured with the queued event.
-- 'captured_at_too_old' appearing    → widen c_max_backdate above.
-- 'captured_at_in_future' appearing  → a device clock is set wrong; find it via
--                                      the device_id column.
--
-- ROLLBACK: re-run 01_safe_fixes.sql. It restores the non-enforcing version
-- while keeping the timezone fix.
-- ============================================================================
