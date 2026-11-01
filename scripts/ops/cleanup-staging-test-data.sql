-- LOCAL STAGING ONLY: remove leftovers from the manual security/walkthrough tests.
-- Run with:
--   Get-Content scripts\ops\cleanup-staging-test-data.sql -Raw | docker exec -i supabase_db_schnitzery-local-staging psql -U postgres -d postgres -v ON_ERROR_STOP=1
-- Refuses to run unless the synthetic "LOCAL TEST" branches exist (never production).
begin;
do $$ begin
  if not exists (select 1 from public.branches where name = 'LOCAL TEST Branch A') then
    raise exception 'Not the local staging database: refusing to clean up.';
  end if;
end $$;
set local session_replication_role = replica; -- local cleanup only: skip audit/immutability triggers

-- manager B was linked to branch A during the walkthrough
delete from public.user_branches ub using public.users u
 where ub.user_id = u.id and u.email = 'local.manager.b@example.test'
   and ub.branch_id = (select id from public.branches where name = 'LOCAL TEST Branch A');

-- fake audit entry written by the attack test
delete from public.audit_logs where action = 'x' and actor = 'y';

-- implausible 16h+ test shifts (e.g. staff A's 40.7 h shift)
delete from public.attendance_logs l using public.users u
 where l.user_id = u.id and u.email like 'local.%@example.test' and l.duration_mins > 960;

-- locks and bans left by the login-limit tests
update public.users set login_locked = false where email like 'local.%@example.test';
update auth.users set banned_until = null where email like 'local.%@example.test';
delete from public.auth_throttle where identifier like 'local.%@example.test' or identifier like 'limit-probe%';

commit;
select 'staging test data cleaned' as result;
