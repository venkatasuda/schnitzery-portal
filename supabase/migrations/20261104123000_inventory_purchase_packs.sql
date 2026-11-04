begin;
set local lock_timeout='3s';
create table public.inventory_purchase_packs (
 id uuid primary key, branch_id uuid not null references public.branches(id),
 product_id uuid not null references public.inventory_master(id),
 label text not null check(length(trim(label)) between 1 and 80),
 base_qty numeric not null check(base_qty>0 and base_qty<1e9),
 created_by uuid not null references public.users(id),
 created_at timestamptz not null default clock_timestamp()
);
create index purchase_packs_product on public.inventory_purchase_packs(branch_id,product_id,created_at desc,id);
alter table public.inventory_purchase_packs enable row level security;
revoke all on public.inventory_purchase_packs from public,anon,authenticated;
grant select on public.inventory_purchase_packs to authenticated;
create policy purchase_packs_read on public.inventory_purchase_packs for select to authenticated
 using(branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
alter table public.inventory_order_lines
 add column pack_id uuid references public.inventory_purchase_packs(id),
 add column entered_qty numeric,
 add column pack_label text,
 add column pack_factor numeric,
 add column entered_unit_price numeric;
update public.inventory_order_lines set entered_qty=qty,pack_factor=1,entered_unit_price=unit_price;
alter table public.inventory_order_lines alter column entered_qty set not null,alter column pack_factor set not null;
alter table public.inventory_order_lines add constraint order_pack_valid check(
 entered_qty>0 and entered_qty<'Infinity'::numeric and pack_factor>0 and pack_factor<1e9
 and qty=entered_qty*pack_factor
 and (entered_unit_price is null or entered_unit_price>=0 and entered_unit_price<'Infinity'::numeric)
 and ((pack_id is null and pack_label is null and pack_factor=1) or (pack_id is not null and length(trim(pack_label))>0))
);

create or replace function private.inventory_operation(p_branch uuid,p_command uuid,p_action text,p_body jsonb) returns jsonb
language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare actor uuid:=auth.uid(); previous public.inventory_operation_events%rowtype; product_row public.inventory_master%rowtype;
 supplier public.inventory_suppliers%rowtype; po public.inventory_orders%rowtype; ln public.inventory_order_lines%rowtype;
 waste public.waste_log%rowtype; transfer public.stock_transfers%rowtype; original jsonb; result jsonb; x jsonb; obj_id uuid; new_id uuid; purchase uuid;
 pack public.inventory_purchase_packs%rowtype; factor numeric; entered numeric; entered_price numeric;
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
 elsif p_action='pack_save' then
   select * into product_row from public.inventory_master where id=(p_body->>'product_id')::uuid and branch_id=p_branch and is_active for share;
   if not found or nullif(trim(product_row.unit),'') is null then raise exception 'Choose an active product with a stock unit';end if;
   if length(trim(coalesce(p_body->>'label',''))) not between 1 and 80 or jsonb_typeof(p_body->'base_qty') is distinct from 'number' then raise exception 'Pack label and base quantity required';end if;
   factor:=(p_body->>'base_qty')::numeric;
   if not(factor>0 and factor<1e9) then raise exception 'Invalid pack size';end if;
   insert into public.inventory_purchase_packs(id,branch_id,product_id,label,base_qty,created_by)
   values(p_command,p_branch,product_row.id,trim(p_body->>'label'),factor,actor) returning to_jsonb(inventory_purchase_packs) into result;
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
    values(obj_id,p_branch,supplier.id,supplier.name,supplier.email,'PO-'||upper(replace(obj_id::text,'-','')),(p_body->>'expected_date')::date,note,actor)
    on conflict(id) do update set supplier_id=excluded.supplier_id,supplier_name=excluded.supplier_name,supplier_email=excluded.supplier_email,expected_date=excluded.expected_date,note=excluded.note,revision=public.inventory_orders.revision+1,updated_at=now();
   delete from public.inventory_order_lines where order_id=obj_id;
   for x in select * from jsonb_array_elements(p_body->'lines') loop
     select * into product_row from public.inventory_master where id=(x->>'product_id')::uuid and branch_id=p_branch and is_active;
     if not found then raise exception 'Product unavailable in this branch'; end if;
     pack:=null;factor:=1;
     if x->>'pack_id' is not null then
      select * into pack from public.inventory_purchase_packs where id=(x->>'pack_id')::uuid and product_id=product_row.id and branch_id=p_branch;
      if not found then raise exception 'Purchase pack does not belong to this branch product';end if;
      factor:=pack.base_qty;
     end if;
     entered:=(x->>'qty')::numeric;entered_price:=(x->>'unit_price')::numeric;
     if jsonb_typeof(x->'qty') is distinct from 'number' or entered is null or not(entered>0 and entered<1e9) or entered*factor>=1e9 or (entered_price is not null and not(entered_price>=0 and entered_price<1e9)) then raise exception 'Invalid order quantity or price';end if;
     insert into public.inventory_order_lines(order_id,product_id,product,category,unit,qty,unit_price,pack_id,entered_qty,pack_label,pack_factor,entered_unit_price)
      values(obj_id,product_row.id,product_row.product,product_row.category,product_row.unit,entered*factor,entered_price/factor,pack.id,entered,pack.label,factor,entered_price);
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
