-- Owner targets per branch (docs/OWNER-COCKPIT.md): labour %, purchases % and prime cost %
-- of sales. The owner home colours each month-to-date figure against its target.
-- Everyone with access to the branch may read them; only owners may set them.
begin;
set local lock_timeout = '3s';

create table public.branch_targets (
  branch_id uuid primary key references public.branches(id) on delete cascade,
  labour_pct numeric check (labour_pct is null or (labour_pct > 0 and labour_pct <= 100)),
  purchase_pct numeric check (purchase_pct is null or (purchase_pct > 0 and purchase_pct <= 100)),
  prime_pct numeric check (prime_pct is null or (prime_pct > 0 and prime_pct <= 200)),
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.branch_targets enable row level security;
revoke all on public.branch_targets from anon;
grant select, insert, update on public.branch_targets to authenticated;

create policy branch_targets_select on public.branch_targets for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()));
create policy branch_targets_insert on public.branch_targets for insert to authenticated
  with check (public.is_owner() and branch_id in (select public.accessible_branch_ids()) and updated_by = auth.uid());
create policy branch_targets_update on public.branch_targets for update to authenticated
  using (public.is_owner() and branch_id in (select public.accessible_branch_ids()))
  with check (public.is_owner() and branch_id in (select public.accessible_branch_ids()) and updated_by = auth.uid());

commit;
