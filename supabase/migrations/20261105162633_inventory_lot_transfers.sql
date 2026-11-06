begin;
set local lock_timeout='3s';
create table public.inventory_transfer_lots (
 id uuid primary key default gen_random_uuid(), transfer_id uuid not null references public.stock_transfers(id),
 source_batch_id uuid not null references public.stock_batches(id), destination_batch_id uuid unique references public.stock_batches(id),
 from_branch_id uuid not null references public.branches(id), to_branch_id uuid not null references public.branches(id),
 product text not null, category text, unit text, lot_number text not null, expiry_date date, expiry_note text not null,
 sent_qty numeric not null check(sent_qty>0 and sent_qty<1e9), received_qty numeric check(received_qty>=0 and received_qty<=sent_qty),
 unit_cost numeric check(unit_cost>=0 and unit_cost<1e9), created_at timestamptz not null default clock_timestamp(),
 unique(transfer_id,source_batch_id), check(from_branch_id<>to_branch_id),
 check((received_qty is null or received_qty=0)=(destination_batch_id is null))
);
create index transfer_lots_source on public.inventory_transfer_lots(source_batch_id);
alter table public.stock_batches add column transfer_lot_id uuid unique references public.inventory_transfer_lots(id);
create table public.inventory_transfer_commands (
 id uuid primary key, transfer_id uuid not null references public.stock_transfers(id), branch_id uuid not null references public.branches(id),
 actor_id uuid not null references public.users(id), request jsonb not null, created_at timestamptz not null default clock_timestamp()
);
alter table public.inventory_transfer_lots enable row level security;
alter table public.inventory_transfer_commands enable row level security;
revoke all on public.inventory_transfer_lots,public.inventory_transfer_commands from public,anon,authenticated;
grant select on public.inventory_transfer_lots,public.inventory_transfer_commands to authenticated;
create policy transfer_lots_read on public.inventory_transfer_lots for select to authenticated using(
 public.is_manager() and exists(select 1 from public.users where id=auth.uid() and status='active') and
 (from_branch_id in(select public.accessible_branch_ids()) or to_branch_id in(select public.accessible_branch_ids())));
create policy transfer_commands_read on public.inventory_transfer_commands for select to authenticated using(
 public.is_manager() and exists(select 1 from public.users where id=auth.uid() and status='active') and branch_id in(select public.accessible_branch_ids()));

create function private.inventory_batch_cost(p_batch uuid) returns numeric language sql stable security invoker set search_path='' as $$
 select case when b.purchase_id is not null then (select p.cost/nullif(p.qty,0) from public.inventory_purchases p where p.id=b.purchase_id)
 when b.production_id is not null then (select case when count(*)>0 and count(*)=count(i.unit_cost) then sum(i.qty*i.unit_cost)/nullif(r.qty,0) end from public.inventory_production_inputs i join public.inventory_production_runs r on r.id=i.run_id where i.run_id=b.production_id group by r.qty)
 when b.transfer_lot_id is not null then (select t.unit_cost from public.inventory_transfer_lots t where t.id=b.transfer_lot_id) end
 from public.stock_batches b where b.id=p_batch
$$;
revoke all on function private.inventory_batch_cost(uuid) from public,anon,authenticated;

create function private.guard_lot_transfer() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.status='sent' and old.status='requested' then
  if (select coalesce(sum(sent_qty),0) from public.inventory_transfer_lots where transfer_id=new.id)<>new.qty then raise exception 'Allocate exact source batches before dispatch' using errcode='23505';end if;
 elsif new.status='received' and old.status='sent' and exists(select 1 from public.inventory_transfer_lots where transfer_id=new.id) then
  if exists(select 1 from public.inventory_transfer_lots where transfer_id=new.id and received_qty is null) or
   (select sum(received_qty) from public.inventory_transfer_lots where transfer_id=new.id) is distinct from new.received_qty then raise exception 'Receive each dispatched lot' using errcode='23505';end if;
 end if;
 return new;
end $$;
-- Invoker is essential on batch INSERT: checked definer workflows may set lineage; browsers cannot.
create function private.guard_batch_transfer_link() returns trigger language plpgsql security invoker set search_path='' as $$
begin if current_user='authenticated' and new.transfer_lot_id is not null then raise exception 'Use transfer receipt' using errcode='42501';end if;return new;end $$;
revoke all on function private.guard_lot_transfer(),private.guard_batch_transfer_link() from public,anon,authenticated;
create trigger transfer_workflow_lot_guard before update on public.stock_transfers for each row execute function private.guard_lot_transfer();
create trigger batch_transfer_link_guard before insert on public.stock_batches for each row execute function private.guard_batch_transfer_link();

create function private.post_lot_transfer(p_branch uuid,p_transfer uuid,p_command uuid,p_action text,p_lines jsonb,p_note text) returns uuid
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare t public.stock_transfers%rowtype;b public.stock_batches%rowtype;l public.inventory_transfer_lots%rowtype;x jsonb;n numeric;total numeric:=0;out_id uuid;req jsonb;old public.inventory_transfer_commands%rowtype;
begin
 perform private.require_price_manager(p_branch);
 if p_command is null or p_action is null or p_action not in('send','receive') or jsonb_typeof(p_lines) is distinct from 'array' or jsonb_array_length(p_lines) not between 1 and 100 or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Review lots and provide a reference';end if;
 req:=jsonb_build_object('branch',p_branch,'transfer',p_transfer,'action',p_action,'lines',p_lines,'note',trim(p_note));
 perform pg_advisory_xact_lock(hashtextextended('lot-transfer-command:'||p_command::text,0));
 select * into old from public.inventory_transfer_commands where id=p_command;
 if found then if old.request<>req or old.actor_id<>auth.uid() then raise exception 'Transfer retry conflict' using errcode='23505';end if;return p_transfer;end if;
 select * into t from public.stock_transfers where id=p_transfer for update;
 if not found or (case p_action when 'send' then t.from_branch_id else t.to_branch_id end)<>p_branch then raise exception 'Transfer access denied' using errcode='42501';end if;
 if t.status<>(case p_action when 'send' then 'requested' else 'sent' end) then raise exception 'Transfer changed; reload' using errcode='23505';end if;
 if (select count(*) from public.branches where id in(t.from_branch_id,t.to_branch_id) and is_active)<>2 then raise exception 'Both transfer branches must be active';end if;
 if (select count(*) from jsonb_array_elements(p_lines))<>(select count(distinct v->>'id') from jsonb_array_elements(p_lines) v) then raise exception 'Duplicate lot';end if;
 for x in select value from jsonb_array_elements(p_lines) order by value->>'id' loop
  if jsonb_typeof(x->'qty') is distinct from 'number' then raise exception 'Invalid lot quantity';end if;
  n:=(x->>'qty')::numeric;
  if n is null or not(n>=0 and n<1e9) then raise exception 'Invalid lot quantity';end if;
  if p_action='send' then
   select * into b from public.stock_batches where id=(x->>'id')::uuid and branch_id=p_branch for update;
   if not found or b.status<>'active' or n<=0 or n>b.remaining_qty or b.product<>t.product or b.category is distinct from t.category or lower(trim(coalesce(b.unit,'')))<>lower(trim(coalesce(t.unit,''))) or b.expiry_date<(now() at time zone 'Europe/Berlin')::date then raise exception 'Source batch unavailable, expired, or quantity changed' using errcode='23505';end if;
   insert into public.inventory_transfer_lots(transfer_id,source_batch_id,from_branch_id,to_branch_id,product,category,unit,lot_number,expiry_date,expiry_note,sent_qty,unit_cost)
   values(t.id,b.id,t.from_branch_id,t.to_branch_id,b.product,b.category,b.unit,b.lot_number,b.expiry_date,b.expiry_note,n,private.inventory_batch_cost(b.id));
   update public.stock_batches set remaining_qty=remaining_qty-n,status=case when remaining_qty=n then 'used' else 'active' end,closed_by=case when remaining_qty=n then auth.uid() else null end,closed_at=case when remaining_qty=n then clock_timestamp() else null end where id=b.id;
  else
   select * into l from public.inventory_transfer_lots where id=(x->>'id')::uuid and transfer_id=t.id for update;
   if not found or l.received_qty is not null or n>l.sent_qty then raise exception 'Dispatched lot changed' using errcode='23505';end if;
   out_id:=null;
   if n>0 then
    out_id:=gen_random_uuid();
    insert into public.stock_batches(id,branch_id,product,category,unit,qty,expiry_date,received_date,note,status,lot_number,expiry_note,receipt_reference,transfer_lot_id)
    values(out_id,p_branch,l.product,l.category,l.unit,n,l.expiry_date,(now() at time zone 'Europe/Berlin')::date,trim(p_note),'active',l.lot_number,l.expiry_note,'Transfer '||t.id,l.id);
   end if;
   update public.inventory_transfer_lots set received_qty=n,destination_batch_id=out_id where id=l.id;
  end if;
  total:=total+n;
 end loop;
 if p_action='send' then
  if total<>t.qty then raise exception 'Allocated quantities must equal the requested quantity';end if;
  update public.stock_transfers set status='sent',updated_at=clock_timestamp() where id=t.id;
 else
  if (select count(*) from public.inventory_transfer_lots where transfer_id=t.id)<>jsonb_array_length(p_lines) then raise exception 'Review every dispatched lot';end if;
  update public.stock_transfers set status='received',received_qty=total,receipt_note=trim(p_note),updated_at=clock_timestamp() where id=t.id;
 end if;
 insert into public.inventory_transfer_commands(id,transfer_id,branch_id,actor_id,request) values(p_command,t.id,p_branch,auth.uid(),req);
 return t.id;
end $$;
revoke all on function private.post_lot_transfer(uuid,uuid,uuid,text,jsonb,text) from public,anon,authenticated;
create function public.post_lot_transfer(p_branch uuid,p_transfer uuid,p_command uuid,p_action text,p_lines jsonb,p_note text) returns uuid language sql security invoker set search_path='' as $$select private.post_lot_transfer(p_branch,p_transfer,p_command,p_action,p_lines,p_note)$$;
revoke all on function public.post_lot_transfer(uuid,uuid,uuid,text,jsonb,text) from public,anon;
grant execute on function private.post_lot_transfer(uuid,uuid,uuid,text,jsonb,text),public.post_lot_transfer(uuid,uuid,uuid,text,jsonb,text) to authenticated;
create or replace function private.production_operation(p_branch uuid,p_action text,p_id uuid,p_body jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
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
   elsif b.transfer_lot_id is not null then
    price:=private.inventory_batch_cost(b.id);
    if price is not null then evidence:=jsonb_build_object('kind','transfer','transfer_lot_id',b.transfer_lot_id,'tax_basis','inherited_unconfirmed','captured_at',clock_timestamp());end if;
   end if;
   update public.inventory_production_inputs set planned_qty=(select (v->>'planned_qty')::numeric from jsonb_array_elements(result->'draft'->'inputs') v where v->>'batch_id'=i.batch_id::text),unit_cost=price,cost_source=evidence where id=i.id;
  end loop;
 end if;
 return result;
end $$;
notify pgrst,'reload schema';
commit;
