-- Stock transfers only between branches of the same owner (Venky, 16 Nov 2026), e.g. Ermin's Munich ↔ Stuttgart.
-- "Same owner" = one active branch owner has access to both branches (home branch or user_branches).
-- Existing transfer flow is unchanged (request → send → receiving branch records the actual quantity).
-- Run once in production before merging; safe to run twice.


begin;

create or replace function private.same_owner(p_a uuid, p_b uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select p_a <> p_b and exists (
    select 1 from public.users u
    where u.role = 'branch_owner' and coalesce(u.status, 'active') = 'active'
      and p_a in (select u.branch_id union select ub.branch_id from public.user_branches ub where ub.user_id = u.id)
      and p_b in (select u.branch_id union select ub.branch_id from public.user_branches ub where ub.user_id = u.id))
$$;
revoke all on function private.same_owner(uuid, uuid) from public, anon;
grant execute on function private.same_owner(uuid, uuid) to authenticated;

-- Branches the caller's branch may request stock from (caller must have access to p_branch).
create or replace function public.transfer_partner_branches(p_branch uuid) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select b.id from public.branches b
  where p_branch in (select public.accessible_branch_ids()) and coalesce(b.is_active, true) and private.same_owner(p_branch, b.id)
$$;
revoke all on function public.transfer_partner_branches(uuid) from public, anon;
grant execute on function public.transfer_partner_branches(uuid) to authenticated;

drop policy if exists "transfers_insert" on public.stock_transfers;
create policy "transfers_insert" on public.stock_transfers for insert
  with check (to_branch_id in (select public.accessible_branch_ids()) and private.same_owner(from_branch_id, to_branch_id));

notify pgrst, 'reload schema';
commit;
