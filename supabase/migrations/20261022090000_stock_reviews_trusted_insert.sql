-- Codex review C/D finding 8: an authenticated manager could INSERT arbitrary
-- `figures` straight through PostgREST, bypassing the server action that recomputes
-- them. Reviews are now written only by the server (service role) through this
-- function, after it has recomputed and compared the evidence. Same pattern as
-- set_payroll_approval_atomic: service-role only, caller identity re-checked here.
begin;
set local lock_timeout='3s';
revoke insert on public.stock_reconciliation_reviews from authenticated;
drop policy if exists stock_reviews_record on public.stock_reconciliation_reviews;
grant insert(branch_id,from_count_id,to_count_id,figures,note,reviewed_by) on public.stock_reconciliation_reviews to service_role;

create function public.record_stock_reconciliation_review(p_actor uuid, p_branch uuid, p_from uuid, p_to uuid, p_figures jsonb, p_note text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- Request-scoped identity for the existing helpers; only reachable with the
  -- server's service-role key, never with an employee's or manager's JWT.
  perform set_config('request.jwt.claim.sub', p_actor::text, true);
  if p_actor is null or auth.uid() is null or not public.is_manager() then raise exception 'Managers only'; end if;
  if p_branch is null or not exists(select 1 from public.accessible_branch_ids() b where b = p_branch) then raise exception 'Branch access denied'; end if;
  if not exists(select 1 from public.inventory_counts c where c.id = p_from and c.branch_id = p_branch)
     or not exists(select 1 from public.inventory_counts c where c.id = p_to and c.branch_id = p_branch) then
    raise exception 'Counts do not belong to this branch';
  end if;
  insert into public.stock_reconciliation_reviews(branch_id, from_count_id, to_count_id, figures, note, reviewed_by)
    values (p_branch, p_from, p_to, p_figures, p_note, p_actor);
end $$;
revoke all on function public.record_stock_reconciliation_review(uuid,uuid,uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.record_stock_reconciliation_review(uuid,uuid,uuid,uuid,jsonb,text) to service_role;
commit;
