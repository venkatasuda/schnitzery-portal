begin;
set local lock_timeout='3s';
create table public.inventory_suppliers (
 id uuid primary key, branch_id uuid not null references public.branches(id), name text not null check(length(trim(name)) between 1 and 160),
 email text not null default '' check(length(email)<=254 and (email='' or email ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')), lead_days integer not null default 0 check(lead_days between 0 and 365), is_active boolean not null default true, revision integer not null default 0,
 unique(branch_id,name)
);
alter table public.inventory_master add column reorder_point numeric check(reorder_point>=0 and reorder_point<'Infinity'::numeric),
 add column reorder_qty numeric check(reorder_qty>0 and reorder_qty<'Infinity'::numeric), add column supplier_id uuid references public.inventory_suppliers(id), add column revision integer not null default 0;
create table public.inventory_orders (
 id uuid primary key, branch_id uuid not null references public.branches(id), supplier_id uuid not null references public.inventory_suppliers(id), supplier_name text not null,
 supplier_email text not null default '', reference text not null, status text not null default 'draft' check(status in ('draft','approved','sent','partial','closed','cancelled')),
 expected_date date check(expected_date is null or isfinite(expected_date)), note text not null default '', revision integer not null default 0, created_by uuid not null references public.users(id), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(branch_id,reference)
);
create table public.inventory_order_lines (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.inventory_orders(id), product_id uuid not null references public.inventory_master(id),
 product text not null, category text not null, unit text, qty numeric not null check(qty>0 and qty<'Infinity'::numeric), unit_price numeric check(unit_price>=0 and unit_price<'Infinity'::numeric),
 received_qty numeric not null default 0 check(received_qty>=0 and received_qty<'Infinity'::numeric), unique(order_id,product_id)
);
create table public.inventory_receipts (
 id uuid primary key, order_id uuid not null references public.inventory_orders(id), branch_id uuid not null references public.branches(id), invoice text not null,
 note text not null default '', received_by uuid not null references public.users(id), received_at timestamptz not null default now(), unique(order_id,invoice)
);
alter table public.inventory_purchases add column receipt_id uuid references public.inventory_receipts(id), add column order_line_id uuid references public.inventory_order_lines(id);
create table public.inventory_receipt_lines (
 id uuid primary key default gen_random_uuid(), receipt_id uuid not null references public.inventory_receipts(id), order_line_id uuid not null references public.inventory_order_lines(id),
 accepted numeric not null check(accepted>=0 and accepted<'Infinity'::numeric), rejected numeric not null check(rejected>=0 and rejected<'Infinity'::numeric),
 cost numeric not null check(cost>=0 and cost<'Infinity'::numeric), note text not null default '', purchase_id uuid references public.inventory_purchases(id), unique(receipt_id,order_line_id)
);
create table public.inventory_operation_events (
 id uuid primary key, branch_id uuid not null references public.branches(id), actor_id uuid not null references public.users(id), action text not null,
 request jsonb not null, before_data jsonb, result jsonb not null, recorded_at timestamptz not null default now()
);
create index inventory_orders_branch on public.inventory_orders(branch_id,created_at desc);
create index inventory_suppliers_branch on public.inventory_suppliers(branch_id);
create index inventory_receipts_branch on public.inventory_receipts(branch_id,received_at desc);
create index inventory_receipts_order on public.inventory_receipts(order_id);
create index inventory_receipt_lines_receipt on public.inventory_receipt_lines(receipt_id);
create index inventory_receipt_lines_order_line on public.inventory_receipt_lines(order_line_id);
create index inventory_operation_events_branch on public.inventory_operation_events(branch_id,recorded_at desc);

alter table public.inventory_suppliers enable row level security;
alter table public.inventory_orders enable row level security;
alter table public.inventory_order_lines enable row level security;
alter table public.inventory_receipts enable row level security;
alter table public.inventory_receipt_lines enable row level security;
alter table public.inventory_operation_events enable row level security;
revoke all on public.inventory_suppliers,public.inventory_orders,public.inventory_order_lines,public.inventory_receipts,public.inventory_receipt_lines,public.inventory_operation_events from public,anon,authenticated;
grant select on public.inventory_suppliers,public.inventory_orders,public.inventory_order_lines,public.inventory_receipts,public.inventory_receipt_lines,public.inventory_operation_events to authenticated;
create policy inventory_suppliers_read on public.inventory_suppliers for select to authenticated using(public.is_manager() and exists(select 1 from public.users where id=(select auth.uid()) and status='active') and branch_id in(select public.accessible_branch_ids()));
create policy inventory_orders_read on public.inventory_orders for select to authenticated using(public.is_manager() and exists(select 1 from public.users where id=(select auth.uid()) and status='active') and branch_id in(select public.accessible_branch_ids()));
create policy inventory_order_lines_read on public.inventory_order_lines for select to authenticated using(exists(select 1 from public.inventory_orders o where o.id=order_id));
create policy inventory_receipts_read on public.inventory_receipts for select to authenticated using(public.is_manager() and exists(select 1 from public.users where id=(select auth.uid()) and status='active') and branch_id in(select public.accessible_branch_ids()));
create policy inventory_receipt_lines_read on public.inventory_receipt_lines for select to authenticated using(exists(select 1 from public.inventory_receipts r where r.id=receipt_id));
create policy inventory_operation_events_read on public.inventory_operation_events for select to authenticated using(public.is_manager() and exists(select 1 from public.users where id=(select auth.uid()) and status='active') and branch_id in(select public.accessible_branch_ids()));

alter table public.stock_transfers add column received_qty numeric check(received_qty>=0 and received_qty<'Infinity'::numeric),
 add column receipt_note text, add column received_by uuid references public.users(id), add column received_at timestamptz,
 add column sent_by uuid references public.users(id), add column sent_at timestamptz;

-- Protect the legacy transfer path too: no party can rewrite another party's quantities or evidence.
create function private.check_transfer_workflow() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') then raise exception 'Manager access required' using errcode='42501'; end if;
 if tg_op='INSERT' then
   if new.status<>'requested' or new.requested_by is distinct from auth.uid() or new.to_branch_id=new.from_branch_id or new.received_qty is not null
     or not exists(select 1 from public.accessible_branch_ids() b where b=new.to_branch_id) then raise exception 'Invalid transfer request' using errcode='42501'; end if;
   if not exists(select 1 from public.branches where id=new.from_branch_id and is_active) then raise exception 'Source branch is inactive';end if;
   select name into new.from_branch_name from public.branches where id=new.from_branch_id;
   select name into new.to_branch_name from public.branches where id=new.to_branch_id;
   select full_name into new.requested_by_name from public.users where id=auth.uid();
   new.sent_by:=null;new.sent_at:=null;new.received_by:=null;new.received_at:=null;new.receipt_note:=null;
 else
   if row(new.from_branch_id,new.to_branch_id,new.product,new.category,new.unit,new.qty,new.requested_by,new.created_at,new.from_branch_name,new.to_branch_name,new.requested_by_name,new.note) is distinct from row(old.from_branch_id,old.to_branch_id,old.product,old.category,old.unit,old.qty,old.requested_by,old.created_at,old.from_branch_name,old.to_branch_name,old.requested_by_name,old.note)
     then raise exception 'Transfer identity is immutable'; end if;
   if old.status='requested' and new.status in ('sent','rejected') then
     if not exists(select 1 from public.accessible_branch_ids() b where b=old.from_branch_id) then raise exception 'Source branch only' using errcode='42501'; end if;
     if new.status='sent' then new.sent_by=auth.uid(); new.sent_at=clock_timestamp(); else new.sent_by=old.sent_by;new.sent_at=old.sent_at;end if;
   elsif old.status='requested' and new.status='cancelled' then
     if not exists(select 1 from public.accessible_branch_ids() b where b=old.to_branch_id) then raise exception 'Destination branch only' using errcode='42501'; end if;
     new.sent_by=old.sent_by;new.sent_at=old.sent_at;
   elsif old.status='sent' and new.status='received' then
     if not exists(select 1 from public.accessible_branch_ids() b where b=old.to_branch_id) then raise exception 'Destination branch only' using errcode='42501'; end if;
     if new.received_qty is null or new.received_qty>old.qty or (new.received_qty<>old.qty and length(trim(coalesce(new.receipt_note,'')))<3) then raise exception 'Record actual receipt and explain discrepancies'; end if;
     new.received_by=auth.uid(); new.received_at=clock_timestamp();
   else raise exception 'Transfer already actioned or invalid transition' using errcode='40001'; end if;
   if not(old.status='sent' and new.status='received') and row(new.received_qty,new.receipt_note,new.received_by,new.received_at) is distinct from row(old.received_qty,old.receipt_note,old.received_by,old.received_at) then raise exception 'Receipt evidence is immutable'; end if;
   if old.status<>'requested' and row(new.sent_by,new.sent_at) is distinct from row(old.sent_by,old.sent_at) then raise exception 'Dispatch evidence is immutable'; end if;
 end if;
 new.updated_at=clock_timestamp(); return new;
end $$;
revoke all on function private.check_transfer_workflow() from public,anon,authenticated;
create trigger transfer_workflow_guard before insert or update on public.stock_transfers for each row execute function private.check_transfer_workflow();
-- Corrections must carry a manager reason; do not retain the old unaudited delete route.
revoke update,delete on public.waste_log from authenticated;

create function private.inventory_operation(p_branch uuid,p_command uuid,p_action text,p_body jsonb) returns jsonb
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
   if previous.branch_id<>p_branch or previous.action<>p_action or previous.request<>p_body then raise exception 'Command key already used' using errcode='40001'; end if;
   return previous.result;
 end if;
 -- ponytail: serialize writes per branch; split by order/product only if branch write contention warrants it.
 perform pg_advisory_xact_lock(hashtextextended('inventory-operations:'||p_branch::text,0));
 select full_name into actor_name from public.users where id=actor;
 obj_id:=coalesce((p_body->>'id')::uuid,p_command); note:=trim(coalesce(p_body->>'note',''));
 if length(note)>1000 then raise exception 'Note too long'; end if;
 if p_action='supplier_save' then
   select * into supplier from public.inventory_suppliers where id=obj_id for update;
   if found and (supplier.branch_id<>p_branch or supplier.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Supplier changed' using errcode='40001'; end if;
   original:=to_jsonb(supplier);
   if length(coalesce(p_body->>'email',''))>254 then raise exception 'Invalid email'; end if;
   insert into public.inventory_suppliers(id,branch_id,name,email,lead_days,is_active,revision)
    values(obj_id,p_branch,trim(p_body->>'name'),coalesce(p_body->>'email',''),coalesce((p_body->>'lead_days')::integer,0),coalesce((p_body->>'is_active')::boolean,true),0)
    on conflict(id) do update set name=excluded.name,email=excluded.email,lead_days=excluded.lead_days,is_active=excluded.is_active,revision=public.inventory_suppliers.revision+1 returning to_jsonb(inventory_suppliers) into result;
 elsif p_action='product_save' then
   select * into product_row from public.inventory_master where id=obj_id for update;
   if found and (product_row.branch_id<>p_branch or product_row.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Product changed' using errcode='40001'; end if;
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
   if found and (po.branch_id<>p_branch or po.status<>'draft' or po.revision is distinct from (p_body->>'revision')::integer) then raise exception 'Order changed or is no longer a draft' using errcode='40001'; end if;
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
   if po.revision is distinct from (p_body->>'revision')::integer then raise exception 'Order changed. Reload.' using errcode='40001'; end if;
   original:=to_jsonb(po);
   if p_action='receive' then
     if po.status not in ('sent','partial') then raise exception 'Only sent orders can be received'; end if;
     if length(trim(coalesce(p_body->>'invoice',''))) not between 1 and 160 or jsonb_typeof(p_body->'lines') is distinct from 'array' or jsonb_array_length(p_body->'lines') not between 1 and 500 then raise exception 'Invoice/reference and receipt lines required'; end if;
     if (select count(*) from jsonb_array_elements(p_body->'lines'))<>(select count(distinct receipt_item->>'id') from jsonb_array_elements(p_body->'lines') receipt_item) then raise exception 'Duplicate receipt line'; end if;
     insert into public.inventory_receipts(id,branch_id,order_id,invoice,note,received_by) values(p_command,p_branch,po.id,trim(p_body->>'invoice'),note,actor);
     total_lines:=0;
     for x in select * from jsonb_array_elements(p_body->'lines') loop
       select * into ln from public.inventory_order_lines where id=(x->>'id')::uuid and order_id=po.id for update;
       if not found then raise exception 'Receipt line does not belong to this order'; end if;
       accepted:=(x->>'accepted')::numeric; rejected:=(x->>'rejected')::numeric; line_cost:=(x->>'cost')::numeric;
       if accepted is null or rejected is null or line_cost is null or not(accepted>=0 and accepted<'Infinity'::numeric and rejected>=0 and rejected<'Infinity'::numeric and line_cost>=0 and line_cost<'Infinity'::numeric) then raise exception 'Invalid receipt quantity or cost'; end if;
       if accepted=0 and line_cost<>0 then raise exception 'Cost must be zero when no goods are accepted'; end if;
       if accepted+rejected=0 then continue; end if;
       if (accepted<>ln.qty-ln.received_qty or rejected>0) and length(trim(coalesce(x->>'note','')))<3 then raise exception 'Explain partial delivery, over-delivery or rejected goods'; end if;
       total_lines:=total_lines+1; purchase:=null;
       if accepted>0 then
         insert into public.inventory_purchases(branch_id,product,category,unit,qty,cost,supplier,note,created_by,receipt_id,order_line_id)
          values(p_branch,ln.product,ln.category,ln.unit,accepted,line_cost,po.supplier_name,concat('Receipt ',p_body->>'invoice',' · ',note),actor_name,p_command,ln.id) returning id into purchase;
       end if;
       insert into public.inventory_receipt_lines(receipt_id,order_line_id,accepted,rejected,cost,note,purchase_id)
        values(p_command,ln.id,accepted,rejected,line_cost,coalesce(x->>'note',''),purchase);
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
   if not found then raise exception 'Waste entry unavailable' using errcode='40001'; end if;
   if to_jsonb(waste) is distinct from p_body->'before' then raise exception 'Waste changed. Reload.' using errcode='40001'; end if;
   if length(note)<3 then raise exception 'Correction reason required'; end if;
   original:=to_jsonb(waste); amount:=(p_body->>'qty')::numeric;
   if amount is null or not(amount>=0 and amount<'Infinity'::numeric) then raise exception 'Invalid waste quantity'; end if;
   if amount=0 then delete from public.waste_log where id=waste.id;
   else update public.waste_log set qty=amount,note=concat(coalesce(waste.note,''),' | Correction: ',trim(p_body->>'note')) where id=waste.id; end if;
   result:=jsonb_build_object('id',waste.id,'qty',amount,'voided',amount=0);
 elsif p_action='transfer_receive' then
   select * into transfer from public.stock_transfers where id=obj_id and to_branch_id=p_branch for update;
   if not found or transfer.status<>'sent' then raise exception 'Transfer changed or unavailable' using errcode='40001'; end if;
   original:=to_jsonb(transfer);
   update public.stock_transfers set status='received',received_qty=(p_body->>'qty')::numeric,receipt_note=trim(p_body->>'note') where id=transfer.id returning to_jsonb(stock_transfers) into result;
 else raise exception 'Unsupported inventory action'; end if;
 insert into public.inventory_operation_events(id,branch_id,actor_id,action,request,before_data,result) values(p_command,p_branch,actor,p_action,p_body,original,result);
 return result;
end $$;
revoke all on function private.inventory_operation(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant usage on schema private to authenticated;
grant execute on function private.inventory_operation(uuid,uuid,text,jsonb) to authenticated;
create function public.inventory_operation(p_branch uuid,p_command uuid,p_action text,p_body jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.inventory_operation(p_branch,p_command,p_action,p_body)$$;
revoke all on function public.inventory_operation(uuid,uuid,text,jsonb) from public,anon;
grant execute on function public.inventory_operation(uuid,uuid,text,jsonb) to authenticated;
create function public.read_inventory_history(p_branch uuid,p_source text,p_before bigint,p_product text,p_from date,p_to date)
returns setof public.stock_events language sql stable security invoker set search_path='' as $$
 select e.* from public.stock_events e where e.branch_ids @> array[p_branch] and exists(select 1 from public.users where id=(select auth.uid()) and status='active')
  and (p_source='all' or e.source_table=p_source) and (p_before is null or e.id<p_before)
  and (p_from is null or e.recorded_at >= (p_from::timestamp at time zone 'Europe/Berlin'))
  and (p_to is null or e.recorded_at < ((p_to+1)::timestamp at time zone 'Europe/Berlin'))
  and (coalesce(p_product,'')='' or position(lower(p_product) in lower(coalesce(e.after_row->>'product','')||' '||coalesce(e.before_row->>'product','')))>0)
 order by e.id desc limit 101
$$;
revoke all on function public.read_inventory_history(uuid,text,bigint,text,date,date) from public,anon;
grant execute on function public.read_inventory_history(uuid,text,bigint,text,date,date) to authenticated;

create function private.inventory_product_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' then
   if row(new.product,new.category,new.unit,new.branch_id) is distinct from row(old.product,old.category,old.unit,old.branch_id) then raise exception 'Archive and replace product identities instead of rewriting history'; end if;
   new.revision:=old.revision+1;
 end if;
 if new.supplier_id is not null and not exists(select 1 from public.inventory_suppliers where id=new.supplier_id and branch_id=new.branch_id) then raise exception 'Supplier belongs to another branch'; end if;
 if auth.uid() is not null then
   if not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') then raise exception 'Manager access required' using errcode='42501'; end if;
   insert into public.inventory_operation_events(id,branch_id,actor_id,action,request,before_data,result)
    values(gen_random_uuid(),new.branch_id,auth.uid(),'product_changed',jsonb_build_object('id',new.id),case when tg_op='UPDATE' then to_jsonb(old) end,to_jsonb(new));
 end if;
 return new;
end $$;
revoke all on function private.inventory_product_guard() from public,anon,authenticated;
create trigger inventory_product_guard before insert or update on public.inventory_master for each row execute function private.inventory_product_guard();
create function private.inventory_count_catalogue_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then return new;end if;
 if not public.is_manager() or not exists(select 1 from public.users where id=auth.uid() and status='active') or not exists(select 1 from public.accessible_branch_ids() b where b=new.branch_id) then raise exception 'Count access denied' using errcode='42501';end if;
 select m.soll into new.soll from public.inventory_master m where m.branch_id=new.branch_id and m.is_active and m.product=new.product and coalesce(m.category,'')=coalesce(new.category,'') and coalesce(m.unit,'')=coalesce(new.unit,'');
 if not found then raise exception 'Product changed or archived. Refresh the catalogue before counting.' using errcode='40001';end if;
 select full_name into new.counted_by from public.users where id=auth.uid();
 return new;
end $$;
revoke all on function private.inventory_count_catalogue_guard() from public,anon,authenticated;
create trigger inventory_count_catalogue_guard before insert on public.inventory_counts for each row execute function private.inventory_count_catalogue_guard();
notify pgrst,'reload schema';
commit;
