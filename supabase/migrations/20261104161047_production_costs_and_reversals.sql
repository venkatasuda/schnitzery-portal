begin;
set local lock_timeout='3s';
alter table public.inventory_production_runs add column reversed_at timestamptz;
alter table public.inventory_production_inputs add column planned_qty numeric check(planned_qty>=0 and planned_qty<1e9),
 add column unit_cost numeric check(unit_cost>=0 and unit_cost<1e9),
 add column cost_source jsonb;
create table public.inventory_production_reversals(
 id uuid primary key,run_id uuid not null unique references public.inventory_production_runs(id),branch_id uuid not null references public.branches(id),
 reason text not null check(length(trim(reason)) between 3 and 1000),actor_id uuid not null references public.users(id),recorded_at timestamptz not null default clock_timestamp()
);
alter table public.inventory_production_reversals enable row level security;
revoke all on public.inventory_production_reversals from public,anon,authenticated;
grant select on public.inventory_production_reversals to authenticated;
create policy production_reversals_read on public.inventory_production_reversals for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));

-- Extend the checked production operation; keep one implementation of stock posting.
alter function private.production_operation(uuid,text,uuid,jsonb) rename to production_operation_stock;
create function private.production_operation(p_branch uuid,p_action text,p_id uuid,p_body jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;x jsonb;i record;b public.stock_batches%rowtype;p public.inventory_purchases%rowtype;price numeric;evidence jsonb;
begin
 if p_action='production_save' then
  for x in select value from jsonb_array_elements(p_body->'draft'->'inputs') loop
   if x->>'planned_qty' is not null and (jsonb_typeof(x->'planned_qty') is distinct from 'number' or not((x->>'planned_qty')::numeric>=0 and (x->>'planned_qty')::numeric<1e9)) then raise exception 'Invalid planned ingredient quantity';end if;
  end loop;
 end if;
 result:=private.production_operation_stock(p_branch,p_action,p_id,p_body);
 if p_action='production_post' then
  for i in select * from public.inventory_production_inputs where run_id=p_id order by batch_id loop
   select * into b from public.stock_batches where id=i.batch_id;
   price:=null;evidence:=null;
   if b.purchase_id is not null then
    select * into p from public.inventory_purchases where id=b.purchase_id and branch_id=p_branch for share;
    if found and p.qty>0 and p.cost is not null then
     price:=p.cost/p.qty;evidence:=jsonb_build_object('kind','receipt','purchase_id',p.id,'purchase_qty',p.qty,'purchase_cost',p.cost,'tax_basis','unconfirmed','captured_at',clock_timestamp());
    end if;
   elsif b.production_id is not null then
    select case when count(*)>0 and count(*)=count(unit_cost) then sum(qty*unit_cost)/(select qty from public.inventory_production_runs where id=b.production_id) end into price from public.inventory_production_inputs where run_id=b.production_id;
    if price is not null then evidence:=jsonb_build_object('kind','production','run_id',b.production_id,'tax_basis','inherited_unconfirmed','captured_at',clock_timestamp());end if;
   end if;
   update public.inventory_production_inputs set planned_qty=(select (v->>'planned_qty')::numeric from jsonb_array_elements(result->'draft'->'inputs') v where v->>'batch_id'=i.batch_id::text),unit_cost=price,cost_source=evidence where id=i.id;
  end loop;
 end if;
 return result;
end $$;
revoke all on function private.production_operation(uuid,text,uuid,jsonb) from public,anon,authenticated;

create function private.reverse_inventory_production(p_branch uuid,p_id uuid,p_command uuid,p_reason text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare r public.inventory_production_runs%rowtype;b public.stock_batches%rowtype;i record;old public.inventory_production_reversals%rowtype;
begin
 if auth.uid() is null or not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() a where a=p_branch) then raise exception 'Production access denied' using errcode='42501';end if;
 if p_command is null or p_reviewed is distinct from true or length(trim(coalesce(p_reason,''))) not between 3 and 1000 then raise exception 'Confirm mistaken posting and reason';end if;
 perform pg_advisory_xact_lock(hashtextextended('production-reversal:'||p_command::text,0));
 select * into old from public.inventory_production_reversals where id=p_command;
 if found then
  if old.run_id<>p_id or old.branch_id<>p_branch or old.reason<>trim(p_reason) or old.actor_id<>auth.uid() then raise exception 'Reversal command conflict' using errcode='23505';end if;return old.id;
 end if;
 select * into r from public.inventory_production_runs where id=p_id and branch_id=p_branch for update;
 if not found or r.status<>'posted' or r.reversed_at is not null then raise exception 'Posted production unavailable' using errcode='23505';end if;
 select * into b from public.stock_batches where id=r.output_batch_id for update;
 if not found or b.status<>'active' or b.remaining_qty<>b.qty or exists(select 1 from public.stock_batch_actions where batch_id=b.id and action<>'expiry_recorded') or exists(select 1 from public.inventory_production_inputs pi join public.inventory_production_runs t on t.id=pi.run_id where pi.batch_id=b.id and t.reversed_at is null) then raise exception 'Finished stock has moved; reversal blocked' using errcode='23505';end if;
 -- Transfers currently identify products rather than lots: refuse ambiguous reversals.
 if exists(select 1 from public.stock_transfers where from_branch_id=p_branch and product=r.product and category is not distinct from r.category and unit is not distinct from r.unit and status in('sent','received') and created_at>=r.posted_at) then raise exception 'Finished-product transfer must be reconciled first';end if;
 for i in select * from public.inventory_production_inputs where run_id=p_id order by batch_id loop
  perform 1 from public.stock_batches where id=i.batch_id and branch_id=p_branch for update;
  if not exists(select 1 from public.stock_batches where id=i.batch_id and status in('active','used') and remaining_qty+i.qty<=qty) then raise exception 'Ingredient balance cannot be restored';end if;
  update public.stock_batches set remaining_qty=remaining_qty+i.qty,status='active',closed_at=null,closed_by=null where id=i.batch_id;
 end loop;
 update public.stock_batches set remaining_qty=0,status='used',closed_at=clock_timestamp(),closed_by=auth.uid() where id=r.output_batch_id;
 insert into public.inventory_production_reversals(id,run_id,branch_id,reason,actor_id) values(p_command,p_id,p_branch,trim(p_reason),auth.uid());
 update public.inventory_production_runs set reversed_at=clock_timestamp(),revision=revision+1 where id=p_id;
 insert into public.stock_events(source_table,source_id,operation,branch_ids,before_row,after_row,actor_id) values('inventory_production_runs',p_id,'UPDATE',array[p_branch],to_jsonb(r),(select to_jsonb(t) from public.inventory_production_runs t where id=p_id),auth.uid());
 return p_command;
end $$;
revoke all on function private.reverse_inventory_production(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
create function public.reverse_inventory_production(p_branch uuid,p_id uuid,p_command uuid,p_reason text,p_reviewed boolean) returns uuid language sql security definer set search_path='' as $$select private.reverse_inventory_production(p_branch,p_id,p_command,p_reason,p_reviewed)$$;
revoke all on function public.reverse_inventory_production(uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function public.reverse_inventory_production(uuid,uuid,uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
