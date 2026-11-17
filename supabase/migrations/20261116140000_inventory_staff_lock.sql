-- Inventory (stock batches / expiry) is for shift leaders, managers and owners only (Venky, 16 Nov 2026).
-- Plain employees could read / add / close batches directly; these policies now also require private.can_plan_prep
-- (= manager role or a shift leader of that branch, see 20261108120000_prep_lists.sql).
-- Waste logging stays open to every employee of the branch (Venky, 17 Nov 2026): the waste policies below are the
-- original ones from 20261023120000_multi_branch_access.sql, restated so re-running this file restores them.
-- Policies only: no data changes. Run once in production before merging; safe to run twice.
begin;

drop policy if exists "waste_insert" on public.waste_log;
create policy "waste_insert" on public.waste_log for insert
  with check (branch_id in (select public.accessible_branch_ids()) and logged_by = auth.uid());
drop policy if exists "waste_select" on public.waste_log;
create policy "waste_select" on public.waste_log for select
  using (branch_id in (select public.accessible_branch_ids()));

drop policy if exists batches_select on public.stock_batches;
create policy batches_select on public.stock_batches for select to authenticated
  using (branch_id in (select public.accessible_branch_ids()) and exists (select 1 from public.users where id = auth.uid() and status = 'active')
    and private.can_plan_prep(branch_id));
drop policy if exists batches_insert on public.stock_batches;
create policy batches_insert on public.stock_batches for insert to authenticated
  with check (branch_id in (select public.accessible_branch_ids())
    and logged_by = auth.uid() and status = 'active' and closed_by is null and closed_at is null
    and exists (select 1 from public.users where id = auth.uid() and status = 'active')
    and private.can_plan_prep(branch_id));
drop policy if exists batches_update on public.stock_batches;
create policy batches_update on public.stock_batches for update to authenticated
  using (status = 'active' and branch_id in (select public.accessible_branch_ids())
    and exists (select 1 from public.users where id = auth.uid() and status = 'active') and private.can_plan_prep(branch_id))
  with check (status = 'used' and branch_id in (select public.accessible_branch_ids()) and closed_by = auth.uid() and closed_at is not null);

notify pgrst, 'reload schema';
commit;
