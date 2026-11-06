begin;
set local lock_timeout='3s';
create or replace function private.stage_pos_import(p_connection uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
declare c public.pos_connections%rowtype;old public.pos_imports%rowtype;r jsonb;result uuid;
begin
 select * into c from public.pos_connections where id=p_connection and enabled for share;
 if not found or not exists(select 1 from public.branches where id=c.branch_id and is_active) then raise exception 'POS connection disabled' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>1048576 or coalesce(p_payload->>'format','') not in('schnitzery-pos-daily-v1','schnitzery-pos-items-v1') or coalesce(p_payload->>'currency','')<>'EUR' or jsonb_typeof(p_payload->'external_id') is distinct from 'string' or length(trim(p_payload->>'external_id')) not between 1 and 160 or jsonb_typeof(p_payload->'days') is distinct from 'array' or jsonb_array_length(p_payload->'days') not between 1 and 400 then raise exception 'Invalid normalized POS payload';end if;
 if (select count(*) from jsonb_array_elements(p_payload->'days'))<>(select count(distinct v->>'date') from jsonb_array_elements(p_payload->'days') v) then raise exception 'Duplicate sales date';end if;
 for r in select value from jsonb_array_elements(p_payload->'days') loop
  if jsonb_typeof(r) is distinct from 'object' or coalesce(r->>'date','')!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or not((r->>'date')::date between date '2000-01-01' and (now() at time zone 'Europe/Berlin')::date) or jsonb_typeof(r->'gross_sales') is distinct from 'number' or not((r->>'gross_sales')::numeric between 0 and 10000000) or (r->>'gross_sales')::numeric<>round((r->>'gross_sales')::numeric,2) then raise exception 'Invalid daily gross sales';end if;
 end loop;

 if p_payload->>'format'='schnitzery-pos-items-v1' then
  if jsonb_typeof(p_payload->'items') is distinct from 'array' or jsonb_array_length(p_payload->'items') not between 1 and 2000 then raise exception 'Invalid item export';end if;
  if (select count(*) from jsonb_array_elements(p_payload->'items'))<>(select count(distinct (v->>'date',v->>'sku')) from jsonb_array_elements(p_payload->'items') v) then raise exception 'Duplicate SKU/date';end if;
  for r in select value from jsonb_array_elements(p_payload->'items') loop
   if jsonb_typeof(r->'sku') is distinct from 'string' or length(r->>'sku') not between 1 and 160 or r->>'sku'<>trim(r->>'sku') or jsonb_typeof(r->'qty') is distinct from 'number' or not((r->>'qty')::numeric>0 and (r->>'qty')::numeric<=1e6) or not exists(select 1 from jsonb_array_elements(p_payload->'days') d where d->>'date'=r->>'date') then raise exception 'Invalid item quantity or date';end if;
  end loop;
 elsif p_payload ? 'items' then raise exception 'Item sales require items format';
 end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-branch:'||c.branch_id::text,0));
 select * into old from public.pos_imports where connection_id=p_connection and external_id=p_payload->>'external_id';
 if found then if old.payload<>p_payload then raise exception 'POS external ID conflict' using errcode='23505';end if;return old.id;end if;
 insert into public.pos_imports(connection_id,branch_id,external_id,payload) values(c.id,c.branch_id,p_payload->>'external_id',p_payload) returning id into result;return result;
end $$;
create table public.pos_recipe_mappings (
 id uuid primary key, branch_id uuid not null references public.branches(id), connection_id uuid not null references public.pos_connections(id),
 sku text not null check(length(trim(sku)) between 1 and 160), recipe_id uuid references public.inventory_recipe_versions(id),
 revision integer not null check(revision>0),note text not null check(length(trim(note)) between 3 and 1000), created_by uuid not null references public.users(id),
 created_at timestamptz not null default clock_timestamp(),unique(connection_id,sku,revision)
);
create index pos_mapping_latest on public.pos_recipe_mappings(connection_id,sku,revision desc);
create table public.pos_stock_posts (
 id uuid primary key, import_id uuid not null references public.pos_imports(id), branch_id uuid not null references public.branches(id),
 mappings jsonb not null, note text not null check(length(trim(note)) between 3 and 1000), actor_id uuid not null references public.users(id),
 posted_at timestamptz not null default clock_timestamp()
);
create table public.pos_stock_lines (
 id uuid primary key default gen_random_uuid(), post_id uuid not null references public.pos_stock_posts(id), branch_id uuid not null references public.branches(id),
 sku text not null, sale_date date not null, recipe_id uuid not null references public.inventory_recipe_versions(id), product_id uuid not null references public.inventory_master(id),
 batch_id uuid not null references public.stock_batches(id), action_id uuid not null unique references public.stock_batch_actions(id),
 sold_qty numeric not null check(sold_qty>0), qty numeric not null check(qty>0 and qty<1e9), unit text not null, unit_cost numeric check(unit_cost>=0 and unit_cost<1e9)
);
create index pos_posts_import on public.pos_stock_posts(import_id);
create index pos_posts_branch on public.pos_stock_posts(branch_id,posted_at desc);
create index pos_lines_post on public.pos_stock_lines(post_id,batch_id);
create index pos_lines_batch on public.pos_stock_lines(batch_id);
alter table public.pos_recipe_mappings enable row level security;
alter table public.pos_stock_posts enable row level security;
alter table public.pos_stock_lines enable row level security;
revoke all on public.pos_recipe_mappings,public.pos_stock_posts,public.pos_stock_lines from public,anon,authenticated;
grant select on public.pos_recipe_mappings,public.pos_stock_posts,public.pos_stock_lines to authenticated;
create policy pos_mappings_read on public.pos_recipe_mappings for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create policy pos_posts_read on public.pos_stock_posts for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create policy pos_lines_read on public.pos_stock_lines for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create trigger pos_mapping_immutable before update or delete on public.pos_recipe_mappings for each row execute function private.stock_events_immutable();
create trigger pos_posts_immutable before update or delete on public.pos_stock_posts for each row execute function private.stock_events_immutable();
create trigger pos_lines_immutable before update or delete on public.pos_stock_lines for each row execute function private.stock_events_immutable();

create function private.save_pos_recipe_mapping(p_branch uuid,p_id uuid,p_connection uuid,p_sku text,p_recipe uuid,p_note text) returns uuid language plpgsql security definer set search_path='' as $$
declare old public.pos_recipe_mappings%rowtype;rev integer;
begin
 perform private.require_price_manager(p_branch);
 if p_id is null or p_sku is null or length(trim(p_sku)) not between 1 and 160 or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'SKU, recipe and review note required';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-mapping:'||p_connection::text,0));
 if not exists(select 1 from public.pos_connections where id=p_connection and branch_id=p_branch) or (p_recipe is not null and not exists(select 1 from public.inventory_recipe_versions where id=p_recipe and branch_id=p_branch)) then raise exception 'Mapping access denied' using errcode='42501';end if;
 select * into old from public.pos_recipe_mappings where id=p_id;
 if found then if row(old.branch_id,old.connection_id,old.sku,old.recipe_id,old.note,old.created_by) is distinct from row(p_branch,p_connection,trim(p_sku),p_recipe,trim(p_note),auth.uid()) then raise exception 'Mapping retry conflict' using errcode='23505';end if;return old.id;end if;
 select coalesce(max(revision),0)+1 into rev from public.pos_recipe_mappings where connection_id=p_connection and sku=trim(p_sku);
 insert into public.pos_recipe_mappings(id,branch_id,connection_id,sku,recipe_id,revision,note,created_by) values(p_id,p_branch,p_connection,trim(p_sku),p_recipe,rev,trim(p_note),auth.uid());return p_id;
end $$;
create function private.import_pos_export(p_branch uuid,p_connection uuid,p_payload jsonb) returns uuid language plpgsql security definer set search_path='' as $$
begin
 perform private.require_price_manager(p_branch);
 if not exists(select 1 from public.pos_connections where id=p_connection and branch_id=p_branch and enabled) then raise exception 'Enable a connection for this branch' using errcode='42501';end if;
 return private.stage_pos_import(p_connection,p_payload);
end $$;

create function private.post_pos_stock(p_branch uuid,p_import uuid,p_command uuid,p_mappings jsonb,p_note text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare job public.pos_imports%rowtype;old public.pos_stock_posts%rowtype;m public.pos_recipe_mappings%rowtype;r public.inventory_recipe_versions%rowtype;
 item jsonb;ingredient jsonb;b public.stock_batches%rowtype;needed numeric;take_qty numeric;cost numeric;action_id uuid;today date:=(now() at time zone 'Europe/Berlin')::date;
begin
 perform private.require_price_manager(p_branch);
 if p_command is null or p_reviewed is distinct from true or p_note is null or length(trim(p_note)) not between 3 and 1000 or jsonb_typeof(p_mappings) is distinct from 'object' or octet_length(p_mappings::text)>500000 then raise exception 'Review mappings and consumption';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-stock:'||p_import::text,0));
 select * into old from public.pos_stock_posts where id=p_command;
 if found then if old.import_id<>p_import or old.branch_id<>p_branch or old.actor_id<>auth.uid() or old.mappings<>p_mappings or old.note<>trim(p_note) then raise exception 'Sales consumption already posted' using errcode='23505';end if;return old.id;end if;
 if exists(select 1 from public.pos_stock_posts p where p.import_id=p_import and not exists(select 1 from public.pos_stock_reversals rv where rv.post_id=p.id)) then raise exception 'Sales consumption already posted' using errcode='23505';end if;
 select * into job from public.pos_imports where id=p_import and branch_id=p_branch and status='approved' for update;
 if not found or job.payload->>'format'<>'schnitzery-pos-items-v1' then raise exception 'An approved item-level export is required';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-mapping:'||job.connection_id::text,0));
 insert into public.pos_stock_posts(id,import_id,branch_id,mappings,note,actor_id) values(p_command,p_import,p_branch,p_mappings,trim(p_note),auth.uid());
 for item in select value from jsonb_array_elements(job.payload->'items') order by value->>'date',value->>'sku' loop
  select * into m from public.pos_recipe_mappings where connection_id=job.connection_id and branch_id=p_branch and sku=item->>'sku' order by revision desc limit 1;
  if not found or p_mappings->>(item->>'sku') is distinct from m.id::text then raise exception 'Missing or changed recipe mapping; refresh' using errcode='23505';end if;
  if m.recipe_id is null then continue;end if; -- Reviewed non-stock SKU (for example a delivery fee).
  select * into r from public.inventory_recipe_versions where id=m.recipe_id and branch_id=p_branch;
  if not found then raise exception 'Mapped recipe unavailable';end if;
  for ingredient in select value from jsonb_array_elements(r.ingredients) order by value->>'product_id' loop
   needed:=(ingredient->>'qty')::numeric*(item->>'qty')::numeric/r.portions;
   if needed is null or not(needed>0 and needed<1e9) then raise exception 'Invalid recipe consumption';end if;
   -- Only verified, unexpired lots already received on the sale date can be allocated automatically.
   for b in select * from public.stock_batches where branch_id=p_branch and status='active' and product=ingredient->>'product' and category is not distinct from ingredient->>'category' and lower(trim(unit))=lower(trim(ingredient->>'unit')) and received_date<=(item->>'date')::date and expiry_date>=today order by expiry_date,id for update loop
    exit when needed=0;
    take_qty:=least(needed,b.remaining_qty);cost:=private.inventory_batch_cost(b.id);action_id:=gen_random_uuid();
    perform private.consume_stock_batch(p_branch,b.id,action_id,'used',take_qty,'POS recipe consumption '||job.external_id);
    insert into public.pos_stock_lines(post_id,branch_id,sku,sale_date,recipe_id,product_id,batch_id,action_id,sold_qty,qty,unit,unit_cost)
    values(p_command,p_branch,item->>'sku',(item->>'date')::date,r.id,(ingredient->>'product_id')::uuid,b.id,action_id,(item->>'qty')::numeric,take_qty,ingredient->>'unit',cost);
    needed:=needed-take_qty;
   end loop;
   if needed<>0 then raise exception 'Insufficient verified dated stock; no ingredients were posted' using errcode='23505';end if;
  end loop;
 end loop;
 return p_command;
end $$;
revoke all on function private.save_pos_recipe_mapping(uuid,uuid,uuid,text,uuid,text),private.import_pos_export(uuid,uuid,jsonb),private.post_pos_stock(uuid,uuid,uuid,jsonb,text,boolean) from public,anon,authenticated;
create function public.save_pos_recipe_mapping(p_branch uuid,p_id uuid,p_connection uuid,p_sku text,p_recipe uuid,p_note text) returns uuid language sql security invoker set search_path='' as $$select private.save_pos_recipe_mapping(p_branch,p_id,p_connection,p_sku,p_recipe,p_note)$$;
create function public.import_pos_export(p_branch uuid,p_connection uuid,p_payload jsonb) returns uuid language sql security invoker set search_path='' as $$select private.import_pos_export(p_branch,p_connection,p_payload)$$;
create function public.post_pos_stock(p_branch uuid,p_import uuid,p_command uuid,p_mappings jsonb,p_note text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.post_pos_stock(p_branch,p_import,p_command,p_mappings,p_note,p_reviewed)$$;
revoke all on function public.save_pos_recipe_mapping(uuid,uuid,uuid,text,uuid,text),public.import_pos_export(uuid,uuid,jsonb),public.post_pos_stock(uuid,uuid,uuid,jsonb,text,boolean) from public,anon;
grant execute on function private.save_pos_recipe_mapping(uuid,uuid,uuid,text,uuid,text),private.import_pos_export(uuid,uuid,jsonb),private.post_pos_stock(uuid,uuid,uuid,jsonb,text,boolean),public.save_pos_recipe_mapping(uuid,uuid,uuid,text,uuid,text),public.import_pos_export(uuid,uuid,jsonb),public.post_pos_stock(uuid,uuid,uuid,jsonb,text,boolean) to authenticated;
create table public.pos_stock_reversals (
 id uuid primary key,post_id uuid not null unique references public.pos_stock_posts(id),branch_id uuid not null references public.branches(id),
 note text not null check(length(trim(note)) between 3 and 1000),actor_id uuid not null references public.users(id),restored jsonb not null,created_at timestamptz not null default clock_timestamp()
);
alter table public.pos_stock_reversals enable row level security;
revoke all on public.pos_stock_reversals from public,anon,authenticated;
grant select on public.pos_stock_reversals to authenticated;
create policy pos_reversals_read on public.pos_stock_reversals for select to authenticated using(public.is_manager() and branch_id in(select public.accessible_branch_ids()) and exists(select 1 from public.users where id=auth.uid() and status='active'));
create trigger pos_reversals_immutable before update or delete on public.pos_stock_reversals for each row execute function private.stock_events_immutable();
create function private.reverse_pos_stock(p_branch uuid,p_post uuid,p_command uuid,p_note text,p_reviewed boolean) returns uuid language plpgsql security definer set search_path='' set lock_timeout='3s' as $$
declare old public.pos_stock_reversals%rowtype;i record;restored jsonb:='[]';
begin
 perform private.require_price_manager(p_branch);
 if p_command is null or p_reviewed is distinct from true or p_note is null or length(trim(p_note)) not between 3 and 1000 then raise exception 'Review reversal and provide evidence';end if;
 perform pg_advisory_xact_lock(hashtextextended('pos-stock:'||(select import_id::text from public.pos_stock_posts where id=p_post and branch_id=p_branch),0));
 perform 1 from public.pos_stock_posts where id=p_post and branch_id=p_branch for update;
 if not found then raise exception 'Stock post unavailable' using errcode='42501';end if;
 select * into old from public.pos_stock_reversals where post_id=p_post;
 if found then if old.id<>p_command or old.note<>trim(p_note) or old.actor_id<>auth.uid() then raise exception 'Already reversed' using errcode='23505';end if;return old.id;end if;
 for i in select batch_id,sum(qty) qty from public.pos_stock_lines where post_id=p_post group by batch_id order by batch_id loop
  perform 1 from public.stock_batches where id=i.batch_id and branch_id=p_branch and status in('active','used') and remaining_qty+i.qty<=qty for update;
  if not found then raise exception 'Batch cannot be restored safely; reconcile manually' using errcode='23505';end if;
  update public.stock_batches set remaining_qty=remaining_qty+i.qty,status='active',closed_at=null,closed_by=null where id=i.batch_id;
  restored:=restored||jsonb_build_array(jsonb_build_object('batch_id',i.batch_id,'qty',i.qty));
 end loop;
 insert into public.pos_stock_reversals(id,post_id,branch_id,note,actor_id,restored) values(p_command,p_post,p_branch,trim(p_note),auth.uid(),restored);return p_command;
end $$;
revoke all on function private.reverse_pos_stock(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
create function public.reverse_pos_stock(p_branch uuid,p_post uuid,p_command uuid,p_note text,p_reviewed boolean) returns uuid language sql security invoker set search_path='' as $$select private.reverse_pos_stock(p_branch,p_post,p_command,p_note,p_reviewed)$$;
revoke all on function public.reverse_pos_stock(uuid,uuid,uuid,text,boolean) from public,anon;
grant execute on function private.reverse_pos_stock(uuid,uuid,uuid,text,boolean),public.reverse_pos_stock(uuid,uuid,uuid,text,boolean) to authenticated;
notify pgrst,'reload schema';
commit;
