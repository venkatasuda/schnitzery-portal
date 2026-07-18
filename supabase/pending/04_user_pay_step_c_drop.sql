-- ============================================================================
-- ITEM 18 — STEP C of 3: close the hole. RUN THIS LAST.
-- 2026-07-18
--
-- ⚠  DO NOT RUN THIS UNTIL ALL OF THE FOLLOWING ARE TRUE:
--
--   1. 03_user_pay_step_a.sql has been applied, and its verification query
--      showed users_total = pay_rows and 0 mismatches.
--   2. The app changes (STEP B) are MERGED AND DEPLOYED — not just written.
--      Check that src/lib/pay/wages.ts exists on main and Vercel has built it.
--   3. You have opened the Labour page and the Payroll page in the live app and
--      confirmed the wage figures still look right.
--
-- Until this file runs, the hole is still open: users.hourly_wage still exists
-- and every colleague can still read it. Steps A and B change nothing for an
-- attacker — they only make it SAFE to remove the column. This is the step that
-- actually fixes item 18.
--
-- If you run this while the old code is still deployed, the Labour and Payroll
-- pages will show every wage as blank (not an error, just empty) until the new
-- code ships. That is recoverable — see ROLLBACK at the bottom.
-- ============================================================================


-- ── Last check before the point of no return ────────────────────────────────
-- This will ABORT the whole script if anything was missed. Nothing is dropped
-- unless every wage in `users` is safely mirrored in `user_pay`.
DO $$
DECLARE
  v_missing int;
  v_mismatch int;
BEGIN
  SELECT count(*) INTO v_missing
  FROM public.users u
  LEFT JOIN public.user_pay p ON p.user_id = u.id
  WHERE p.user_id IS NULL;

  SELECT count(*) INTO v_mismatch
  FROM public.users u
  JOIN public.user_pay p ON p.user_id = u.id
  WHERE u.hourly_wage IS DISTINCT FROM p.hourly_wage;

  IF v_missing > 0 THEN
    RAISE EXCEPTION 'ABORTED: % user(s) have no user_pay row. Re-run 03_user_pay_step_a.sql.', v_missing;
  END IF;

  IF v_mismatch > 0 THEN
    RAISE EXCEPTION 'ABORTED: % wage(s) differ between users and user_pay. Investigate before dropping.', v_mismatch;
  END IF;

  RAISE NOTICE 'Pre-flight OK: all wages mirrored. Dropping users.hourly_wage.';
END $$;


-- ── Keep a copy for 30 days, just in case ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users_hourly_wage_backup_20260718 AS
  SELECT id, hourly_wage, now() AS backed_up_at FROM public.users;

ALTER TABLE public.users_hourly_wage_backup_20260718 ENABLE ROW LEVEL SECURITY;
-- No policies on purpose: deny-all to end users, service role only.
-- DROP THIS TABLE once you are confident (say, 2026-08-18).


-- ── The actual fix ──────────────────────────────────────────────────────────
ALTER TABLE public.users DROP COLUMN IF EXISTS hourly_wage;


-- ── The trigger no longer needs to guard a column that doesn't exist ────────
-- guard_users_sensitive_update() references new.hourly_wage. Postgres does not
-- validate plpgsql bodies until execution, so leaving it would make EVERY
-- update to users fail at runtime. Rewritten here without it.
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
  -- hourly_wage is gone — it lives in user_pay now, protected by its own RLS.
  if (new.role              is distinct from old.role)
  or (new.branch_id         is distinct from old.branch_id)
  or (new.contract_hours    is distinct from old.contract_hours)
  or (new.annual_leave_days is distinct from old.annual_leave_days)
  or (new.employee_code     is distinct from old.employee_code) then

    if auth.uid() is null then
      return new;
    end if;

    select role into caller_role from public.users where id = auth.uid();
    caller_rank := public.role_rank(caller_role);

    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, contract hours or leave allowance';
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


-- ── VERIFY ──────────────────────────────────────────────────────────────────
-- 1. The column is gone:
--      select column_name from information_schema.columns
--      where table_name = 'users' and column_name = 'hourly_wage';
--    → must return NO rows.
--
-- 2. Sign in as a STAFF account and try the attack that used to work:
--      GET /rest/v1/users?select=full_name,hourly_wage
--    → must now fail with "column users.hourly_wage does not exist".
--
--      GET /rest/v1/user_pay?select=user_id,hourly_wage
--    → must return only THEIR OWN row.
--
-- 3. Sign in as a MANAGER and open the Labour page. Every wage must still show.
--
-- If step 3 fails, the app is not deployed with STEP B. See ROLLBACK.
--
--
-- ── ROLLBACK ────────────────────────────────────────────────────────────────
-- Puts the column back and refills it. The hole reopens, but nothing is lost.
--
--   ALTER TABLE public.users ADD COLUMN hourly_wage numeric;
--   UPDATE public.users u SET hourly_wage = p.hourly_wage
--     FROM public.user_pay p WHERE p.user_id = u.id;
--   -- then re-apply the guard trigger from 01_safe_fixes.sql PART 3
--
--
-- ── STILL NOT FIXED BY THIS FILE ────────────────────────────────────────────
-- `phone` and `email` remain readable by every colleague in the branch, for the
-- same row-level reason. That may well be intended — a staff directory needs
-- them, and the app has a /directory page. Decide deliberately rather than by
-- accident: if staff should NOT see colleagues' phone numbers, phone needs the
-- same treatment as wages.
-- ============================================================================
