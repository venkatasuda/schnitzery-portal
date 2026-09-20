-- ============================================================================
-- FIX — guard_users_sensitive_update() referenced users.hourly_wage, which was
-- dropped in migration 04 (wages moved to user_pay). Migration 07 accidentally
-- reintroduced that reference by copying an older body, so the trigger now throws
--   "record \"new\" has no field \"hourly_wage\""
-- on EVERY update to public.users (staff edits, activate/deactivate, unlock,
-- login-lock, etc). This restores the correct guarded-column list: the same set
-- as 04, plus login_locked from 07, WITHOUT the dropped hourly_wage.
-- 2026-09-20
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
  if (new.role              is distinct from old.role)
  or (new.branch_id         is distinct from old.branch_id)
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
      raise exception 'Not permitted to change role, branch, contract hours, leave allowance or login lock';
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
