-- ============================================================================
-- LOGIN LOCK — hard lockout after too many failed sign-ins (2026-09-15)
--
-- After MAX_EMAIL failed attempts (src/lib/queries/loginThrottle.ts, currently
-- 3) an account is flagged login_locked = true. The 15-minute auto-cooldown does
-- NOT lift this flag — only a manager can, via the "Unlock" button on the Staff
-- page (POST /api/unlock-login, gated by the same rank rules as remove/reactivate).
--
-- Safe to run before or after deploying the code: if the column is missing the
-- lock write and read are wrapped so login fails OPEN (never locks anyone out
-- because the column doesn't exist yet). Running this first is cleaner.
-- ============================================================================

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_locked boolean NOT NULL DEFAULT false;

-- Staff must never clear their own lock. users_update allows id = auth.uid(),
-- so add login_locked to guard_users_sensitive_update() — the same trigger that
-- already stops self-edits of role/branch/wage/hours/leave/code. Service-role
-- paths (recordFail, /api/unlock-login) have no JWT → auth.uid() is null →
-- allowed; managers (rank >= 2) allowed; staff/kiosk blocked.
-- Only the guarded-column list changes below; the body is otherwise identical
-- to 01_safe_fixes.sql.
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
  or (new.employee_code     is distinct from old.employee_code)
  or (new.login_locked      is distinct from old.login_locked) then

    -- Backend / service-role / SQL editor has no JWT → trusted, allow.
    if auth.uid() is null then
      return new;
    end if;

    select role into caller_role from public.users where id = auth.uid();
    caller_rank := public.role_rank(caller_role);

    -- Manager and above (rank >= 2) may change these; staff/kiosk may not.
    if caller_rank < 2 then
      raise exception 'Not permitted to change role, branch, wage, contract hours, leave allowance or login lock';
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
