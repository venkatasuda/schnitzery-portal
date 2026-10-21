-- ============================================================================
-- PRE-APPLY VERIFICATION for 20261017160350_offline_attendance_integrity.sql
--
-- Read-only. Run this against the TARGET project (staging first, then the real
-- Schnitzery project) BEFORE applying the offline migration. It clears review
-- findings F1 (migration will not abort) and F2 (schema/function/RLS exist).
--
-- How to read it: every row returns a `check` + `status`. All must be PASS.
-- Any FAIL means do NOT apply the migration until resolved.
-- ============================================================================

-- F1 — the new partial unique index aborts if any user has >1 open shift.
with dupes as (
  select user_id from public.attendance_logs
   where status in ('active','on-break') group by user_id having count(*) > 1
)
select 'F1 one-open-shift' as check,
       case when exists(select 1 from dupes) then 'FAIL — resolve duplicates first' else 'PASS' end as status,
       (select count(*) from dupes) as offending_users;

-- F1 detail (only rows if F1 failed) — the users/shifts to fix by hand.
select 'F1 offending shift' as check, user_id, id as attendance_log_id, status, clock_in
  from public.attendance_logs
 where status in ('active','on-break')
   and user_id in (select user_id from public.attendance_logs
                   where status in ('active','on-break') group by user_id having count(*) > 1)
 order by user_id, clock_in;

-- F2a — required columns on attendance_events.
select 'F2 attendance_events cols' as check,
       case when count(*) = 12 then 'PASS' else 'FAIL — missing columns' end as status,
       string_agg(column_name, ', ' order by column_name) as present
  from information_schema.columns
 where table_schema='public' and table_name='attendance_events'
   and column_name in ('event_uuid','user_id','branch_id','device_id','action',
                       'captured_at','source','code','code_valid','sync_status',
                       'attendance_log_id','error');

-- F2b — required columns on attendance_logs.
select 'F2 attendance_logs cols' as check,
       case when count(*) = 8 then 'PASS' else 'FAIL — missing columns' end as status,
       string_agg(column_name, ', ' order by column_name) as present
  from information_schema.columns
 where table_schema='public' and table_name='attendance_logs'
   and column_name in ('user_id','branch_id','work_date','clock_in','clock_out',
                       'status','approval_status','breaks');

-- F2c — required columns on branch_settings (replay reads qr_required, gps_mode).
select 'F2 branch_settings cols' as check,
       case when count(*) = 2 then 'PASS' else 'FAIL — missing columns' end as status,
       string_agg(column_name, ', ' order by column_name) as present
  from information_schema.columns
 where table_schema='public' and table_name='branch_settings'
   and column_name in ('qr_required','gps_mode');

-- F2d — functions the migration calls must already exist.
select 'F2 helper functions' as check,
       case when count(*) = 4 then 'PASS' else 'FAIL — missing function(s)' end as status,
       string_agg(proname, ', ' order by proname) as present
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and proname in ('code_valid_at','is_manager','accessible_branch_ids','current_role');

-- F2e — attendance_events must have RLS enabled (the security_invoker view relies on it).
select 'F2 attendance_events RLS' as check,
       case when c.relrowsecurity then 'PASS' else 'FAIL — enable RLS before the invoker view' end as status
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
 where n.nspname='public' and c.relname='attendance_events';

-- F2f — attendance_events SELECT policies (so managers see branch rows, employees their own).
select 'F2 attendance_events SELECT policies' as check,
       case when count(*) >= 1 then 'PASS (review the USING clauses below)' else 'FAIL — no SELECT policy; the view returns nothing' end as status,
       string_agg(policyname, ', ') as policies
  from pg_policies
 where schemaname='public' and tablename='attendance_events' and cmd in ('SELECT','ALL');

-- F2f detail — inspect the actual USING clauses.
select 'F2 policy detail' as check, policyname, cmd, qual
  from pg_policies
 where schemaname='public' and tablename='attendance_events'
 order by cmd, policyname;

-- F2g — the migration does CREATE OR REPLACE on public.sync_attendance_events.
-- That FAILS if the live function's return type differs from jsonb.
select 'F2 sync_attendance_events signature' as check,
       case when count(*) = 1 and bool_and(pg_get_function_result(p.oid) = 'jsonb')
            then 'PASS' else 'FAIL — signature differs; migration would abort' end as status,
       string_agg(pg_get_function_identity_arguments(p.oid) || ' -> ' || pg_get_function_result(p.oid), '; ') as live
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname='sync_attendance_events';

-- ROLLBACK CAPTURE — save this output to a file BEFORE applying. It is the exact
-- live definition of the function the migration replaces; paste it into
-- scripts/ops/rollback-offline-migration.sql if a rollback is ever needed.
select pg_get_functiondef('public.sync_attendance_events(jsonb)'::regprocedure) as save_this_for_rollback;

-- Guard — the migration objects must NOT already exist (it has not been applied).
select 'applied?' as check,
       case when exists(select 1 from information_schema.schemata where schema_name='attendance_replay')
             or exists(select 1 from pg_class where relname='attendance_one_open_shift')
            then 'ALREADY APPLIED — do not re-run' else 'PASS — not yet applied' end as status;
