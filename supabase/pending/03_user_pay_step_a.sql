-- ============================================================================
-- ITEM 18 — STEP A of 3: create and fill the pay table. CHANGES NOTHING YET.
-- 2026-07-18
--
-- THE PROBLEM
-- users_select is:  (id = auth.uid()) OR (branch_id IN (SELECT accessible_branch_ids()))
-- and accessible_branch_ids() returns a staff member's own branch. Postgres RLS
-- is ROW-level, not COLUMN-level — so passing that policy hands over every
-- column of every colleague's row, including hourly_wage. One request:
--     GET /rest/v1/users?select=full_name,hourly_wage,phone
-- returns the branch's entire payroll. The app UI never shows this, which is
-- exactly why nobody would notice.
--
-- THE FIX
-- Move pay to its own table whose RLS is manager-only. There is no way to do
-- this with a policy on `users` — the column has to physically move.
--
-- THIS FILE IS SAFE. It only adds a table and copies data in. users.hourly_wage
-- is untouched and the app keeps reading it exactly as before. Nothing changes
-- for anyone until STEP B (the app) and STEP C (dropping the column).
--
-- APPLY: backup → SQL Editor → paste → Run → then run the verification at the
-- bottom. Only move to STEP B once the two counts match.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_pay (
  user_id     uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  -- Denormalised for cheap filtering only. Security does NOT depend on it —
  -- the policies below re-check the branch live, so a stale value here can
  -- never widen access. Kept in sync by the trigger further down.
  branch_id   uuid,
  hourly_wage numeric,
  updated_by  text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_pay_branch ON public.user_pay USING btree (branch_id);

ALTER TABLE public.user_pay ENABLE ROW LEVEL SECURITY;


-- ── Live branch check ───────────────────────────────────────────────────────
-- Resolves the target's CURRENT branch rather than trusting user_pay.branch_id,
-- so moving someone between branches can never strand or leak their pay row.
CREATE OR REPLACE FUNCTION public.user_in_my_branches(p_user uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select exists (
    select 1 from public.users u
    where u.id = p_user
      and u.branch_id in (select public.accessible_branch_ids())
  );
$function$;


-- ── Policies ────────────────────────────────────────────────────────────────
-- You may always read your OWN wage (you are entitled to know what you earn),
-- but never write it. Managers may read and write within their branches.

DROP POLICY IF EXISTS user_pay_own ON public.user_pay;
CREATE POLICY user_pay_own ON public.user_pay
  AS PERMISSIVE FOR SELECT TO authenticated
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS user_pay_mgr ON public.user_pay;
CREATE POLICY user_pay_mgr ON public.user_pay
  AS PERMISSIVE FOR ALL TO authenticated
  USING      (public.is_manager() AND public.user_in_my_branches(user_id))
  WITH CHECK (public.is_manager() AND public.user_in_my_branches(user_id));


-- ── Keep branch_id in step with users.branch_id ─────────────────────────────
CREATE OR REPLACE FUNCTION public.sync_user_pay_branch()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if new.branch_id is distinct from old.branch_id then
    update public.user_pay set branch_id = new.branch_id where user_id = new.id;
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_sync_user_pay_branch ON public.users;
CREATE TRIGGER trg_sync_user_pay_branch
  AFTER UPDATE OF branch_id ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_user_pay_branch();


-- ── Backfill ────────────────────────────────────────────────────────────────
-- Every user gets a row, including those with no wage set (NULL), so the app
-- never has to distinguish "no row" from "no wage".
INSERT INTO public.user_pay (user_id, branch_id, hourly_wage, updated_by)
SELECT u.id, u.branch_id, u.hourly_wage, 'backfill-2026-07-18'
FROM public.users u
ON CONFLICT (user_id) DO UPDATE
  SET hourly_wage = excluded.hourly_wage,
      branch_id   = excluded.branch_id;


-- ── VERIFY — both numbers must match before STEP B ──────────────────────────
--
--   select
--     (select count(*) from public.users)                            as users_total,
--     (select count(*) from public.user_pay)                         as pay_rows,
--     (select count(*) from public.users    where hourly_wage is not null) as users_with_wage,
--     (select count(*) from public.user_pay where hourly_wage is not null) as pay_with_wage;
--
-- users_total must equal pay_rows, and users_with_wage must equal pay_with_wage.
-- If they differ, STOP and do not proceed to STEP B.
--
-- Also confirm no wage was lost or altered:
--
--   select count(*) as mismatches
--   from public.users u
--   join public.user_pay p on p.user_id = u.id
--   where u.hourly_wage is distinct from p.hourly_wage;
--
-- That must be 0.
-- ============================================================================
