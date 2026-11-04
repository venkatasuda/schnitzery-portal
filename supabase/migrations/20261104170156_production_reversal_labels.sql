begin;
set local lock_timeout='3s';
create or replace function private.reverse_inventory_production(p_branch uuid,p_id uuid,p_command uuid,p_reason text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
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
 update public.stock_batches set remaining_qty=0,status='used',note='Reversed mistaken production',closed_at=clock_timestamp(),closed_by=auth.uid() where id=r.output_batch_id;
 insert into public.inventory_production_reversals(id,run_id,branch_id,reason,actor_id) values(p_command,p_id,p_branch,trim(p_reason),auth.uid());
 update public.inventory_production_runs set reversed_at=clock_timestamp(),revision=revision+1 where id=p_id;
 insert into public.stock_events(source_table,source_id,operation,branch_ids,before_row,after_row,actor_id) values('inventory_production_runs',p_id,'UPDATE',array[p_branch],to_jsonb(r),(select to_jsonb(t) from public.inventory_production_runs t where id=p_id),auth.uid());
 return p_command;
end $$;
revoke all on function private.reverse_inventory_production(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
update public.stock_batches b set note='Reversed mistaken production' from public.inventory_production_runs r where b.production_id=r.id and r.reversed_at is not null and b.remaining_qty=0;
notify pgrst,'reload schema';
commit;
