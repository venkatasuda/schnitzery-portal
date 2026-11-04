begin;
set local lock_timeout='3s';
alter table public.inventory_purchases alter column cost drop not null;
alter table public.inventory_receipt_lines alter column cost drop not null;
alter table public.inventory_purchases add column delivery_command uuid references public.inventory_operation_events(id) deferrable initially deferred;
create index purchases_delivery_command on public.inventory_purchases(delivery_command);
create unique index direct_delivery_invoice on public.inventory_operation_events(branch_id,lower(trim(request->>'supplier')),trim(request->>'invoice')) where action='receive_direct';
alter table public.inventory_receipts add column received_date date;
update public.inventory_receipts set received_date=(received_at at time zone 'Europe/Berlin')::date;
alter table public.inventory_receipts alter column received_date set not null, alter column received_date set default ((now() at time zone 'Europe/Berlin')::date);
alter table public.stock_batches alter column expiry_date drop not null;
alter table public.stock_batches add column remaining_qty numeric,
 add column receipt_line_id uuid references public.inventory_receipt_lines(id),
 add column purchase_id uuid references public.inventory_purchases(id),
 add column lot_number text not null default '' check(length(lot_number)<=160),
 add column expiry_note text not null default '' check(length(expiry_note)<=500),
 add column receipt_reference text not null default '';
update public.stock_batches set remaining_qty=case when status='active' then qty else 0 end;
update public.stock_batches set expiry_note='Missing legacy expiry date' where expiry_date is null;
alter table public.stock_batches alter column remaining_qty set not null;
alter table public.stock_batches add constraint batch_remaining_valid check(remaining_qty>=0 and remaining_qty<=qty),
 add constraint batch_unknown_expiry_reason check(expiry_date is not null or length(trim(expiry_note))>=3),
 add constraint batch_expiry_finite check(expiry_date is null or isfinite(expiry_date)),
 add constraint batch_state_remaining check((status='active' and remaining_qty>0) or (status<>'active' and remaining_qty=0));
create index batch_receipt_line on public.stock_batches(receipt_line_id);
create index batch_purchase on public.stock_batches(purchase_id);
create index batch_branch_expiry on public.stock_batches(branch_id,expiry_date,id) where status='active';
drop policy if exists batches_select on public.stock_batches;
create policy batches_select on public.stock_batches for select to authenticated using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));

create function private.initialize_stock_batch() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' and (new.receipt_line_id is not null or new.purchase_id is not null) then raise exception 'Receipt batches require receiving workflow' using errcode='42501'; end if;
 if current_user='authenticated' then new.receipt_reference:='';end if;
 new.remaining_qty:=new.qty;
 return new;
end $$;
revoke all on function private.initialize_stock_batch() from public,anon,authenticated;
create trigger initialize_stock_batch before insert on public.stock_batches for each row execute function private.initialize_stock_batch();
create or replace function private.guard_batch_update() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user<>'authenticated' then return new; end if;
 if old.status<>'active' or new.status<>'used' or (to_jsonb(new)-array['status','closed_by','closed_at']) is distinct from (to_jsonb(old)-array['status','closed_by','closed_at']) then raise exception 'permission denied: use the batch workflow' using errcode='42501'; end if;
 new.remaining_qty:=0;new.closed_by:=auth.uid();new.closed_at:=now();return new;
end $$;

create function private.register_purchase_batches(p_purchase uuid,p_receipt_line uuid,p_lots jsonb,p_reference text) returns void language plpgsql security invoker set search_path='' as $$
declare r public.inventory_purchases%rowtype;lot jsonb;quantity numeric;total numeric:=0;expiry date;reason text;
begin
 select * into r from public.inventory_purchases where id=p_purchase;
 if not found then raise exception 'Purchase unavailable';end if;
 if p_lots is null then p_lots:=jsonb_build_array(jsonb_build_object('qty',r.qty,'lot','','expiry',null,'expiry_note','Expiry not captured by legacy delivery entry'));end if;
 if jsonb_typeof(p_lots) is distinct from 'array' or jsonb_array_length(p_lots) not between 1 and 100 then raise exception 'Add receipt batches';end if;
 for lot in select value from jsonb_array_elements(p_lots) loop
  if jsonb_typeof(lot) is distinct from 'object' or jsonb_typeof(lot->'qty') is distinct from 'number' then raise exception 'Invalid batch quantity';end if;
  quantity:=(lot->>'qty')::numeric;expiry:=nullif(lot->>'expiry','')::date;reason:=trim(coalesce(lot->>'expiry_note',''));
  if expiry is not null and coalesce(lot->>'expiry','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Use a calendar expiry date';end if;
  if quantity is null or not(quantity>0 and quantity<1e9) or length(coalesce(lot->>'lot',''))>160 or length(reason)>500 or (expiry is not null and not isfinite(expiry)) or (expiry is null and length(reason)<3) then raise exception 'Batch quantity, expiry or missing-expiry reason invalid';end if;
  total:=total+quantity;
  insert into public.stock_batches(branch_id,product,category,unit,qty,expiry_date,received_date,note,status,logged_by,logged_by_name,receipt_line_id,purchase_id,lot_number,expiry_note,receipt_reference)
  values(r.branch_id,r.product,r.category,r.unit,quantity,expiry,r.purchase_date,'Linked delivery receipt','active',auth.uid(),(select full_name from public.users where id=auth.uid()),p_receipt_line,r.id,trim(coalesce(lot->>'lot','')),case when expiry is null then reason else '' end,coalesce(p_reference,''));
 end loop;
 if total<>r.qty then raise exception 'Batch quantities must equal accepted delivery quantity';end if;
end $$;
revoke all on function private.register_purchase_batches(uuid,uuid,jsonb,text) from public,anon,authenticated;
create function private.create_receipt_batches(p_receipt uuid,p_line uuid,p_lots jsonb) returns void language plpgsql security invoker set search_path='' as $$
declare r record;
begin
 select rl.accepted,rl.id,rl.purchase_id,receipt.invoice into r from public.inventory_receipt_lines rl join public.inventory_receipts receipt on receipt.id=rl.receipt_id where rl.receipt_id=p_receipt and rl.order_line_id=p_line;
 if not found then raise exception 'Receipt line unavailable';end if;
 if r.accepted=0 then
  if p_lots is not null and p_lots<>'[]'::jsonb then raise exception 'Rejected goods cannot create stock batches';end if;return;
 end if;
 perform private.register_purchase_batches(r.purchase_id,r.id,p_lots,r.invoice);
end $$;
revoke all on function private.create_receipt_batches(uuid,uuid,jsonb) from public,anon,authenticated;
create function private.track_legacy_delivery() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is not null and new.receipt_id is null and new.delivery_command is null then
  if not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=new.branch_id) then raise exception 'Delivery access denied' using errcode='42501';end if;
  perform private.register_purchase_batches(new.id,null,null,'Legacy delivery');
 end if;return new;
end $$;
revoke all on function private.track_legacy_delivery() from public,anon,authenticated;
create trigger track_legacy_delivery after insert on public.inventory_purchases for each row execute function private.track_legacy_delivery();
create function private.guard_received_purchase() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if current_user='authenticated' then
  if tg_op='INSERT' then
   if new.receipt_id is not null or new.order_line_id is not null or new.delivery_command is not null then raise exception 'Use the receiving workflow' using errcode='42501';end if;
  elsif old.receipt_id is not null or old.delivery_command is not null or exists(select 1 from public.stock_batches where purchase_id=old.id) or (tg_op='UPDATE' and (new.receipt_id is not null or new.delivery_command is not null or new.order_line_id is not null)) then
   raise exception 'Received delivery evidence is immutable; use a checked correction workflow' using errcode='42501';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.guard_received_purchase() from public,anon,authenticated;
create trigger guard_received_purchase before insert or update or delete on public.inventory_purchases for each row execute function private.guard_received_purchase();
create table public.stock_batch_actions(
 id uuid primary key,batch_id uuid not null references public.stock_batches(id),branch_id uuid not null references public.branches(id),
 action text not null check(action in('used','discarded','expiry_recorded')),qty numeric not null check((action='expiry_recorded' and qty=0) or (action in('used','discarded') and qty>0 and qty<1e9)),note text not null check(length(note)<=1000),
 actor_id uuid not null references public.users(id),recorded_at timestamptz not null default clock_timestamp(),request jsonb not null
);
create index batch_actions_batch on public.stock_batch_actions(batch_id,recorded_at,id);
alter table public.stock_batch_actions enable row level security;
revoke all on public.stock_batch_actions from public,anon,authenticated;
grant select on public.stock_batch_actions to authenticated;
create policy batch_actions_read on public.stock_batch_actions for select to authenticated using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create function private.consume_stock_batch(p_branch uuid,p_id uuid,p_command uuid,p_action text,p_qty numeric,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare b public.stock_batches%rowtype;old public.stock_batch_actions%rowtype;req jsonb;actor_name text;
begin
 select full_name into actor_name from public.users where id=auth.uid() and status='active';
 if not found or not exists(select 1 from public.accessible_branch_ids() x where x=p_branch) then raise exception 'Batch unavailable' using errcode='42501'; end if;
 if p_command is null or p_action is null or p_action not in('used','discarded') or p_qty is null or not(p_qty>0 and p_qty<1e9) or p_note is null or length(p_note)>1000 or (p_action='discarded' and length(trim(p_note))<3) then raise exception 'Invalid batch action'; end if;
 req:=jsonb_build_object('branch',p_branch,'batch',p_id,'action',p_action,'qty',p_qty,'note',p_note);
 perform pg_advisory_xact_lock(hashtextextended('batch-command:'||p_command::text,0));
 select * into old from public.stock_batch_actions where id=p_command;
 if found then
  if old.request<>req or old.actor_id<>auth.uid() then raise exception 'Batch command conflict' using errcode='23505';end if;return;
 end if;
 select * into b from public.stock_batches where id=p_id and branch_id=p_branch for update;
 if not found then raise exception 'Batch unavailable' using errcode='42501';end if;
 if b.status<>'active' or p_qty>b.remaining_qty then raise exception 'Batch changed; reload remaining quantity' using errcode='23505';end if;
 if p_action='discarded' then
  insert into public.waste_log(branch_id,product,category,qty,unit,reason,note,logged_by,logged_by_name,work_date)
  values(b.branch_id,b.product,b.category,p_qty,b.unit,case when b.expiry_date<((now() at time zone 'Europe/Berlin')::date) then 'expired' else 'other' end,concat('Batch ',b.id,' · ',p_note),auth.uid(),actor_name,(now() at time zone 'Europe/Berlin')::date);
 end if;
 update public.stock_batches set remaining_qty=b.remaining_qty-p_qty,status=case when b.remaining_qty=p_qty then p_action else 'active' end,closed_by=case when b.remaining_qty=p_qty then auth.uid() else null end,closed_at=case when b.remaining_qty=p_qty then now() else null end where id=b.id;
 insert into public.stock_batch_actions(id,batch_id,branch_id,action,qty,note,actor_id,request) values(p_command,b.id,b.branch_id,p_action,p_qty,p_note,auth.uid(),req);
end $$;
revoke all on function private.consume_stock_batch(uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function private.consume_stock_batch(uuid,uuid,uuid,text,numeric,text) to authenticated;
create function public.consume_stock_batch(p_branch uuid,p_id uuid,p_command uuid,p_action text,p_qty numeric,p_note text) returns void language sql security invoker set search_path='' as $$select private.consume_stock_batch(p_branch,p_id,p_command,p_action,p_qty,p_note)$$;
revoke all on function public.consume_stock_batch(uuid,uuid,uuid,text,numeric,text) from public,anon;
grant execute on function public.consume_stock_batch(uuid,uuid,uuid,text,numeric,text) to authenticated;
create function private.resolve_stock_batch_expiry(p_branch uuid,p_id uuid,p_command uuid,p_expiry date,p_note text) returns void language plpgsql security definer set search_path='' as $$
declare b public.stock_batches%rowtype;old public.stock_batch_actions%rowtype;req jsonb;
begin
 if not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() x where x=p_branch) then raise exception 'Manager batch access required' using errcode='42501';end if;
 if p_command is null or p_expiry is null or not isfinite(p_expiry) or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Label date and evidence required';end if;
 req:=jsonb_build_object('branch',p_branch,'batch',p_id,'expiry',p_expiry,'note',p_note);
 perform pg_advisory_xact_lock(hashtextextended('batch-command:'||p_command::text,0));
 select * into old from public.stock_batch_actions where id=p_command;
 if found then
  if old.action<>'expiry_recorded' or old.actor_id<>auth.uid() or old.request-'before'<>req then raise exception 'Batch command conflict' using errcode='23505';end if;return;
 end if;
 select * into b from public.stock_batches where id=p_id and branch_id=p_branch for update;
 if not found then raise exception 'Batch unavailable' using errcode='42501';end if;
 if b.status<>'active' or b.expiry_date is not null then raise exception 'Only missing expiry evidence on active batches can be resolved' using errcode='23505';end if;
 update public.stock_batches set expiry_date=p_expiry,expiry_note='' where id=b.id;
 insert into public.stock_batch_actions(id,batch_id,branch_id,action,qty,note,actor_id,request) values(p_command,b.id,b.branch_id,'expiry_recorded',0,p_note,auth.uid(),req||jsonb_build_object('before',jsonb_build_object('expiry',b.expiry_date,'expiry_note',b.expiry_note)));
end $$;
revoke all on function private.resolve_stock_batch_expiry(uuid,uuid,uuid,date,text) from public,anon;
grant execute on function private.resolve_stock_batch_expiry(uuid,uuid,uuid,date,text) to authenticated;
create function public.resolve_stock_batch_expiry(p_branch uuid,p_id uuid,p_command uuid,p_expiry date,p_note text) returns void language sql security invoker set search_path='' as $$select private.resolve_stock_batch_expiry(p_branch,p_id,p_command,p_expiry,p_note)$$;
revoke all on function public.resolve_stock_batch_expiry(uuid,uuid,uuid,date,text) from public,anon;
grant execute on function public.resolve_stock_batch_expiry(uuid,uuid,uuid,date,text) to authenticated;
create or replace function private.close_stock_batch(p_id uuid,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare b public.stock_batches%rowtype;
begin
 if not exists(select 1 from public.users where id=auth.uid() and status='active') then raise exception 'Active account required' using errcode='42501';end if;
 select * into b from public.stock_batches where id=p_id for update;
 if not found or not exists(select 1 from public.accessible_branch_ids() x where x=b.branch_id) then raise exception 'Batch unavailable' using errcode='42501';end if;
 if p_status is null or p_status not in('used','discarded') then raise exception 'Batch action denied' using errcode='42501';end if;
 if b.status=p_status then return;end if;
 if b.status<>'active' then raise exception 'Batch already closed' using errcode='23505';end if;
 perform private.consume_stock_batch(b.branch_id,b.id,gen_random_uuid(),p_status,b.remaining_qty,'Full batch closure');
end $$;
create or replace function private.inventory_operation(p_branch uuid,p_command uuid,p_action text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare actor uuid:=auth.uid(); previous public.inventory_operation_events%rowtype; product_row public.inventory_master%rowtype;
 supplier public.inventory_suppliers%rowtype; po public.inventory_orders%rowtype; ln public.inventory_order_lines%rowtype;
 waste public.waste_log%rowtype; transfer public.stock_transfers%rowtype; original jsonb; result jsonb; x jsonb; obj_id uuid; new_id uuid; purchase uuid;
 accepted numeric; rejected numeric; line_cost numeric; amount numeric; total_lines integer; note text; actor_name text;
begin
 if actor is null or not public.is_manager() or not exists(select 1 from public.users where id=actor and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=p_branch) then raise exception 'Inventory access denied' using errcode='42501'; end if;
 if p_command is null or p_action is null or jsonb_typeof(p_body) is distinct from 'object' then raise exception 'Invalid command'; end if;
 if octet_length(p_body::text)>1048576 then raise exception 'Inventory command too large';end if;
 perform pg_advisory_xact_lock(hashtextextended('inventory-command:'||p_command::text,0));
 select * into previous from public.inventory_operation_events where id=p_command;
 if found then
   if previous.branch_id<>p_branch or previous.action<>p_action or previous.request<>p_body then raise exception 'Command key already used' using errcode='23505'; end if;
   return previous.result;
 end if;
 -- ponytail: serialize writes per branch; split by order/product only if branch write contention warrants it.
 perform pg_advisory_xact_lock(hashtextextended('inventory-operations:'||p_branch::text,0));
 select full_name into actor_name from public.users where id=actor;
 obj_id:=coalesce((p_body->>'id')::uuid,p_command); note:=trim(coalesce(p_body->>'note',''));
 if length(note)>1000 then raise exception 'Note too long'; end if;
 if p_action='receive_direct' then
   if length(trim(coalesce(p_body->>'supplier',''))) not between 1 and 160 or length(trim(coalesce(p_body->>'invoice',''))) not between 1 and 160 or (p_body->>'received_date')::date not between date '2000-01-01' and (now() at time zone 'Europe/Berlin')::date or coalesce(p_body->>'received_date','') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then raise exception 'Supplier, invoice and valid delivery date required';end if;
   if jsonb_typeof(p_body->'lines') is distinct from 'array' or jsonb_array_length(p_body->'lines') not between 1 and 500 then raise exception 'Delivery lines required';end if;
   if (select count(*) from jsonb_array_elements(p_body->'lines'))<>(select count(distinct v->>'product_id') from jsonb_array_elements(p_body->'lines') v) then raise exception 'Duplicate delivery product';end if;
   if exists(select 1 from public.inventory_receipts receipt join public.inventory_orders o on o.id=receipt.order_id where o.branch_id=p_branch and lower(trim(o.supplier_name))=lower(trim(p_body->>'supplier')) and trim(receipt.invoice)=trim(p_body->>'invoice')) then raise exception 'Delivery reference already received against an order' using errcode='23505';end if;
   result:=jsonb_build_object('id',p_command,'status','recorded','lines','[]'::jsonb);
   for x in select value from jsonb_array_elements(p_body->'lines') loop
    select * into product_row from public.inventory_master where id=(x->>'product_id')::uuid and branch_id=p_branch and is_active for share;
    if not found then raise exception 'Choose an active branch product';end if;
    accepted:=(x->>'accepted')::numeric;rejected:=(x->>'rejected')::numeric;line_cost:=(x->>'cost')::numeric;
    if accepted is null or rejected is null or not(accepted>=0 and accepted<1e9 and rejected>=0 and rejected<1e9) or accepted+rejected=0 or (line_cost is not null and not(line_cost>=0 and line_cost<1e9)) or (accepted=0 and coalesce(line_cost,0)<>0) or (rejected>0 and length(trim(coalesce(x->>'note','')))<3) or length(coalesce(x->>'note',''))>1000 then raise exception 'Invalid delivery quantity, cost or rejection reason';end if;
    purchase:=null;
    if accepted>0 then
     insert into public.inventory_purchases(branch_id,product,category,unit,qty,cost,supplier,note,created_by,purchase_date,delivery_command)
     values(p_branch,product_row.product,product_row.category,product_row.unit,accepted,line_cost,trim(p_body->>'supplier'),concat('Receipt ',p_body->>'invoice',' · ',note),actor_name,(p_body->>'received_date')::date,p_command) returning id into purchase;
     perform private.register_purchase_batches(purchase,null,x->'batches',trim(p_body->>'invoice'));
    elsif x->'batches' is not null and x->'batches'<>'[]'::jsonb then raise exception 'Rejected goods cannot create stock batches';end if;
    result:=jsonb_set(result,'{lines}',(result->'lines')||jsonb_build_array(jsonb_build_object('product',product_row.product,'category',product_row.category,'unit',product_row.unit,'accepted',accepted,'rejected',rejected,'cost',line_cost,'purchase_id',purchase)));
   end loop;
 elsif p_action='supplier_save' then
   select * into supplier from public.inventory_suppliers where id=obj_id for update;
   if found and (supplier.branch_id<>p_branch or supplier.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Supplier changed' using errcode='23505'; end if;
   original:=to_jsonb(supplier);
   if length(coalesce(p_body->>'email',''))>254 then raise exception 'Invalid email'; end if;
   insert into public.inventory_suppliers(id,branch_id,name,email,lead_days,is_active,revision)
    values(obj_id,p_branch,trim(p_body->>'name'),coalesce(p_body->>'email',''),coalesce((p_body->>'lead_days')::integer,0),coalesce((p_body->>'is_active')::boolean,true),0)
    on conflict(id) do update set name=excluded.name,email=excluded.email,lead_days=excluded.lead_days,is_active=excluded.is_active,revision=public.inventory_suppliers.revision+1 returning to_jsonb(inventory_suppliers) into result;
 elsif p_action='product_save' then
   select * into product_row from public.inventory_master where id=obj_id for update;
   if found and (product_row.branch_id<>p_branch or product_row.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Product changed' using errcode='23505'; end if;
   original:=to_jsonb(product_row);
   if length(trim(coalesce(p_body->>'product',''))) not between 1 and 160 or length(trim(coalesce(p_body->>'category',''))) not between 1 and 100 or length(coalesce(p_body->>'unit',''))>30 then raise exception 'Product, category and unit are invalid'; end if;
   amount:=(p_body->>'soll')::numeric;
   if amount is null or not(amount>=0 and amount<'Infinity'::numeric) then raise exception 'Valid product target required';end if;
   if p_body->>'supplier_id' is not null and not exists(select 1 from public.inventory_suppliers where id=(p_body->>'supplier_id')::uuid and branch_id=p_branch and is_active) then raise exception 'Choose an active supplier'; end if;
   -- Replacing an identity never rewrites counts, purchases or waste attached to the old name/unit.
   new_id:=obj_id;
   if product_row.id is not null and row(product_row.product,product_row.category,coalesce(product_row.unit,'')) is distinct from row(trim(p_body->>'product'),trim(p_body->>'category'),coalesce(p_body->>'unit','')) then
     update public.inventory_master set is_active=false,revision=revision+1 where id=obj_id;
     new_id:=gen_random_uuid();
   end if;
   insert into public.inventory_master(id,branch_id,product,category,unit,soll,reorder_point,reorder_qty,supplier_id,is_active)
    values(new_id,p_branch,trim(p_body->>'product'),trim(p_body->>'category'),nullif(p_body->>'unit',''),(p_body->>'soll')::numeric,(p_body->>'reorder_point')::numeric,(p_body->>'reorder_qty')::numeric,(p_body->>'supplier_id')::uuid,coalesce((p_body->>'is_active')::boolean,true))
    on conflict(id) do update set soll=excluded.soll,reorder_point=excluded.reorder_point,reorder_qty=excluded.reorder_qty,supplier_id=excluded.supplier_id,is_active=excluded.is_active,revision=public.inventory_master.revision+1 returning to_jsonb(inventory_master) into result;
 elsif p_action='po_save' then
   select * into po from public.inventory_orders where id=obj_id for update;
   if found and (po.branch_id<>p_branch or po.status<>'draft' or po.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Order changed or is no longer a draft' using errcode='23505'; end if;
   original:=jsonb_build_object('order',to_jsonb(po),'lines',(select jsonb_agg(to_jsonb(l)) from public.inventory_order_lines l where order_id=obj_id));
   select * into supplier from public.inventory_suppliers where id=(p_body->>'supplier_id')::uuid and branch_id=p_branch and is_active;
   if not found then raise exception 'Choose an active supplier'; end if;
   if jsonb_typeof(p_body->'lines') is distinct from 'array' or jsonb_array_length(p_body->'lines') not between 1 and 500 then raise exception 'Add 1 to 500 lines'; end if;
   insert into public.inventory_orders(id,branch_id,supplier_id,supplier_name,supplier_email,reference,expected_date,note,created_by)
    values(obj_id,p_branch,supplier.id,supplier.name,supplier.email,'PO-'||upper(left(obj_id::text,8)),(p_body->>'expected_date')::date,note,actor)
    on conflict(id) do update set supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,supplier_email=excluded.supplier_email,expected_date=excluded.expected_date,note=excluded.note,revision=public.inventory_orders.revision+1,updated_at=now();
   delete from public.inventory_order_lines where order_id=obj_id;
   for x in select * from jsonb_array_elements(p_body->'lines') loop
     select * into product_row from public.inventory_master where id=(x->>'product_id')::uuid and branch_id=p_branch and is_active;
     if not found then raise exception 'Product unavailable in this branch'; end if;
     insert into public.inventory_order_lines(order_id,product_id,product,category,unit,qty,unit_price)
      values(obj_id,product_row.id,product_row.product,product_row.category,product_row.unit,(x->>'qty')::numeric,(x->>'unit_price')::numeric);
   end loop;
   select to_jsonb(o) into result from public.inventory_orders o where id=obj_id;
 elsif p_action in ('po_approve','po_send','po_cancel','po_close','receive') then
   select * into po from public.inventory_orders where id=obj_id for update;
   if not found or po.branch_id<>p_branch then raise exception 'Order access denied' using errcode='42501'; end if;
   if po.revision is distinct from (p_body->>'revision')::integer then raise exception 'Order changed. Reload.' using errcode='23505'; end if;
   original:=to_jsonb(po);
   if p_action='receive' then
     if po.status not in ('sent','partial') then raise exception 'Only sent orders can be received'; end if;
     if length(trim(coalesce(p_body->>'invoice',''))) not between 1 and 160 or jsonb_typeof(p_body->'lines') is distinct from 'array' or jsonb_array_length(p_body->'lines') not between 1 and 500 then raise exception 'Invoice/reference and receipt lines required'; end if;
     if (select count(*) from jsonb_array_elements(p_body->'lines'))<>(select count(distinct receipt_item->>'id') from jsonb_array_elements(p_body->'lines') receipt_item) then raise exception 'Duplicate receipt line'; end if;
     if coalesce((p_body->>'received_date')::date,(now() at time zone 'Europe/Berlin')::date) not between date '2000-01-01' and (now() at time zone 'Europe/Berlin')::date then raise exception 'Invalid delivery date';end if;
     if exists(select 1 from public.inventory_operation_events e where e.branch_id=p_branch and e.action='receive_direct' and lower(trim(e.request->>'supplier'))=lower(trim(po.supplier_name)) and trim(e.request->>'invoice')=trim(p_body->>'invoice')) then raise exception 'Delivery reference already received directly' using errcode='23505';end if;
     insert into public.inventory_receipts(id,branch_id,order_id,invoice,note,received_by,received_date) values(p_command,p_branch,po.id,trim(p_body->>'invoice'),note,actor,coalesce((p_body->>'received_date')::date,(now() at time zone 'Europe/Berlin')::date));
     total_lines:=0;
     for x in select * from jsonb_array_elements(p_body->'lines') loop
       select * into ln from public.inventory_order_lines where id=(x->>'id')::uuid and order_id=po.id for update;
       if not found then raise exception 'Receipt line does not belong to this order'; end if;
       accepted:=(x->>'accepted')::numeric; rejected:=(x->>'rejected')::numeric; line_cost:=(x->>'cost')::numeric;
       if accepted is null or rejected is null or not(accepted>=0 and accepted<'Infinity'::numeric and rejected>=0 and rejected<'Infinity'::numeric) or (line_cost is not null and not(line_cost>=0 and line_cost<'Infinity'::numeric)) then raise exception 'Invalid receipt quantity or cost'; end if;
       if accepted=0 and coalesce(line_cost,0)<>0 then raise exception 'Cost must be zero when no goods are accepted'; end if;
       if accepted+rejected=0 then continue; end if;
       if (accepted<>ln.qty-ln.received_qty or rejected>0) and length(trim(coalesce(x->>'note','')))<3 then raise exception 'Explain partial delivery, over-delivery or rejected goods'; end if;
       total_lines:=total_lines+1; purchase:=null;
       if accepted>0 then
         insert into public.inventory_purchases(branch_id,product,category,unit,qty,cost,supplier,note,created_by,receipt_id,order_line_id,purchase_date)
          values(p_branch,ln.product,ln.category,ln.unit,accepted,line_cost,po.supplier_name,concat('Receipt ',p_body->>'invoice',' · ',note),actor_name,p_command,ln.id,(select received_date from public.inventory_receipts where id=p_command)) returning id into purchase;
       end if;
       insert into public.inventory_receipt_lines(receipt_id,order_line_id,accepted,rejected,cost,note,purchase_id)
        values(p_command,ln.id,accepted,rejected,line_cost,coalesce(x->>'note',''),purchase);
       perform private.create_receipt_batches(p_command,ln.id,x->'batches');
       update public.inventory_order_lines set received_qty=received_qty+accepted where id=ln.id;
     end loop;
     if total_lines=0 then raise exception 'No received or rejected quantities'; end if;
     update public.inventory_orders set status=case when exists(select 1 from public.inventory_order_lines where order_id=po.id and received_qty<qty) then 'partial' else 'closed' end where id=po.id;
   else
     if not((p_action='po_approve' and po.status='draft') or (p_action='po_send' and po.status='approved') or (p_action='po_cancel' and po.status in ('draft','approved','sent')) or (p_action='po_close' and po.status='partial')) then raise exception 'Invalid order transition'; end if;
     if p_action in ('po_send','po_cancel','po_close') and length(note)<3 then raise exception 'Record the sending reference or closure reason'; end if;
     update public.inventory_orders set status=case p_action when 'po_approve' then 'approved' when 'po_send' then 'sent' when 'po_cancel' then 'cancelled' else 'closed' end where id=po.id;
   end if;
   update public.inventory_orders set revision=revision+1,updated_at=now() where id=po.id returning to_jsonb(inventory_orders) into result;
 elsif p_action='waste_correct' then
   select * into waste from public.waste_log where id=obj_id and branch_id=p_branch for update;
   if not found then raise exception 'Waste entry unavailable' using errcode='23505'; end if;
   if to_jsonb(waste) is distinct from p_body->'before' then raise exception 'Waste changed. Reload.' using errcode='23505'; end if;
   if length(note)<3 then raise exception 'Correction reason required'; end if;
   original:=to_jsonb(waste); amount:=(p_body->>'qty')::numeric;
   if amount is null or not(amount>=0 and amount<'Infinity'::numeric) then raise exception 'Invalid waste quantity'; end if;
   if amount=0 then delete from public.waste_log where id=waste.id;
   else update public.waste_log set qty=amount,note=concat(coalesce(waste.note,''),' | Correction: ',trim(p_body->>'note')) where id=waste.id; end if;
   result:=jsonb_build_object('id',waste.id,'qty',amount,'voided',amount=0);
 elsif p_action='transfer_receive' then
   select * into transfer from public.stock_transfers where id=obj_id and to_branch_id=p_branch for update;
   if not found or transfer.status<>'sent' then raise exception 'Transfer changed or unavailable' using errcode='23505'; end if;
   original:=to_jsonb(transfer);
   update public.stock_transfers set status='received',received_qty=(p_body->>'qty')::numeric,receipt_note=trim(p_body->>'note') where id=transfer.id returning to_jsonb(stock_transfers) into result;
 else raise exception 'Unsupported inventory action'; end if;
 insert into public.inventory_operation_events(id,branch_id,actor_id,action,request,before_data,result) values(p_command,p_branch,actor,p_action,p_body,original,result);
 return result;
end $$;

notify pgrst,'reload schema';
commit;
