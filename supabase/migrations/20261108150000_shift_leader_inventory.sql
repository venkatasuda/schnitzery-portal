-- Shift leaders (public.shift_leaders, migration 20261108120000) get four daily inventory tasks:
--   • stocktake: start / save / cancel a count draft   (publishing stays manager-only)
--   • direct delivery (receive_direct) WITHOUT any cost (costs, invoices, orders stay manager-only)
--   • fill a missing batch expiry date
--   • batch use / waste — already allowed for all active branch staff (consume_stock_batch), unchanged
-- The three guarded functions are long; instead of copying them, exactly one permission clause is
-- replaced in the live definition. If that clause is not found (the function was changed since),
-- the migration stops — re-check the guard before re-running. Re-running after success is a no-op.
begin;

create or replace function pg_temp.swap_guard(p_fn regprocedure, p_old text, p_new text) returns void language plpgsql as $$
declare def text := pg_get_functiondef(p_fn);
begin
  if position(p_new in def) > 0 then return; end if; -- already applied
  if position(p_old in def) = 0 then raise exception 'Permission clause not found in % — the function changed; review this migration', p_fn; end if;
  execute replace(def, p_old, p_new);
end $$;

-- Stocktake drafts: shift leaders may start, save and cancel; "complete" (publish) stays manager-only.
select pg_temp.swap_guard('private.edit_inventory_count(uuid,uuid,text,integer,jsonb)'::regprocedure,
  'if actor is null or not public.is_manager() or',
  'if actor is null or not (public.is_manager() or (private.is_shift_leader(p_branch) and p_action in (''start'',''save'',''cancel''))) or');

-- Missing expiry date on a batch label.
select pg_temp.swap_guard('private.resolve_stock_batch_expiry(uuid,uuid,uuid,date,text)'::regprocedure,
  'if not public.is_manager() or',
  'if not (public.is_manager() or private.is_shift_leader(p_branch)) or');

-- Direct delivery only, and only when no line carries a cost (managers add costs later).
select pg_temp.swap_guard('private.inventory_operation(uuid,uuid,text,jsonb)'::regprocedure,
  'if actor is null or not public.is_manager() or',
  'if actor is null or not (public.is_manager() or (private.is_shift_leader(p_branch) and p_action = ''receive_direct'' and jsonb_typeof(p_body->''lines'') = ''array'' and not exists (select 1 from jsonb_array_elements(p_body->''lines'') as shift_line(item) where shift_line.item ? ''cost'' and jsonb_typeof(shift_line.item->''cost'') is distinct from ''null''))) or');

-- Shift leaders can read count drafts (lines follow the session policy).
drop policy if exists count_sessions_read on public.inventory_count_sessions;
create policy count_sessions_read on public.inventory_count_sessions for select to authenticated
  using ((public.is_manager() or private.is_shift_leader(branch_id))
    and exists (select 1 from public.users u where u.id = (select auth.uid()) and u.status = 'active')
    and branch_id in (select public.accessible_branch_ids()));

-- Supplier names (no contact details) for the delivery form.
create or replace function private.shift_supplier_names(p_branch uuid) returns setof text
language sql stable security definer set search_path = '' as $$
  select s.name from public.inventory_suppliers s
  where s.branch_id = p_branch and s.is_active and p_branch in (select public.accessible_branch_ids())
    and (public.is_manager() or private.is_shift_leader(p_branch))
  order by s.name
$$;
revoke all on function private.shift_supplier_names(uuid) from public, anon;
grant execute on function private.shift_supplier_names(uuid) to authenticated;
create or replace function public.shift_supplier_names(p_branch uuid) returns setof text
language sql stable security invoker set search_path = '' as $$ select private.shift_supplier_names(p_branch) $$;
revoke all on function public.shift_supplier_names(uuid) from public, anon;
grant execute on function public.shift_supplier_names(uuid) to authenticated;

notify pgrst, 'reload schema';
commit;
