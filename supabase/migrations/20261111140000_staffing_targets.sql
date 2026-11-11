-- Staffing targets: how many people each team needs per shift and weekday (input for the smart scheduler).
-- weekday 0 = Monday … 6 = Sunday. Managers only; staff never read it.
begin;
create table if not exists public.staffing_targets (
  branch_id uuid not null references public.branches(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  team text not null check (length(team) between 1 and 40),
  shift text not null check (length(shift) between 1 and 40),
  needed smallint not null check (needed between 0 and 30),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (branch_id, weekday, team, shift)
);
alter table public.staffing_targets enable row level security;
drop policy if exists staffing_targets_managers on public.staffing_targets;
create policy staffing_targets_managers on public.staffing_targets for all to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
revoke all on public.staffing_targets from anon;
grant select, insert, update, delete on public.staffing_targets to authenticated;
notify pgrst, 'reload schema';
commit;
