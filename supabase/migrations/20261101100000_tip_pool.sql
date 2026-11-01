-- Weekly tip pool (Trinkgeld), owner decision 2026-11: one total per week (cash + card),
-- split by worked hours across everyone who worked that week. Kept apart from sales.
-- The split is computed in the app (src/lib/pay/tips.ts) from completed attendance.
begin;
set local lock_timeout = '3s';

create table public.tip_pools (
  branch_id uuid not null references public.branches(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  cash numeric(10,2) not null default 0 check (cash >= 0 and cash < 100000),
  card numeric(10,2) not null default 0 check (card >= 0 and card < 100000),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now(),
  primary key (branch_id, week_start)
);

alter table public.tip_pools enable row level security;
revoke all on public.tip_pools from anon;
grant select, insert, update on public.tip_pools to authenticated;

create policy tip_pools_select on public.tip_pools for select to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()));
create policy tip_pools_insert on public.tip_pools for insert to authenticated
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()) and updated_by = auth.uid());
create policy tip_pools_update on public.tip_pools for update to authenticated
  using (public.is_manager() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_manager() and branch_id in (select public.accessible_branch_ids()) and updated_by = auth.uid());

commit;
