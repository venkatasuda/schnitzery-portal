-- ============================================================================
-- ROLLBACK for 20261017160350_offline_attendance_integrity.sql
--
-- Use ONLY if the migration itself must be undone. If just the app misbehaves,
-- roll back the Vercel deployment instead — the migration is backward-compatible
-- with the previous app (94614db) and can stay in place.
--
-- BEFORE USING: paste the definition you captured with the
-- "ROLLBACK CAPTURE" query (preapply-verify-offline-migration.sql) into STEP 2.
-- Do not use a definition copied from supabase/pending/* — it may not match live.
--
-- Data note: dropping attendance_event_reviews deletes manager review notes made
-- after the migration. attendance_events rows written by the new replay remain
-- (they are ordinary evidence rows). Export the notes first if any exist:
--   select * from public.attendance_event_reviews;
-- ============================================================================
begin;
set local lock_timeout = '5s';

-- STEP 1 — remove the objects the migration created (reverse order).
drop view if exists public.offline_attendance_issues;
drop table if exists public.attendance_event_reviews;
drop function if exists attendance_replay.apply_events(jsonb);
drop schema if exists attendance_replay;
drop index if exists public.attendance_one_open_shift;

-- STEP 2 — restore the previous public.sync_attendance_events exactly as captured.
-- >>> PASTE THE CAPTURED pg_get_functiondef OUTPUT HERE (it starts with
-- >>> "CREATE OR REPLACE FUNCTION public.sync_attendance_events(p_events jsonb)").
-- >>> Remove this line once pasted; the script must not run without it:
do $$ begin raise exception 'Paste the captured function definition into STEP 2 first.'; end $$;

-- STEP 3 — restore the previous privileges (authenticated users sync offline events).
revoke all on function public.sync_attendance_events(jsonb) from public, anon;
grant execute on function public.sync_attendance_events(jsonb) to authenticated;

commit;
