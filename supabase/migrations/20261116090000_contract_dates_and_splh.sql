-- Phase 2 (final-plan.md): contract end / probation dates on staff, and a sales-per-labour-hour target per branch.
-- Additive only: two nullable dates on users, one nullable number on branch_targets. Existing rows keep working.
-- Run once in the Supabase SQL editor (production) before merging; safe to run twice.
begin;

-- 1. Fixed-term contracts and probation (§ 15 TzBfG: working past a fixed-term end can make the contract permanent).
alter table public.users
  add column if not exists contract_end date,
  add column if not exists probation_end date;
comment on column public.users.contract_end is 'Last day of a fixed-term contract; null = open-ended. The roster refuses shifts after it.';
comment on column public.users.probation_end is 'Last day of the probation period; null = none / unknown.';

-- Employees must not change their own contract dates (same rule as contract_type in 20261112100000_audit_guards.sql).
create or replace function public.guard_users_team_fields() returns trigger
language plpgsql security definer set search_path = '' as $$
declare me uuid := auth.uid(); my_role text;
begin
  if me is null or old.id <> me then return new; end if; -- backend, or someone else's row (the existing guard and policy apply)
  if new.contract_type is distinct from old.contract_type
     or new.contract_end is distinct from old.contract_end or new.probation_end is distinct from old.probation_end
    then raise exception 'You cannot change your own contract type.' using errcode = '42501'; end if;
  select role into my_role from public.users where id = me;
  if coalesce(my_role, 'staff') in ('staff', 'kiosk')
     and (new.team is distinct from old.team or private.team_skills(new.skills) is distinct from private.team_skills(old.skills))
    then raise exception 'Your team and team skills are set by your manager.' using errcode = '42501'; end if;
  return new;
end $$;
revoke all on function public.guard_users_team_fields() from public, anon, authenticated;

-- 2. Sales per labour hour target (€ of sales one paid hour should carry), used to show planned vs supported hours.
alter table public.branch_targets add column if not exists splh numeric;
alter table public.branch_targets drop constraint if exists branch_targets_splh_check;
alter table public.branch_targets add constraint branch_targets_splh_check check (splh is null or (splh > 0 and splh < 10000));

notify pgrst, 'reload schema';
commit;
