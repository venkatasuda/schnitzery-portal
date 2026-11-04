-- Audit round 2 (2026-11-04).
-- 1) A real, tamper-proof audit log. Until now only branch-settings changes were written,
--    and ANY signed-in user (staff included) could insert rows with any actor name.
--    Now: rows are written only by database triggers, carry the real account (actor_id)
--    and the person concerned (target_user), and nobody can insert, edit or delete them.
-- 2) Managers can close a forgotten open shift with the real end time and a reason.
begin;
set local lock_timeout = '3s';

alter table public.audit_logs add column if not exists actor_id uuid references public.users(id) on delete set null;
alter table public.audit_logs add column if not exists target_user uuid references public.users(id) on delete set null;
alter table public.audit_logs add column if not exists changes jsonb;
create index if not exists audit_logs_branch_time on public.audit_logs(branch_id, created_at desc);

drop policy if exists audit_insert on public.audit_logs;
revoke insert, update, delete, truncate on public.audit_logs from public, anon, authenticated;

-- One writer for every audited table. TG_ARGV[0] = action, TG_ARGV[1] = watched columns.
-- UPDATE rows where none of the watched columns changed are not logged.
create or replace function private.audit_change() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  rec jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  prev jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) end;
  cols text[] := string_to_array(coalesce(tg_argv[1], ''), ',');
  c text; diff jsonb := '{}'::jsonb; who uuid; who_name text; k text;
begin
  foreach c in array cols loop
    if tg_op = 'UPDATE' then
      if (prev -> c) is distinct from (rec -> c) then diff := diff || jsonb_build_object(c, jsonb_build_object('from', prev -> c, 'to', rec -> c)); end if;
    elsif rec ? c then diff := diff || jsonb_build_object(c, rec -> c);
    end if;
  end loop;
  if tg_op = 'UPDATE' and diff = '{}'::jsonb then return null; end if;

  who := auth.uid();
  if who is null then
    foreach k in array array['recorded_by','approved_by','uploaded_by','reviewed_by','updated_by'] loop
      if rec ->> k ~* '^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$' then who := (rec ->> k)::uuid; exit; end if;
    end loop;
  end if;
  if who is not null then select full_name into who_name from public.users where id = who; end if;

  insert into public.audit_logs(branch_id, action, actor, actor_id, target_user, changes, details)
  values (
    nullif(rec ->> 'branch_id', '')::uuid, tg_argv[0], coalesce(who_name, case when who is null then 'system' else 'unknown' end), who,
    case when tg_table_name = 'users' then (rec ->> 'id')::uuid
         when rec ->> 'user_id' ~* '^[0-9a-f-]{36}$' then (rec ->> 'user_id')::uuid end,
    diff, left(diff::text, 2000));
  return null;
end $$;
revoke all on function private.audit_change() from public, anon, authenticated;

-- Wages, payroll and pay settings
drop trigger if exists audit_wage on public.wage_history;
create trigger audit_wage after insert on public.wage_history for each row execute function private.audit_change('wage_set', 'hourly_wage,effective_from');
drop trigger if exists audit_payroll_approved on public.payroll_approvals;
create trigger audit_payroll_approved after insert on public.payroll_approvals for each row execute function private.audit_change('payroll_approved', 'month,note');
drop trigger if exists audit_payroll_run on public.payroll_runs;
create trigger audit_payroll_run after update on public.payroll_runs for each row execute function private.audit_change('payroll_status', 'month,status');
drop trigger if exists audit_payroll_settings on public.payroll_settings;
create trigger audit_payroll_settings after insert or update on public.payroll_settings for each row execute function private.audit_change('payroll_rules_changed', 'ot_daily_hours,night_start,night_end,datev');
drop trigger if exists audit_tips on public.tip_pools;
create trigger audit_tips after insert or update on public.tip_pools for each row execute function private.audit_change('tips_saved', 'week_start,cash,card');

-- Shifts, corrections, leave
drop trigger if exists audit_shift_review on public.attendance_logs;
create trigger audit_shift_review after update on public.attendance_logs for each row execute function private.audit_change('shift_reviewed', 'approval_status');
drop trigger if exists audit_correction_rejected on public.attendance_corrections;
create trigger audit_correction_rejected after update on public.attendance_corrections for each row
  when (new.status = 'rejected' and old.status is distinct from 'rejected') execute function private.audit_change('correction_rejected', 'type,target_date,status,manager_note');
drop trigger if exists audit_leave on public.leave_requests;
create trigger audit_leave after update on public.leave_requests for each row execute function private.audit_change('leave_decided', 'from_date,to_date,status');

-- People, access, documents
drop trigger if exists audit_staff_created on public.users;
create trigger audit_staff_created after insert on public.users for each row execute function private.audit_change('staff_created', 'full_name,role,team,branch_id,contract_type,contract_hours,employee_code');
drop trigger if exists audit_staff_updated on public.users;
create trigger audit_staff_updated after update on public.users for each row execute function private.audit_change('staff_updated', 'full_name,role,team,branch_id,status,contract_type,contract_hours,employee_code');
drop trigger if exists audit_branch_access on public.user_branches;
create trigger audit_branch_access after insert or delete on public.user_branches for each row execute function private.audit_change('branch_access', 'branch_id');
drop trigger if exists audit_document_review on public.user_documents;
create trigger audit_document_review after update on public.user_documents for each row
  when (new.status in ('approved', 'rejected') and old.status is distinct from new.status) execute function private.audit_change('document_reviewed', 'doc_type,status,rejection_reason');
drop trigger if exists audit_payslip on public.user_documents;
create trigger audit_payslip after insert on public.user_documents for each row
  when (new.doc_type = 'payslip') execute function private.audit_change('payslip_uploaded', 'doc_type,file_name,issue_date');

-- Branch rules
drop trigger if exists audit_targets on public.branch_targets;
create trigger audit_targets after insert or update on public.branch_targets for each row execute function private.audit_change('targets_changed', 'labour_pct,purchase_pct,prime_pct');
drop trigger if exists audit_branch_settings on public.branch_settings;
create trigger audit_branch_settings after insert or update on public.branch_settings for each row execute function private.audit_change('settings_updated', 'qr_required,gps_mode');

-- Close a forgotten open shift (manager decision, logged, employee notified).
create or replace function public.manager_close_shift(p_log uuid, p_out timestamptz, p_reason text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := auth.uid(); v_name text; l public.attendance_logs%rowtype; v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_uid is null then raise exception 'Not logged in.'; end if;
  if not public.is_manager() then raise exception 'Managers only.'; end if;
  select * into l from public.attendance_logs where id = p_log for update;
  if l.id is null or l.branch_id not in (select public.accessible_branch_ids()) then raise exception 'Shift not found.'; end if;
  if l.clock_out is not null or l.status is distinct from 'active' then raise exception 'This shift is already closed.'; end if;
  if l.user_id = v_uid or not public.outranks(l.user_id) then raise exception 'You can only close shifts of people ranked below you.'; end if;
  if p_out is null or l.clock_in is null or p_out <= l.clock_in or p_out > now() + interval '1 minute'
     or p_out - l.clock_in > interval '16 hours' then raise exception 'Enter an end time after the clock-in, not in the future, within 16 hours.'; end if;
  if length(v_reason) < 3 or length(v_reason) > 500 then raise exception 'Give a short reason (3–500 characters).'; end if;
  select full_name into v_name from public.users where id = v_uid;

  update public.attendance_logs set
    clock_out = p_out, status = 'complete', source = 'corrected', approval_status = 'pending',
    duration_mins = greatest(0, round(extract(epoch from (p_out - l.clock_in)) / 60.0)),
    breaks = coalesce((select jsonb_agg(case when b ->> 'end' is null then b || jsonb_build_object('end', p_out) else b end)
                       from jsonb_array_elements(case when jsonb_typeof(l.breaks) = 'array' then l.breaks else '[]'::jsonb end) b), '[]'::jsonb)
  where id = p_log;

  insert into public.audit_logs(branch_id, action, actor, actor_id, target_user, changes, details)
  values (l.branch_id, 'shift_closed', coalesce(v_name, 'unknown'), v_uid, l.user_id,
          jsonb_build_object('clock_in', l.clock_in, 'clock_out', p_out, 'reason', v_reason),
          left(jsonb_build_object('clock_out', p_out, 'reason', v_reason)::text, 2000));
  begin insert into public.notifications (branch_id, user_id, type, title, message)
    values (l.branch_id, l.user_id, 'shift_closed', 'Shift closed by your manager', v_reason); exception when others then null; end;
  return jsonb_build_object('ok', true);
end $$;
revoke all on function public.manager_close_shift(uuid, timestamptz, text) from public, anon;
grant execute on function public.manager_close_shift(uuid, timestamptz, text) to authenticated;

commit;
